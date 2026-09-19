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
  it('scores a same-area candidate using different equipment at the maximum 100 points', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidate = exercise({ id: 'dumbbell-press', name: 'Dumbbell Press', equipment: ['dumbbell'] })
    const [result] = engine.rank(source, [candidate], ['barbell', 'dumbbell'])
    expect(result!.score).toBeCloseTo(100, 5)
  })

  it('splits points exactly across the five weighted factors (total 100)', () => {
    const total = Object.values(SUBSTITUTION_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('awards 0 movement points when the movement pattern differs', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidate = exercise({ id: 'cable-fly', movementPattern: 'fly', equipment: ['cable'] })
    const [result] = engine.rank(source, [candidate], ['barbell', 'cable'])
    expect(result!.reasons.some((r) => r.includes(`0/${SUBSTITUTION_WEIGHTS.exactMovement}`))).toBe(true)
  })

  it('scales difficulty proximity linearly with ordinal distance', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise({ difficulty: 'beginner' })
    const near = exercise({ id: 'near', difficulty: 'intermediate', equipment: ['dumbbell'] })
    const far = exercise({ id: 'far', difficulty: 'advanced', equipment: ['cable'] })
    const [nearResult] = engine.rank(source, [near], ['barbell', 'dumbbell', 'cable'])
    const [farResult] = engine.rank(source, [far], ['barbell', 'dumbbell', 'cable'])
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
    const excluded = exercise({ id: 'excluded-ex', excluded: true, equipment: ['dumbbell'] })
    const results = engine.rank(source, [excluded], ['barbell', 'dumbbell'])
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

  it('filters out candidates that reuse the source equipment', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise({ equipment: ['barbell'] })
    const sameStation = exercise({ id: 'incline-barbell-press', equipment: ['barbell'] })
    const mixedStation = exercise({ id: 'barbell-band-press', equipment: ['barbell', 'bands'] })
    const results = engine.rank(source, [sameStation, mixedStation], ['barbell', 'bands'])
    expect(results).toHaveLength(0)
  })

  it('filters out different-equipment candidates targeting another primary muscle area', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const shoulderPress = exercise({
      id: 'shoulder-press',
      equipment: ['dumbbell'],
      muscles: [{ muscleId: 'shoulders', weight: 1 }],
    })
    const results = engine.rank(source, [shoulderPress], ['barbell', 'dumbbell'])
    expect(results).toHaveLength(0)
  })

  it('ranks only same-area alternatives from different equipment stations', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const sameEquipment = exercise({ id: 'incline-barbell-press', equipment: ['barbell'] })
    const wrongArea = exercise({ id: 'dumbbell-row', equipment: ['dumbbell'], muscles: [{ muscleId: 'back', weight: 1 }] })
    const validCable = exercise({ id: 'cable-press', equipment: ['cable'] })
    const validBodyweight = exercise({ id: 'push-up', equipment: ['bodyweight'] })

    const results = engine.rank(
      source,
      [sameEquipment, wrongArea, validCable, validBodyweight],
      ['barbell', 'dumbbell', 'cable'],
    )

    expect(results.map((result) => result.exercise.id)).toEqual(['cable-press', 'push-up'])
    expect(results.every((result) => result.reasons.some((reason) => reason.startsWith('different equipment')))).toBe(true)
  })

  it('breaks equal-score ties by ascending exercise id', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidateB = exercise({ id: 'zzz-clone', equipment: ['dumbbell'] })
    const candidateA = exercise({ id: 'aaa-clone', equipment: ['dumbbell'] })
    const results = engine.rank(source, [candidateB, candidateA], ['barbell', 'dumbbell'])
    expect(results.map((r) => r.exercise.id)).toEqual(['aaa-clone', 'zzz-clone'])
  })

  it('returns non-empty explanations for every scored candidate', () => {
    const engine = new WeightedSubstitutionEngine()
    const source = exercise()
    const candidate = exercise({ id: 'incline-press', movementPattern: 'incline-push', equipment: ['dumbbell'] })
    const [result] = engine.rank(source, [candidate], ['barbell', 'dumbbell'])
    expect(result!.reasons.length).toBe(5)
  })
})
