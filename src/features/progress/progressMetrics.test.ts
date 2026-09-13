import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import { buildExerciseProgress, estimatedOneRepMax, trainingConsistency, workoutDurationMinutes } from './progressMetrics'

const exercise: WorkoutExercise = { id: 'we-1', workoutId: 'w-1', exerciseId: 'bench', order: 0, notes: '', restSeconds: 90, snapshot: { name: 'Bench Press', equipment: ['barbell'], movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }], catalogVersion: 'v1' } }
const set: WorkoutSet = { id: 's-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', loadKg: 100, reps: 5, completed: true }

describe('progress metrics', () => {
  it('calculates a capped Epley estimate', () => { expect(estimatedOneRepMax(100, 5)).toBe(116.7); expect(estimatedOneRepMax(100, 40)).toBe(200) })
  it('groups personal records and volume by exercise', () => { expect(buildExerciseProgress([exercise], [set])).toEqual([{ exerciseId: 'bench', name: 'Bench Press', bestLoadKg: 100, estimatedOneRepMaxKg: 116.7, totalVolumeKg: 500, sessions: 1 }]) })
  it('calculates completed duration and weekly consistency', () => {
    const workout: Workout = { id: 'w-1', date: '2026-09-10', startTime: '2026-09-10T10:00:00Z', endTime: '2026-09-10T11:05:00Z', name: 'A', notes: '', status: 'completed' }
    expect(workoutDurationMinutes(workout)).toBe(65)
    expect(trainingConsistency([workout], new Date('2026-09-12T00:00:00Z'), 4)).toBe(25)
  })
})
