import { beforeEach, describe, expect, it } from 'vitest'
import type { Exercise } from '../../domain/models'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { ActiveWorkoutConflictError, DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieMetadataRepository } from '../../data/repositories/metadataRepository'
import { CATALOG_VERSION_METADATA_KEY } from '../../catalog/seedCatalog'
import {
  addExerciseToWorkout,
  addSet,
  completeSet,
  discardWorkout,
  finishWorkout,
  hasAnyCompletedSet,
  isDuplicateExercise,
  removeSet,
  removeWorkoutExercise,
  renameWorkout,
  saveSet,
  startWorkout,
  uncompleteSet,
  updateSetFields,
} from './workoutActions'

let db: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDatabase(`workout-actions-${counter}`)
  await db.open()
})

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'bench-press',
    name: 'Bench Press',
    aliases: [],
    category: 'strength',
    movementPattern: 'push',
    difficulty: 'intermediate',
    mechanic: 'compound',
    equipment: ['barbell'],
    instructions: [],
    muscles: [{ muscleId: 'chest', weight: 1 }],
    defaultRestSeconds: 120,
    media: [],
    source: 'catalog',
    excluded: false,
    ...overrides,
  }
}

describe('startWorkout', () => {
  it('creates an active workout with id/date/startTime/name and persists it immediately', async () => {
    const now = new Date('2026-01-10T08:30:00.000Z')
    const workout = await startWorkout(db, 'Push Day', now)
    expect(workout.status).toBe('active')
    expect(workout.date).toBe('2026-01-10')
    expect(workout.startTime).toBe(now.toISOString())
    expect(workout.name).toBe('Push Day')

    const stored = await new DexieWorkoutRepository(db).getActive()
    expect(stored?.id).toBe(workout.id)
  })

  it('defaults an empty name to "Workout"', async () => {
    const workout = await startWorkout(db, '   ')
    expect(workout.name).toBe('Workout')
  })

  it('rejects starting a second active workout while one is already active', async () => {
    await startWorkout(db, 'First')
    await expect(startWorkout(db, 'Second')).rejects.toThrow(ActiveWorkoutConflictError)
  })
})

describe('addExerciseToWorkout', () => {
  it('snapshots name/equipment/movementPattern/muscles/catalogVersion at add time', async () => {
    await new DexieMetadataRepository(db).set(CATALOG_VERSION_METADATA_KEY, 'catalog-42')
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise())

    expect(workoutExercise.snapshot).toEqual({
      name: 'Bench Press',
      equipment: ['barbell'],
      movementPattern: 'push',
      muscles: [{ muscleId: 'chest', weight: 1 }],
      catalogVersion: 'catalog-42',
    })
    expect(workoutExercise.restSeconds).toBe(120)

    const persisted = await new DexieWorkoutExerciseRepository(db).listByWorkout(workout.id)
    expect(persisted).toHaveLength(1)
  })

  it('does not mutate a snapshot when the live exercise later changes', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise({ name: 'Bench Press' }))
    // Simulate the catalog exercise changing after the fact — the snapshot must not follow it.
    const laterExercise = exercise({ name: 'Incline Bench Press' })
    expect(workoutExercise.snapshot.name).toBe('Bench Press')
    expect(laterExercise.name).toBe('Incline Bench Press')
  })

  it('assigns increasing order and flags duplicates via isDuplicateExercise', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const first = await addExerciseToWorkout(db, workout.id, exercise({ id: 'bench-press' }))
    expect(isDuplicateExercise([first], 'bench-press')).toBe(true)
    expect(isDuplicateExercise([first], 'squat')).toBe(false)

    const second = await addExerciseToWorkout(db, workout.id, exercise({ id: 'bench-press' }))
    expect(second.order).toBe(1)
    const all = await new DexieWorkoutExerciseRepository(db).listByWorkout(workout.id)
    expect(all).toHaveLength(2)
  })
})

describe('removeWorkoutExercise', () => {
  it('deletes the workout exercise and all of its sets', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise())
    await addSet(db, workoutExercise.id, 'working', [])

    await removeWorkoutExercise(db, workoutExercise.id)

    expect(await new DexieWorkoutExerciseRepository(db).listByWorkout(workout.id)).toHaveLength(0)
    expect(await new DexieSetRepository(db).listByWorkoutExercise(workoutExercise.id)).toHaveLength(0)
  })
})

describe('sets: add/remove/complete and immediate persistence', () => {
  it('adds sets with increasing set numbers and persists them immediately', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise())

    const set1 = await addSet(db, workoutExercise.id, 'working', [])
    const set2 = await addSet(db, workoutExercise.id, 'working', [set1])
    expect(set1.setNumber).toBe(1)
    expect(set2.setNumber).toBe(2)

    const persisted = await new DexieSetRepository(db).listByWorkoutExercise(workoutExercise.id)
    expect(persisted.map((s) => s.id)).toEqual([set1.id, set2.id])
  })

  it('saveSet persists an edited field immediately, without waiting for workout finish', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise())
    const set = await addSet(db, workoutExercise.id, 'working', [])

    await saveSet(db, { ...set, loadKg: 62.5, reps: 8 })

    const [persisted] = await new DexieSetRepository(db).listByWorkoutExercise(workoutExercise.id)
    expect(persisted?.loadKg).toBe(62.5)
    expect(persisted?.reps).toBe(8)
  })

  it('completing a set stamps a UTC completedAt; uncompleting clears it', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise())
    const set = await addSet(db, workoutExercise.id, 'working', [])
    const now = new Date('2026-01-10T09:15:30.000Z')

    const completed = await completeSet(db, set, now)
    expect(completed.completed).toBe(true)
    expect(completed.completedAt).toBe('2026-01-10T09:15:30.000Z')

    let persisted = (await new DexieSetRepository(db).listByWorkoutExercise(workoutExercise.id))[0]
    expect(persisted?.completedAt).toBe('2026-01-10T09:15:30.000Z')

    const uncompleted = await uncompleteSet(db, completed)
    expect(uncompleted.completed).toBe(false)
    expect(uncompleted.completedAt).toBeUndefined()

    persisted = (await new DexieSetRepository(db).listByWorkoutExercise(workoutExercise.id))[0]
    expect(persisted?.completed).toBe(false)
    expect(persisted?.completedAt).toBeUndefined()
  })

  it('completing a stale set object does not erase a rapid field update', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise())
    const staleSet = await addSet(db, workoutExercise.id, 'working', [])
    await updateSetFields(db, staleSet.id, { reps: 8, loadKg: 70 })
    await completeSet(db, staleSet, new Date('2026-01-10T09:15:30.000Z'))
    expect(await db.sets.get(staleSet.id)).toMatchObject({ reps: 8, loadKg: 70, completed: true })
  })

  it('removeSet deletes the set immediately', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise())
    const set = await addSet(db, workoutExercise.id, 'working', [])
    await removeSet(db, set.id)
    expect(await new DexieSetRepository(db).listByWorkoutExercise(workoutExercise.id)).toHaveLength(0)
  })
})

describe('hasAnyCompletedSet', () => {
  it('is false when there are no exercises or no completed sets', () => {
    expect(hasAnyCompletedSet([])).toBe(false)
    expect(hasAnyCompletedSet([{ sets: [{ id: 's', workoutExerciseId: 'we', setNumber: 1, type: 'working', completed: false }] }])).toBe(false)
  })

  it('is true when any set across any exercise is completed', () => {
    expect(hasAnyCompletedSet([{ sets: [{ id: 's', workoutExerciseId: 'we', setNumber: 1, type: 'working', completed: true }] }])).toBe(true)
  })
})

describe('finishWorkout / discardWorkout', () => {
  it('finish sets status completed and stamps endTime, keeping the workout id and history', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const now = new Date('2026-01-10T10:00:00.000Z')
    const finished = await finishWorkout(db, workout, now)
    expect(finished.status).toBe('completed')
    expect(finished.endTime).toBe(now.toISOString())

    const history = await new DexieWorkoutRepository(db).listHistory()
    expect(history.map((w) => w.id)).toContain(workout.id)
  })

  it('discard sets status discarded (not deleted) and stamps endTime', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const discarded = await discardWorkout(db, workout)
    expect(discarded.status).toBe('discarded')
    expect(discarded.endTime).toBeDefined()

    // Discarded workouts are preserved, not deleted, but excluded from completed history.
    const history = await new DexieWorkoutRepository(db).listHistory()
    expect(history.map((w) => w.id)).not.toContain(workout.id)
    expect(await db.workouts.get(workout.id)).toBeDefined()
  })

  it('allows starting a new active workout after the previous one is finished or discarded', async () => {
    const workout = await startWorkout(db, 'Push Day')
    await finishWorkout(db, workout)
    const next = await startWorkout(db, 'Pull Day')
    expect(next.status).toBe('active')
  })
})

describe('renameWorkout', () => {
  it('persists a new name immediately and defaults an empty name to "Workout"', async () => {
    const workout = await startWorkout(db, 'Push Day')
    await renameWorkout(db, workout, 'Heavy Push Day')
    expect((await new DexieWorkoutRepository(db).getActive())?.name).toBe('Heavy Push Day')

    await renameWorkout(db, { ...workout, name: 'Heavy Push Day' }, '   ')
    expect((await new DexieWorkoutRepository(db).getActive())?.name).toBe('Workout')
  })
})
