import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import { buildWorkoutSummary } from './workoutSummary'

const workout: Workout = {
  id: 'w1', date: '2026-09-14', startTime: '2026-09-14T10:00:00.000Z', endTime: '2026-09-14T10:31:40.000Z',
  name: 'Offline Push', notes: '', status: 'completed',
}

function exercise(id: string, order: number, name: string): WorkoutExercise {
  return { id, workoutId: workout.id, exerciseId: `ex-${id}`, order, notes: '', restSeconds: 90, snapshot: { name, equipment: [], movementPattern: 'push', muscles: [], catalogVersion: 'test' } }
}

function set(id: string, workoutExerciseId: string, setNumber: number, completed: boolean, loadKg?: number, reps?: number): WorkoutSet {
  return { id, workoutExerciseId, setNumber, type: 'working', completed, ...(loadKg === undefined ? {} : { loadKg }), ...(reps === undefined ? {} : { reps }) }
}

describe('buildWorkoutSummary', () => {
  it('computes duration, totals, and volume only from completed sets, ignoring an unrelated exercise instance', () => {
    const complete = exercise('a', 0, 'Bench Press')
    const partial = exercise('b', 1, 'Row')
    const summary = buildWorkoutSummary(workout, [complete, partial], new Map([
      ['a', [set('s1', 'a', 1, true, 70, 8), set('s2', 'a', 2, true, 70, 8)]],
      ['b', [set('s3', 'b', 1, true, 40, 10), set('s4', 'b', 2, false)]],
      ['unrelated', [set('s5', 'unrelated', 1, true, 999, 999)]],
    ]))

    expect(summary.durationSeconds).toBe(1900)
    expect(summary.completedSetCount).toBe(3)
    expect(summary.totalSetCount).toBe(4)
    expect(summary.volumeKg).toBe(70 * 8 * 2 + 40 * 10)
    expect(summary.exercises.map((e) => e.status)).toEqual(['complete', 'partial'])
  })

  it('reports skipped when no set was completed and omits bestLoadKg when nothing was loaded', () => {
    const noLoad = exercise('c', 0, 'Plank')
    const summary = buildWorkoutSummary(workout, [noLoad], new Map([
      ['c', [set('s1', 'c', 1, false), set('s2', 'c', 2, false)]],
    ]))

    expect(summary.exercises[0]!.status).toBe('skipped')
    expect(summary.exercises[0]!.bestLoadKg).toBeUndefined()
  })

  it('reports skipped for an exercise instance with zero recorded sets', () => {
    const empty = exercise('d', 0, 'Dead Bug')
    const summary = buildWorkoutSummary(workout, [empty], new Map())
    expect(summary.exercises[0]!.status).toBe('skipped')
    expect(summary.exercises[0]!.totalSetCount).toBe(0)
  })

  it('takes the highest completed load as bestLoadKg and orders exercises by their workout order', () => {
    const first = exercise('e', 1, 'Second In Order')
    const second = exercise('f', 0, 'First In Order')
    const summary = buildWorkoutSummary(workout, [first, second], new Map([
      ['e', [set('s1', 'e', 1, true, 20, 10), set('s2', 'e', 2, true, 25, 8)]],
      ['f', []],
    ]))

    expect(summary.exercises.map((e) => e.name)).toEqual(['First In Order', 'Second In Order'])
    expect(summary.exercises[1]!.bestLoadKg).toBe(25)
  })

  it('rejects active and discarded workouts and ignores foreign parent records', () => {
    expect(() => buildWorkoutSummary({ ...workout, status: 'active' }, [], new Map())).toThrow()
    expect(() => buildWorkoutSummary({ ...workout, status: 'discarded' }, [], new Map())).toThrow()
    const own = exercise('own', 0, 'Bench')
    const foreign = { ...exercise('other', 1, 'Other'), workoutId: 'other-workout' }
    const summary = buildWorkoutSummary(workout, [own, foreign], new Map([
      ['own', [set('s1', 'foreign-parent', 1, true, 999, 999)]],
    ]))
    expect(summary.exercises).toHaveLength(1)
    expect(summary.completedSetCount).toBe(0)
    expect(summary.volumeKg).toBe(0)
  })

  it('reports unavailable duration when the workout has no end time', () => {
    const active = { ...workout, endTime: undefined }
    const summary = buildWorkoutSummary(active, [], new Map())
    expect(summary.durationSeconds).toBeUndefined()
  })
})
