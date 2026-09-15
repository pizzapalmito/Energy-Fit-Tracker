import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import { buildExerciseProgress, estimatedOneRepMax, trainingConsistency, workoutDurationMinutes } from './progressMetrics'

const workout: Workout = { id: 'w-1', date: '2026-09-10', startTime: '2026-09-10T10:00:00Z', endTime: '2026-09-10T11:05:00Z', name: 'A', notes: '', status: 'completed' }
const exercise: WorkoutExercise = { id: 'we-1', workoutId: 'w-1', exerciseId: 'bench', order: 0, notes: '', restSeconds: 90, snapshot: { name: 'Bench Press', equipment: ['barbell'], movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }], catalogVersion: 'v1' } }
const set: WorkoutSet = { id: 's-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', loadKg: 100, reps: 5, completed: true }

describe('progress metrics', () => {
  it('calculates a capped Epley estimate', () => { expect(estimatedOneRepMax(100, 5)).toBe(116.7); expect(estimatedOneRepMax(100, 40)).toBe(200) })

  it('groups personal records and volume by exercise', () => { expect(buildExerciseProgress([exercise], [set], [workout])).toEqual([{ exerciseId: 'bench', name: 'Bench Press', bestLoadKg: 100, estimatedOneRepMaxKg: 116.7, totalVolumeKg: 500, sessions: 1 }]) })

  it('excludes completed sets belonging to an active or discarded workout from records/volume', () => {
    const activeWorkout: Workout = { ...workout, id: 'w-active', status: 'active', endTime: undefined }
    const discardedWorkout: Workout = { ...workout, id: 'w-discarded', status: 'discarded' }
    const activeExercise: WorkoutExercise = { ...exercise, id: 'we-active', workoutId: 'w-active' }
    const discardedExercise: WorkoutExercise = { ...exercise, id: 'we-discarded', workoutId: 'w-discarded' }
    const activeSet: WorkoutSet = { ...set, id: 's-active', workoutExerciseId: 'we-active', loadKg: 999 }
    const discardedSet: WorkoutSet = { ...set, id: 's-discarded', workoutExerciseId: 'we-discarded', loadKg: 999 }

    const result = buildExerciseProgress(
      [exercise, activeExercise, discardedExercise],
      [set, activeSet, discardedSet],
      [workout, activeWorkout, discardedWorkout],
    )

    expect(result).toEqual([{ exerciseId: 'bench', name: 'Bench Press', bestLoadKg: 100, estimatedOneRepMaxKg: 116.7, totalVolumeKg: 500, sessions: 1 }])
  })

  it('calculates completed duration', () => {
    expect(workoutDurationMinutes(workout)).toBe(65)
  })

  describe('trainingConsistency', () => {
    it('reports the fraction of the window with a completed workout', () => {
      expect(trainingConsistency([workout], new Date('2026-09-12T00:00:00Z'), 4)).toBe(25)
    })

    it('ignores active and discarded workouts', () => {
      const active: Workout = { ...workout, id: 'w-active', status: 'active', endTime: undefined }
      const discarded: Workout = { ...workout, id: 'w-discarded', status: 'discarded' }
      expect(trainingConsistency([active, discarded], new Date('2026-09-12T00:00:00Z'), 4)).toBe(0)
    })

    it('never exceeds 100 even when many distinct weeks all have a completed workout', () => {
      // 9 weekly completed workouts against an 8-week window: this reproduces the previous
      // rolling-millisecond-window bug (56-day window spanning 9 distinct Monday-based weeks).
      const now = new Date(2026, 8, 16) // Wednesday 2026-09-16, local time
      const workouts: Workout[] = Array.from({ length: 9 }, (_, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() - i * 7)
        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return { id: `w-${i}`, date: iso, startTime: `${iso}T10:00:00Z`, endTime: `${iso}T11:00:00Z`, name: 'A', notes: '', status: 'completed' }
      })
      expect(trainingConsistency(workouts, now, 8)).toBe(100)
    })

    it('excludes a completed workout from exactly nine weeks ago (outside the 8-week window)', () => {
      const now = new Date(2026, 8, 16) // Wednesday 2026-09-16, local time (Monday of this week is 2026-09-14)
      const nineWeeksAgo = new Date(now)
      nineWeeksAgo.setDate(nineWeeksAgo.getDate() - 9 * 7)
      const iso = `${nineWeeksAgo.getFullYear()}-${String(nineWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(nineWeeksAgo.getDate()).padStart(2, '0')}`
      const workout9: Workout = { id: 'w-9', date: iso, startTime: `${iso}T10:00:00Z`, endTime: `${iso}T11:00:00Z`, name: 'A', notes: '', status: 'completed' }
      expect(trainingConsistency([workout9], now, 8)).toBe(0)
    })

    it('excludes a workout dated later this week than now — future dates never count', () => {
      const now = new Date(2026, 8, 14) // Monday 2026-09-14, local time
      const laterThisWeek: Workout = { id: 'w-later', date: '2026-09-16', startTime: '2026-09-16T10:00:00Z', endTime: '2026-09-16T11:00:00Z', name: 'A', notes: '', status: 'completed' }
      expect(trainingConsistency([laterThisWeek], now, 8)).toBe(0)
    })

    it('counts a workout dated today even when `now` is earlier in the day (local date-only comparison)', () => {
      const now = new Date(2026, 8, 16, 0, 5, 0) // Wednesday 2026-09-16, 00:05 local — just after local midnight
      const today: Workout = { id: 'w-today', date: '2026-09-16', startTime: '2026-09-16T22:00:00Z', endTime: '2026-09-16T23:00:00Z', name: 'A', notes: '', status: 'completed' }
      expect(trainingConsistency([today], now, 8)).toBe(Math.round(100 / 8))
    })
  })
})
