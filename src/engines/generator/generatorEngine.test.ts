import { describe, expect, it } from 'vitest'
import type { GeneratorInput, RecoveryResult } from '../../domain/contracts'
import type { Exercise } from '../../domain/models'
import { PROGRESSION_GOAL_PRESETS } from '../progression/progressionEngine'
import { DeterministicWorkoutGenerator, ESTIMATED_WORK_SECONDS_PER_SET, GENERATOR_ENGINE_VERSION, estimateExerciseSeconds } from './generatorEngine'

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex',
    name: 'Exercise',
    aliases: [],
    category: 'strength',
    movementPattern: 'push',
    difficulty: 'intermediate',
    mechanic: 'compound',
    equipment: ['barbell'],
    instructions: [],
    muscles: [{ muscleId: 'chest', weight: 1 }],
    defaultRestSeconds: 90,
    media: [],
    source: 'catalog',
    excluded: false,
    ...overrides,
  }
}

function input(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    goal: 'hypertrophy',
    split: 'push',
    durationMinutes: 60,
    availableEquipment: ['barbell', 'dumbbell', 'cable'],
    excludedExerciseIds: [],
    seed: 'seed-1',
    ...overrides,
  }
}

const catalog: Exercise[] = [
  exercise({ id: 'bench-press', movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }] }),
  exercise({ id: 'incline-press', movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }] }),
  exercise({ id: 'overhead-press', movementPattern: 'push', muscles: [{ muscleId: 'shoulders', weight: 1 }] }),
  exercise({ id: 'lateral-raise', movementPattern: 'raise', muscles: [{ muscleId: 'shoulders', weight: 1 }], mechanic: 'isolation' }),
  exercise({ id: 'triceps-pushdown', movementPattern: 'extension', muscles: [{ muscleId: 'triceps', weight: 1 }], equipment: ['cable'], mechanic: 'isolation' }),
]

const recovery: RecoveryResult[] = [
  { muscleId: 'chest', calculatedRecovery: 90, recommendationReadiness: 90, explanation: [], algorithmVersion: 'v' },
  { muscleId: 'shoulders', calculatedRecovery: 60, recommendationReadiness: 60, explanation: [], algorithmVersion: 'v' },
  { muscleId: 'triceps', calculatedRecovery: 80, recommendationReadiness: 80, explanation: [], algorithmVersion: 'v' },
]

describe('DeterministicWorkoutGenerator', () => {
  it('stamps the engine version and echoes the seed', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input(), catalog, recovery)
    expect(result.engineVersion).toBe(GENERATOR_ENGINE_VERSION)
    expect(result.seed).toBe('seed-1')
  })

  it('excludes explicitly excluded exercise ids', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input({ excludedExerciseIds: ['bench-press', 'incline-press'] }), catalog, recovery)
    expect(result.exercises.some((e) => e.exerciseId === 'bench-press' || e.exerciseId === 'incline-press')).toBe(false)
  })

  it('excludes exercises flagged excluded on the catalog entry', () => {
    const generator = new DeterministicWorkoutGenerator()
    const flagged = [...catalog, exercise({ id: 'banned', excluded: true, muscles: [{ muscleId: 'chest', weight: 1 }] })]
    const result = generator.generate(input(), flagged, recovery)
    expect(result.exercises.some((e) => e.exerciseId === 'banned')).toBe(false)
  })

  it('filters out exercises requiring unavailable equipment', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input({ availableEquipment: ['barbell'] }), catalog, recovery)
    expect(result.exercises.some((e) => e.exerciseId === 'triceps-pushdown')).toBe(false)
  })

  it('always allows bodyweight exercises regardless of available equipment', () => {
    const generator = new DeterministicWorkoutGenerator()
    const withBodyweight = [...catalog, exercise({ id: 'pushup', equipment: ['bodyweight'], muscles: [{ muscleId: 'chest', weight: 1 }] })]
    const result = generator.generate(input({ availableEquipment: [] }), withBodyweight, recovery)
    expect(result.exercises.length).toBeGreaterThan(0)
  })

  it('applies the goal preset rep range, set count, and rest seconds', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input({ goal: 'strength' }), catalog, recovery)
    for (const entry of result.exercises) {
      expect(entry.repRange).toEqual([3, 6])
      expect(entry.sets).toBe(5)
      expect(entry.restSeconds).toBe(180)
    }
  })

  it('caps exercises per movement pattern to avoid over-representation', () => {
    const generator = new DeterministicWorkoutGenerator()
    const samePattern = [
      exercise({ id: 'a', movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }] }),
      exercise({ id: 'b', movementPattern: 'push', muscles: [{ muscleId: 'shoulders', weight: 1 }] }),
      exercise({ id: 'c', movementPattern: 'push', muscles: [{ muscleId: 'triceps', weight: 1 }] }),
    ]
    const result = generator.generate(input({ durationMinutes: 300 }), samePattern, recovery)
    expect(result.exercises.length).toBeLessThanOrEqual(2)
  })

  it('surfaces a recommended load from recentSuccessfulLoadByExerciseId', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input({ recentSuccessfulLoadByExerciseId: { 'bench-press': 80 } }), catalog, recovery)
    const benchEntry = result.exercises.find((e) => e.exerciseId === 'bench-press')
    expect(benchEntry?.recommendedLoadKg).toBe(80)
  })

  it('produces score explanations for each planned exercise', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input(), catalog, recovery)
    for (const entry of result.exercises) {
      expect(entry.reasons.length).toBeGreaterThan(0)
    }
  })

  it('breaks equal-score exercise ties by ascending stable id', () => {
    const generator = new DeterministicWorkoutGenerator()
    const tied = [
      exercise({ id: 'zzz', muscles: [{ muscleId: 'chest', weight: 1 }], mechanic: 'isolation' }),
      exercise({ id: 'aaa', muscles: [{ muscleId: 'chest', weight: 1 }], mechanic: 'isolation' }),
    ]
    const result = generator.generate(input(), tied, recovery)
    expect(result.exercises[0]?.exerciseId).toBe('aaa')
  })

  it('is deterministic: same seed and inputs replay to an identical plan', () => {
    const generator = new DeterministicWorkoutGenerator()
    const a = generator.generate(input(), catalog, recovery)
    const b = generator.generate(input(), catalog, recovery)
    expect(a).toEqual(b)
  })

  it('can produce a different plan for a different seed', () => {
    const generator = new DeterministicWorkoutGenerator()
    const a = generator.generate(input({ seed: 'seed-a' }), catalog, recovery)
    const b = generator.generate(input({ seed: 'seed-b' }), catalog, recovery)
    expect(a.seed).not.toBe(b.seed)
  })
})

describe('DeterministicWorkoutGenerator duration budget', () => {
  const goal = 'general' as const
  const preset = PROGRESSION_GOAL_PRESETS.general
  const costPerExercise = estimateExerciseSeconds(preset.setsHigh, preset.restSeconds)
  const durationCatalog: Exercise[] = [
    exercise({ id: 'chest-1', movementPattern: 'press-chest', muscles: [{ muscleId: 'chest', weight: 1 }] }),
    exercise({ id: 'shoulder-1', movementPattern: 'press-shoulder', muscles: [{ muscleId: 'shoulders', weight: 1 }] }),
    exercise({ id: 'triceps-1', movementPattern: 'extension', muscles: [{ muscleId: 'triceps', weight: 1 }] }),
  ]

  it('sanity: ESTIMATED_WORK_SECONDS_PER_SET feeds the cost formula', () => {
    expect(costPerExercise).toBe(preset.setsHigh * ESTIMATED_WORK_SECONDS_PER_SET + (preset.setsHigh - 1) * preset.restSeconds)
  })

  it('returns zero exercises when the budget cannot fit even one (including the first)', () => {
    const generator = new DeterministicWorkoutGenerator()
    const tooSmallMinutes = (costPerExercise - 1) / 60
    const result = generator.generate(input({ goal, durationMinutes: tooSmallMinutes }), durationCatalog, recovery)
    expect(result.exercises).toHaveLength(0)
    expect(result.estimatedDurationSeconds).toBe(0)
  })

  it('fits exactly one exercise at the exact boundary', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input({ goal, durationMinutes: costPerExercise / 60 }), durationCatalog, recovery)
    expect(result.exercises).toHaveLength(1)
    expect(result.estimatedDurationSeconds).toBe(costPerExercise)
  })

  it('fits multiple exercises without exceeding the budget', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(input({ goal, durationMinutes: (costPerExercise * 2) / 60 }), durationCatalog, recovery)
    expect(result.exercises).toHaveLength(2)
    expect(result.estimatedDurationSeconds).toBe(costPerExercise * 2)
  })

  it('never returns an estimated duration exceeding the requested budget, across a range of durations', () => {
    const generator = new DeterministicWorkoutGenerator()
    for (const minutes of [0, 1, 5, 10, 30, 60]) {
      const result = generator.generate(input({ goal, durationMinutes: minutes }), durationCatalog, recovery)
      expect(result.estimatedDurationSeconds).toBeLessThanOrEqual(minutes * 60)
    }
  })
})

describe('DeterministicWorkoutGenerator split targeting', () => {
  const splitCatalog: Exercise[] = [
    exercise({ id: 'bench-press', movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }] }),
    exercise({ id: 'overhead-press', movementPattern: 'press', muscles: [{ muscleId: 'shoulders', weight: 1 }] }),
    exercise({ id: 'triceps-pushdown', movementPattern: 'extension', muscles: [{ muscleId: 'triceps', weight: 1 }], equipment: ['cable'] }),
    exercise({ id: 'pull-up', movementPattern: 'pull', muscles: [{ muscleId: 'lats', weight: 1 }] }),
    exercise({ id: 'barbell-row', movementPattern: 'row', muscles: [{ muscleId: 'middle-back', weight: 1 }] }),
    exercise({ id: 'back-squat', movementPattern: 'squat', muscles: [{ muscleId: 'quadriceps', weight: 1 }] }),
    exercise({ id: 'romanian-deadlift', movementPattern: 'hinge', muscles: [{ muscleId: 'hamstrings', weight: 1 }] }),
  ]
  const splitRecovery: RecoveryResult[] = [
    { muscleId: 'chest', calculatedRecovery: 90, recommendationReadiness: 90, explanation: [], algorithmVersion: 'v' },
    { muscleId: 'shoulders', calculatedRecovery: 85, recommendationReadiness: 85, explanation: [], algorithmVersion: 'v' },
    { muscleId: 'triceps', calculatedRecovery: 80, recommendationReadiness: 80, explanation: [], algorithmVersion: 'v' },
    { muscleId: 'lats', calculatedRecovery: 95, recommendationReadiness: 95, explanation: [], algorithmVersion: 'v' },
    { muscleId: 'middle-back', calculatedRecovery: 92, recommendationReadiness: 92, explanation: [], algorithmVersion: 'v' },
    { muscleId: 'quadriceps', calculatedRecovery: 88, recommendationReadiness: 88, explanation: [], algorithmVersion: 'v' },
    { muscleId: 'hamstrings', calculatedRecovery: 87, recommendationReadiness: 87, explanation: [], algorithmVersion: 'v' },
  ]
  const wideEquipment = ['barbell', 'dumbbell', 'cable']

  it('push cannot select pull or leg exercises', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(
      input({ split: 'push', durationMinutes: 120, availableEquipment: wideEquipment }),
      splitCatalog,
      splitRecovery,
    )
    const ids = result.exercises.map((e) => e.exerciseId)
    expect(ids).toEqual(expect.arrayContaining(['bench-press', 'overhead-press', 'triceps-pushdown']))
    expect(ids.some((id) => ['pull-up', 'barbell-row', 'back-squat', 'romanian-deadlift'].includes(id))).toBe(false)
  })

  it('lower selects only lower-body targets', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(
      input({ split: 'lower', durationMinutes: 120, availableEquipment: wideEquipment }),
      splitCatalog,
      splitRecovery,
    )
    const ids = result.exercises.map((e) => e.exerciseId)
    expect(ids).toEqual(expect.arrayContaining(['back-squat', 'romanian-deadlift']))
    expect(ids.some((id) => ['bench-press', 'pull-up', 'barbell-row'].includes(id))).toBe(false)
  })

  it('custom split honors its explicit target muscle list only', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(
      input({ split: 'custom', customTargetMuscleIds: ['triceps'], durationMinutes: 120, availableEquipment: wideEquipment }),
      splitCatalog,
      splitRecovery,
    )
    expect(result.exercises.map((e) => e.exerciseId)).toEqual(['triceps-pushdown'])
  })

  it('custom split with no target list selects nothing', () => {
    const generator = new DeterministicWorkoutGenerator()
    const result = generator.generate(
      input({ split: 'custom', durationMinutes: 120, availableEquipment: wideEquipment }),
      splitCatalog,
      splitRecovery,
    )
    expect(result.exercises).toHaveLength(0)
  })

  it('produces an identical plan for identical split input (stable/deterministic)', () => {
    const generator = new DeterministicWorkoutGenerator()
    const a = generator.generate(
      input({ split: 'upper', durationMinutes: 120, availableEquipment: wideEquipment }),
      splitCatalog,
      splitRecovery,
    )
    const b = generator.generate(
      input({ split: 'upper', durationMinutes: 120, availableEquipment: wideEquipment }),
      splitCatalog,
      splitRecovery,
    )
    expect(a).toEqual(b)
  })
})
