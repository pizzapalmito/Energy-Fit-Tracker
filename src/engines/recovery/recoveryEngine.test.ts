import { describe, expect, it } from 'vitest'
import type { RecoveryFeedback, Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import {
  DeterministicRecoveryEngine,
  FATIGUE_POINTS_PER_STIMULUS_POINT,
  RECOVERY_HALF_LIFE_HOURS,
  RIR_MULTIPLIERS,
  SET_TYPE_MULTIPLIERS,
  SUBJECTIVE_READINESS_OFFSETS,
} from './recoveryEngine'

const NOW = '2026-01-10T00:00:00.000Z'

function workoutExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: 'we-1',
    workoutId: 'w-1',
    exerciseId: 'bench-press',
    order: 0,
    notes: '',
    restSeconds: 90,
    snapshot: { name: 'Bench Press', equipment: ['barbell'], movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }], catalogVersion: 'test' },
    ...overrides,
  }
}

function completedSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: 's-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', completed: true, completedAt: NOW, ...overrides }
}

function activeWorkout(overrides: Partial<Workout> = {}): Workout {
  return { id: 'w-1', date: '2026-01-10', startTime: NOW, name: 'Push Day', notes: '', status: 'completed', ...overrides }
}

describe('DeterministicRecoveryEngine', () => {
  it('computes fatigue = setType * effort * 12 for a single working set at RIR 2 (multiplier 1.0)', () => {
    const engine = new DeterministicRecoveryEngine()
    const results = engine.calculate(
      NOW,
      [activeWorkout()],
      [workoutExercise()],
      [completedSet({ rir: 2, completedAt: NOW })],
      [],
    )
    const chest = results.find((r) => r.muscleId === 'chest')!
    const expectedFatigue = SET_TYPE_MULTIPLIERS.working * RIR_MULTIPLIERS['2'] * FATIGUE_POINTS_PER_STIMULUS_POINT
    expect(chest.calculatedRecovery).toBeCloseTo(100 - expectedFatigue, 5)
  })

  it.each([
    ['warmup', SET_TYPE_MULTIPLIERS.warmup],
    ['working', SET_TYPE_MULTIPLIERS.working],
    ['backoff', SET_TYPE_MULTIPLIERS.backoff],
    ['dropset', SET_TYPE_MULTIPLIERS.dropset],
    ['failure', SET_TYPE_MULTIPLIERS.failure],
  ] as const)('applies the %s set-type multiplier (%d)', (type, multiplier) => {
    const engine = new DeterministicRecoveryEngine()
    const results = engine.calculate(
      NOW,
      [activeWorkout()],
      [workoutExercise()],
      [completedSet({ type, rir: 2 })],
      [],
    )
    const chest = results.find((r) => r.muscleId === 'chest')!
    const expectedFatigue = multiplier * RIR_MULTIPLIERS['2'] * FATIGUE_POINTS_PER_STIMULUS_POINT
    expect(100 - chest.calculatedRecovery).toBeCloseTo(expectedFatigue, 5)
  })

  it.each([
    [0, RIR_MULTIPLIERS['0']],
    [1, RIR_MULTIPLIERS['1']],
    [2, RIR_MULTIPLIERS['2']],
    [3, RIR_MULTIPLIERS['3']],
    [4, RIR_MULTIPLIERS['4plus']],
    [5, RIR_MULTIPLIERS['4plus']],
  ])('applies the RIR=%d multiplier (%d)', (rir, multiplier) => {
    const engine = new DeterministicRecoveryEngine()
    const results = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir })], [])
    const chest = results.find((r) => r.muscleId === 'chest')!
    const expectedFatigue = SET_TYPE_MULTIPLIERS.working * multiplier * FATIGUE_POINTS_PER_STIMULUS_POINT
    expect(100 - chest.calculatedRecovery).toBeCloseTo(expectedFatigue, 5)
  })

  it('derives RIR as 10 - RPE when only RPE is present', () => {
    const engine = new DeterministicRecoveryEngine()
    const withRpe = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rpe: 8 })], [])
    const withRir = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: 2 })], [])
    expect(withRpe.find((r) => r.muscleId === 'chest')!.calculatedRecovery).toBeCloseTo(
      withRir.find((r) => r.muscleId === 'chest')!.calculatedRecovery,
      5,
    )
  })

  it('defaults the effort multiplier to 1.0 when neither RIR nor RPE is present', () => {
    const engine = new DeterministicRecoveryEngine()
    const results = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: undefined, rpe: undefined })], [])
    const chest = results.find((r) => r.muscleId === 'chest')!
    const expectedFatigue = SET_TYPE_MULTIPLIERS.working * 1.0 * FATIGUE_POINTS_PER_STIMULUS_POINT
    expect(100 - chest.calculatedRecovery).toBeCloseTo(expectedFatigue, 5)
  })

  it('ignores incomplete sets', () => {
    const engine = new DeterministicRecoveryEngine()
    const results = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ completed: false })], [])
    expect(results.find((r) => r.muscleId === 'chest')).toBeUndefined()
  })

  it('ignores sets belonging to a discarded workout', () => {
    const engine = new DeterministicRecoveryEngine()
    const results = engine.calculate(
      NOW,
      [activeWorkout({ status: 'discarded' })],
      [workoutExercise()],
      [completedSet()],
      [],
    )
    expect(results.find((r) => r.muscleId === 'chest')).toBeUndefined()
  })

  it('sums repeated fatigue across multiple sets and clamps at 100', () => {
    const engine = new DeterministicRecoveryEngine()
    const sets = Array.from({ length: 20 }, (_, i) => completedSet({ id: `s-${i}`, setNumber: i, rir: 0, type: 'failure' }))
    const results = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], sets, [])
    const chest = results.find((r) => r.muscleId === 'chest')!
    expect(chest.calculatedRecovery).toBe(0)
  })

  it('applies exponential decay with a 36-hour half-life', () => {
    const engine = new DeterministicRecoveryEngine()
    const completedAt = new Date(Date.parse(NOW) - RECOVERY_HALF_LIFE_HOURS * 3_600_000).toISOString()
    const freshResults = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: 2, completedAt: NOW })], [])
    const decayedResults = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: 2, completedAt })], [])
    const freshFatigue = 100 - freshResults.find((r) => r.muscleId === 'chest')!.calculatedRecovery
    const decayedFatigue = 100 - decayedResults.find((r) => r.muscleId === 'chest')!.calculatedRecovery
    expect(decayedFatigue).toBeCloseTo(freshFatigue * 0.5, 5)
  })

  it('snapshots muscle contributions from the WorkoutExercise, not a live catalog', () => {
    const engine = new DeterministicRecoveryEngine()
    const snapshotWithTwoMuscles = workoutExercise({
      snapshot: {
        name: 'Bench Press',
        equipment: ['barbell'],
        movementPattern: 'push',
        muscles: [
          { muscleId: 'chest', weight: 1 },
          { muscleId: 'triceps', weight: 0.5 },
        ],
        catalogVersion: 'test',
      },
    })
    const results = engine.calculate(NOW, [activeWorkout()], [snapshotWithTwoMuscles], [completedSet({ rir: 2 })], [])
    const chest = results.find((r) => r.muscleId === 'chest')!
    const triceps = results.find((r) => r.muscleId === 'triceps')!
    expect(100 - triceps.calculatedRecovery).toBeCloseTo((100 - chest.calculatedRecovery) * 0.5, 5)
  })

  it.each([
    ['very_sore', SUBJECTIVE_READINESS_OFFSETS.very_sore],
    ['sore', SUBJECTIVE_READINESS_OFFSETS.sore],
    ['normal', SUBJECTIVE_READINESS_OFFSETS.normal],
    ['fresh', SUBJECTIVE_READINESS_OFFSETS.fresh],
  ] as const)('applies the %s subjective offset (%d) to readiness', (state, offset) => {
    const engine = new DeterministicRecoveryEngine()
    const feedback: RecoveryFeedback[] = [{ id: 'f-1', muscleId: 'chest', date: '2026-01-10', subjectiveState: state }]
    const results = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: 2 })], feedback)
    const chest = results.find((r) => r.muscleId === 'chest')!
    expect(chest.recommendationReadiness).toBe(Math.min(100, Math.max(0, chest.calculatedRecovery + offset)))
  })

  it('clamps recommendationReadiness to 0..100 without distorting calculatedRecovery', () => {
    const engine = new DeterministicRecoveryEngine()
    const feedback: RecoveryFeedback[] = [{ id: 'f-1', muscleId: 'chest', date: '2026-01-10', subjectiveState: 'fresh' }]
    const results = engine.calculate(
      NOW,
      [activeWorkout()],
      [workoutExercise()],
      [completedSet({ type: 'warmup', rir: 4, completedAt: NOW })],
      feedback,
    )
    const chest = results.find((r) => r.muscleId === 'chest')!
    // A single decayed warmup set still leaves nonzero fatigue: 0.25 (warmup) * 0.75 (RIR>=4) * 12 = 2.25.
    const expectedFatigue = SET_TYPE_MULTIPLIERS.warmup * RIR_MULTIPLIERS['4plus'] * FATIGUE_POINTS_PER_STIMULUS_POINT
    expect(chest.calculatedRecovery).toBeCloseTo(100 - expectedFatigue, 5)
    // calculatedRecovery (97.75) + fresh offset (+10) = 107.75, which must clamp to 100.
    expect(chest.recommendationReadiness).toBe(100)
  })

  it('ignores feedback dated after `now`', () => {
    const engine = new DeterministicRecoveryEngine()
    const feedback: RecoveryFeedback[] = [{ id: 'f-1', muscleId: 'chest', date: '2026-06-01', subjectiveState: 'very_sore' }]
    const results = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: 2 })], feedback)
    const chest = results.find((r) => r.muscleId === 'chest')!
    expect(chest.recommendationReadiness).toBe(chest.calculatedRecovery)
  })

  it('returns a muscle entry from feedback alone even with no sets', () => {
    const engine = new DeterministicRecoveryEngine()
    const feedback: RecoveryFeedback[] = [{ id: 'f-1', muscleId: 'hamstrings', date: '2026-01-10', subjectiveState: 'sore' }]
    const results = engine.calculate(NOW, [], [], [], feedback)
    const hamstrings = results.find((r) => r.muscleId === 'hamstrings')!
    expect(hamstrings.calculatedRecovery).toBe(100)
    expect(hamstrings.recommendationReadiness).toBe(85)
  })

  it('is a pure function: identical inputs produce identical results', () => {
    const engine = new DeterministicRecoveryEngine()
    const a = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: 2 })], [])
    const b = engine.calculate(NOW, [activeWorkout()], [workoutExercise()], [completedSet({ rir: 2 })], [])
    expect(a).toEqual(b)
  })
})
