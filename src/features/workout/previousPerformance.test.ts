import { beforeEach, describe, expect, it } from 'vitest'
import type { ExerciseSnapshot, Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { findPreviousPerformance, formatPreviousSet, summarizeWorkingSets } from './previousPerformance'

let db: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDatabase(`previous-performance-${counter}`)
  await db.open()
})

const snapshot: ExerciseSnapshot = { name: 'Bench Press', equipment: ['barbell'], movementPattern: 'push', muscles: [], catalogVersion: 'v1' }

function workout(overrides: Partial<Workout> = {}): Workout {
  return { id: 'w-1', date: '2026-01-01', startTime: '2026-01-01T08:00:00.000Z', name: 'Push', notes: '', status: 'completed', ...overrides }
}

function workoutExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return { id: 'we-1', workoutId: 'w-1', exerciseId: 'bench-press', order: 0, notes: '', restSeconds: 120, snapshot, ...overrides }
}

describe('findPreviousPerformance', () => {
  it('returns undefined when there is no completed prior instance', async () => {
    const result = await findPreviousPerformance(db, 'bench-press', 'w-current')
    expect(result).toBeUndefined()
  })

  it('ignores instances belonging to the current (in-progress) workout', async () => {
    await new DexieWorkoutRepository(db).saveWorkout(workout({ id: 'w-current', status: 'active' }))
    await new DexieWorkoutExerciseRepository(db).save(workoutExercise({ id: 'we-current', workoutId: 'w-current' }))
    const result = await findPreviousPerformance(db, 'bench-press', 'w-current')
    expect(result).toBeUndefined()
  })

  it('ignores instances from discarded workouts', async () => {
    await new DexieWorkoutRepository(db).saveWorkout(workout({ id: 'w-1', status: 'discarded' }))
    await new DexieWorkoutExerciseRepository(db).save(workoutExercise())
    const result = await findPreviousPerformance(db, 'bench-press', 'w-current')
    expect(result).toBeUndefined()
  })

  it('returns the most recent completed instance with its sets', async () => {
    await new DexieWorkoutRepository(db).saveWorkout(workout({ id: 'w-old', date: '2026-01-01' }))
    await new DexieWorkoutRepository(db).saveWorkout(workout({ id: 'w-new', date: '2026-01-10' }))
    const weOld = workoutExercise({ id: 'we-old', workoutId: 'w-old' })
    const weNew = workoutExercise({ id: 'we-new', workoutId: 'w-new' })
    await new DexieWorkoutExerciseRepository(db).save(weOld)
    await new DexieWorkoutExerciseRepository(db).save(weNew)

    const oldSet: WorkoutSet = { id: 's-old', workoutExerciseId: 'we-old', setNumber: 1, type: 'working', loadKg: 50, reps: 10, completed: true }
    const newSet: WorkoutSet = { id: 's-new', workoutExerciseId: 'we-new', setNumber: 1, type: 'working', loadKg: 60, reps: 8, completed: true }
    await new DexieSetRepository(db).save(oldSet)
    await new DexieSetRepository(db).save(newSet)

    const result = await findPreviousPerformance(db, 'bench-press', 'w-current')
    expect(result?.workout.id).toBe('w-new')
    expect(result?.sets).toEqual([newSet])
  })

  it('skips a newer occurrence that has no completed sets', async () => {
    await new DexieWorkoutRepository(db).saveWorkout(workout({ id: 'w-old', date: '2026-01-01' }))
    await new DexieWorkoutRepository(db).saveWorkout(workout({ id: 'w-new', date: '2026-01-10' }))
    const oldExercise = workoutExercise({ id: 'we-old', workoutId: 'w-old' })
    const newExercise = workoutExercise({ id: 'we-new', workoutId: 'w-new' })
    await new DexieWorkoutExerciseRepository(db).save(oldExercise)
    await new DexieWorkoutExerciseRepository(db).save(newExercise)
    await new DexieSetRepository(db).save({ id: 's-old', workoutExerciseId: oldExercise.id, setNumber: 1, type: 'working', loadKg: 50, reps: 10, completed: true })
    await new DexieSetRepository(db).save({ id: 's-new', workoutExerciseId: newExercise.id, setNumber: 1, type: 'working', loadKg: 60, reps: 8, completed: false })

    expect((await findPreviousPerformance(db, 'bench-press', 'w-current'))?.workout.id).toBe('w-old')
  })
})

describe('summarizeWorkingSets', () => {
  it('reports when no completed working sets are recorded', () => {
    expect(summarizeWorkingSets([], (kg) => `${kg}kg`)).toMatch(/no completed/i)
  })

  it('summarizes only completed working sets, in order, using the load formatter', () => {
    const sets: WorkoutSet[] = [
      { id: 's-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'warmup', loadKg: 20, reps: 10, completed: true },
      { id: 's-2', workoutExerciseId: 'we-1', setNumber: 2, type: 'working', loadKg: 60, reps: 8, completed: true },
      { id: 's-3', workoutExerciseId: 'we-1', setNumber: 3, type: 'working', loadKg: 60, reps: 6, completed: false },
    ]
    expect(summarizeWorkingSets(sets, (kg) => `${kg}kg`)).toBe('60kg×8')
  })
})

describe('formatPreviousSet', () => {
  it('uses an em dash when there is no completed historical set', () => {
    expect(formatPreviousSet(undefined, 'kg')).toBe('—')
  })

  it('formats canonical kilograms at the selected display-unit boundary', () => {
    const prior: WorkoutSet = { id: 'prior', workoutExerciseId: 'we', setNumber: 1, type: 'working', loadKg: 15.88, reps: 8, completed: true }
    expect(formatPreviousSet(prior, 'lb')).toBe('35.01 lb × 8')
  })
})
