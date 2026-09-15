import { beforeEach, describe, expect, it } from 'vitest'
import type { Exercise, Workout } from '../../domain/models'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { CATALOG_VERSION_METADATA_KEY } from '../../catalog/seedCatalog'
import { startWorkout } from '../workout/workoutActions'
import {
  addCatalogExerciseToActiveWorkout,
  DuplicateCatalogExerciseError,
  CatalogExerciseUnavailableError,
  NoActiveWorkoutError,
  StaleActiveWorkoutError,
} from './catalogWorkoutActions'

let db: RepwiseDatabase
let counter = 0

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

beforeEach(async () => {
  counter += 1
  db = createDatabase(`catalog-workout-actions-${counter}`)
  await db.open()
  await db.exercises.put(exercise())
})

describe('addCatalogExerciseToActiveWorkout', () => {
  it('rejects a deleted catalog record instead of resurrecting a stale screen snapshot', async () => {
    const workout = await startWorkout(db, 'Push Day')
    await db.exercises.delete(exercise().id)
    await expect(addCatalogExerciseToActiveWorkout(db, workout.id, exercise())).rejects.toBeInstanceOf(CatalogExerciseUnavailableError)
    expect(await db.exercises.count()).toBe(0)
    expect(await db.workoutExercises.count()).toBe(0)
  })

  it('serializes concurrent clicks so only one unconfirmed occurrence is inserted', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const outcomes = await Promise.allSettled([
      addCatalogExerciseToActiveWorkout(db, workout.id, exercise()),
      addCatalogExerciseToActiveWorkout(db, workout.id, exercise()),
    ])
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await db.workoutExercises.count()).toBe(1)
  })

  it('adds the exercise with a correct order/snapshot, using the stored catalog record and reading the current catalog version', async () => {
    const workout = await startWorkout(db, 'Push Day')
    await db.metadata.put({ key: CATALOG_VERSION_METADATA_KEY, value: 'v7' })
    const bench = exercise()
    expect(await db.exercises.get(bench.id)).toEqual(bench)

    const created = await addCatalogExerciseToActiveWorkout(db, workout.id, bench)

    expect(created.workoutId).toBe(workout.id)
    expect(created.exerciseId).toBe(bench.id)
    expect(created.order).toBe(0)
    expect(created.restSeconds).toBe(bench.defaultRestSeconds)
    expect(created.snapshot).toEqual({
      name: bench.name, equipment: bench.equipment, movementPattern: bench.movementPattern, muscles: bench.muscles, catalogVersion: 'v7',
    })
    expect(await db.exercises.get(bench.id)).toEqual(bench)
    expect(await db.workoutExercises.get(created.id)).toEqual(created)
  })

  it('assigns the next order after existing exercises and never overwrites an already-seeded catalog record', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const bench = exercise()
    const row = exercise({ id: 'row', name: 'Row', movementPattern: 'pull' })
    await db.exercises.put({ ...row, name: 'Stale Cached Name' })
    await addCatalogExerciseToActiveWorkout(db, workout.id, bench)

    const second = await addCatalogExerciseToActiveWorkout(db, workout.id, row)

    expect(second.order).toBe(1)
    expect(second.snapshot.name).toBe('Stale Cached Name')
    expect((await db.exercises.get(row.id))?.name).toBe('Stale Cached Name')
  })

  it('throws NoActiveWorkoutError and writes nothing when there is no active workout (including a completed one the caller still thinks is active)', async () => {
    const workout = await startWorkout(db, 'Push Day')
    await db.workouts.update(workout.id, { status: 'completed', endTime: new Date().toISOString() })

    await expect(addCatalogExerciseToActiveWorkout(db, workout.id, exercise())).rejects.toBeInstanceOf(NoActiveWorkoutError)
    expect(await db.workoutExercises.toArray()).toHaveLength(0)
  })

  it('throws StaleActiveWorkoutError and writes nothing when a different workout is now active than the caller expected', async () => {
    const stale = await startWorkout(db, 'Old Session')
    await db.workouts.update(stale.id, { status: 'discarded', endTime: new Date().toISOString() })
    const current = await startWorkout(db, 'New Session')

    let caught: unknown
    try {
      await addCatalogExerciseToActiveWorkout(db, stale.id, exercise())
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(StaleActiveWorkoutError)
    expect((caught as StaleActiveWorkoutError).expectedWorkoutId).toBe(stale.id)
    expect((caught as StaleActiveWorkoutError).actualWorkoutId).toBe(current.id)
    expect(await db.workoutExercises.toArray()).toHaveLength(0)
  })

  it('throws DuplicateCatalogExerciseError and writes nothing when the exercise is already in the workout', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const bench = exercise()
    await addCatalogExerciseToActiveWorkout(db, workout.id, bench)

    await expect(addCatalogExerciseToActiveWorkout(db, workout.id, bench)).rejects.toBeInstanceOf(DuplicateCatalogExerciseError)
    expect(await db.workoutExercises.where('workoutId').equals(workout.id).count()).toBe(1)
  })

  it('adds a second occurrence when the duplicate is explicitly allowed', async () => {
    const workout = await startWorkout(db, 'Push Day')
    const bench = exercise()
    await addCatalogExerciseToActiveWorkout(db, workout.id, bench)

    const second = await addCatalogExerciseToActiveWorkout(db, workout.id, bench, { allowDuplicate: true })

    expect(second.order).toBe(1)
    expect(await db.workoutExercises.where('workoutId').equals(workout.id).count()).toBe(2)
  })

  it('never writes to a completed workout even when it happens to be the most recently active one', async () => {
    const workout = await startWorkout(db, 'Push Day')
    await db.workouts.update(workout.id, { status: 'completed', endTime: new Date().toISOString() })
    const before: Workout | undefined = await db.workouts.get(workout.id)

    await expect(addCatalogExerciseToActiveWorkout(db, workout.id, exercise())).rejects.toBeInstanceOf(NoActiveWorkoutError)

    expect(await db.workouts.get(workout.id)).toEqual(before)
    expect(await db.workoutExercises.where('workoutId').equals(workout.id).count()).toBe(0)
  })
})
