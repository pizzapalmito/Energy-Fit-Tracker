import { describe, expect, it } from 'vitest'
import type { WorkoutSet } from '../../domain/models'
import { DoubleProgressionEngine, PROGRESSION_CONFIG, PROGRESSION_GOAL_PRESETS } from './progressionEngine'

function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: 's', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', completed: true, ...overrides }
}

describe('PROGRESSION_GOAL_PRESETS', () => {
  it('matches the specified rep/set/rest presets for every goal', () => {
    expect(PROGRESSION_GOAL_PRESETS.strength).toEqual({ repRangeLow: 3, repRangeHigh: 6, setsLow: 3, setsHigh: 5, restSeconds: 180 })
    expect(PROGRESSION_GOAL_PRESETS.hypertrophy).toEqual({ repRangeLow: 6, repRangeHigh: 12, setsLow: 3, setsHigh: 4, restSeconds: 120 })
    expect(PROGRESSION_GOAL_PRESETS.general).toEqual({ repRangeLow: 8, repRangeHigh: 15, setsLow: 2, setsHigh: 4, restSeconds: 90 })
    expect(PROGRESSION_GOAL_PRESETS.endurance).toEqual({ repRangeLow: 12, repRangeHigh: 20, setsLow: 2, setsHigh: 4, restSeconds: 60 })
    expect(PROGRESSION_GOAL_PRESETS.maintenance).toEqual({ repRangeLow: 6, repRangeHigh: 15, setsLow: 2, setsHigh: 3, restSeconds: 120 })
  })
})

describe('DoubleProgressionEngine', () => {
  it('suggests repeat with no history', () => {
    const engine = new DoubleProgressionEngine()
    const result = engine.suggest([], 'hypertrophy', 2.5)
    expect(result.action).toBe('repeat')
  })

  it('increases load when all working sets reach the top of the range at target effort', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [
      set({ id: 's1', workoutExerciseId: 'e1', reps: 12, loadKg: 50, rir: 1, completedAt: '2026-01-01T00:00:00Z' }),
      set({ id: 's2', workoutExerciseId: 'e1', setNumber: 2, reps: 12, loadKg: 50, rir: 0, completedAt: '2026-01-01T00:01:00Z' }),
    ]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).toBe('increase_load')
    expect(result.targetLoadKg).toBe(52.5)
    expect(result.targetReps).toBe(PROGRESSION_GOAL_PRESETS.hypertrophy.repRangeLow)
  })

  it('does not increase load if reps are at the top of the range but effort is far from target', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [set({ workoutExerciseId: 'e1', reps: 12, loadKg: 50, rir: 4, completedAt: '2026-01-01T00:00:00Z' })]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).not.toBe('increase_load')
  })

  it('suggests increase_reps when reps have not yet reached the top of the range', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [set({ workoutExerciseId: 'e1', reps: 8, loadKg: 50, rir: 1, completedAt: '2026-01-01T00:00:00Z' })]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).toBe('increase_reps')
    expect(result.targetReps).toBe(9)
  })

  it('caps the suggested rep target at the top of the range', () => {
    const engine = new DoubleProgressionEngine()
    // 12 reps but rir too high to qualify for increase_load; increase_reps should still cap at repRangeHigh
    const history: WorkoutSet[] = [set({ workoutExerciseId: 'e1', reps: 12, loadKg: 50, rir: 3, completedAt: '2026-01-01T00:00:00Z' })]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).toBe('increase_reps')
    expect(result.targetReps).toBe(PROGRESSION_GOAL_PRESETS.hypertrophy.repRangeHigh)
  })

  it('repeats after a single failed exposure (below minimum reps)', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [set({ workoutExerciseId: 'e1', reps: 2, loadKg: 50, rir: 0, completedAt: '2026-01-01T00:00:00Z' })]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).toBe('repeat')
  })

  it('reduces load by 5% after two consecutive failed exposures', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [
      set({ workoutExerciseId: 'e1', reps: 2, loadKg: 50, rir: 0, completedAt: '2026-01-01T00:00:00Z' }),
      set({ workoutExerciseId: 'e2', reps: 3, loadKg: 50, rir: 0, completedAt: '2026-01-08T00:00:00Z' }),
    ]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).toBe('reduce_load')
    expect(result.targetLoadKg).toBe(47.5)
    expect(PROGRESSION_CONFIG.reduceLoadPercent).toBe(0.05)
  })

  it('deloads after three consecutive failed exposures', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [
      set({ workoutExerciseId: 'e1', reps: 2, loadKg: 50, rir: 0, completedAt: '2026-01-01T00:00:00Z' }),
      set({ workoutExerciseId: 'e2', reps: 3, loadKg: 50, rir: 0, completedAt: '2026-01-08T00:00:00Z' }),
      set({ workoutExerciseId: 'e3', reps: 3, loadKg: 50, rir: 0, completedAt: '2026-01-15T00:00:00Z' }),
    ]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).toBe('deload')
    expect(result.targetLoadKg).toBe(45)
    expect(PROGRESSION_CONFIG.deloadPercent).toBe(0.1)
  })

  it('a successful exposure resets the failure streak', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [
      set({ workoutExerciseId: 'e1', reps: 2, loadKg: 50, rir: 0, completedAt: '2026-01-01T00:00:00Z' }),
      set({ workoutExerciseId: 'e2', reps: 8, loadKg: 50, rir: 1, completedAt: '2026-01-08T00:00:00Z' }),
      set({ workoutExerciseId: 'e3', reps: 2, loadKg: 50, rir: 0, completedAt: '2026-01-15T00:00:00Z' }),
    ]
    const result = engine.suggest(history, 'hypertrophy', 2.5)
    expect(result.action).toBe('repeat')
  })

  it('is deterministic: identical inputs replay to identical output', () => {
    const engine = new DoubleProgressionEngine()
    const history: WorkoutSet[] = [set({ workoutExerciseId: 'e1', reps: 8, loadKg: 50, rir: 1, completedAt: '2026-01-01T00:00:00Z' })]
    const a = engine.suggest(history, 'hypertrophy', 2.5)
    const b = engine.suggest(history, 'hypertrophy', 2.5)
    expect(a).toEqual(b)
  })
})
