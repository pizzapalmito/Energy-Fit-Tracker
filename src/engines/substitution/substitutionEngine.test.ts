import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../domain/models'
import { SUBSTITUTION_WEIGHTS, WeightedSubstitutionEngine } from './substitutionEngine'

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
    muscles: [
      { muscleId: 'chest', weight: 1 },
      { muscleId: 'triceps', weight: 0.5 },
    ],
    defaultRestSeconds: 120,
    media: [],
    source: 'catalog',
    excluded: false,
    ...overrides,
  }
}

describe('WeightedSubstitutionEngine', () => {
  it('scores an identical-profile candidate at the maximum 100 points', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidate = exercise({ id: 'other-press', name: 'Other Press' })
    const [result] = engine.rank(source, [candidate], ['barbell'])
    expect(result!.score).toBeCloseTo(100, 5)
  })

  it('splits points exactly across the five weighted factors (total 100)', () => {
    const total = Object.values(SUBSTITUTION_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('awards 0 movement points when the movement pattern differs', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidate = exercise({ id: 'cable-fly', movementPattern: 'fly' })
    const [result] = engine.rank(source, [candidate], ['barbell'])
    expect(result!.reasons.some((r) => r.includes(`0/${SUBSTITUTION_WEIGHTS.exactMovement}`))).toBe(true)
  })

  it('scales difficulty proximity linearly with ordinal distance', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise({ difficulty: 'beginner' })
    const near = exercise({ id: 'near', difficulty: 'intermediate' })
    const far = exercise({ id: 'far', difficulty: 'advanced' })
    const [nearResult] = engine.rank(source, [near], ['barbell'])
    const [farResult] = engine.rank(source, [far], ['barbell'])
    expect(nearResult!.score).toBeGreaterThan(farResult!.score)
  })

  it('filters out the current/source exercise', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const results = engine.rank(source, [source], ['barbell'])
    expect(results).toHaveLength(0)
  })

  it('filters out exercises flagged excluded', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const excluded = exercise({ id: 'excluded-ex', excluded: true })
    const results = engine.rank(source, [excluded], ['barbell'])
    expect(results).toHaveLength(0)
  })

  it('filters out candidates requiring unavailable equipment', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const needsCable = exercise({ id: 'cable-press', equipment: ['cable'] })
    const results = engine.rank(source, [needsCable], ['barbell'])
    expect(results).toHaveLength(0)
  })

  it('always allows bodyweight candidates regardless of the available-equipment list', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const pushup = exercise({ id: 'pushup', equipment: ['bodyweight'] })
    const results = engine.rank(source, [pushup], [])
    expect(results).toHaveLength(1)
  })

  it('breaks equal-score ties by ascending exercise id', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidateB = exercise({ id: 'zzz-clone' })
    const candidateA = exercise({ id: 'aaa-clone' })
    const results = engine.rank(source, [candidateB, candidateA], ['barbell'])
    expect(results.map((r) => r.exercise.id)).toEqual(['aaa-clone', 'zzz-clone'])
  })

  it('returns non-empty explanations for every scored candidate', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidate = exercise({ id: 'incline-press', movementPattern: 'incline-push' })
    const [result] = engine.rank(source, [candidate], ['barbell'])
    expect(result!.reasons.length).toBe(5)
  })
})
