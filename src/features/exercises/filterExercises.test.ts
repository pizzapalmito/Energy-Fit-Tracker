import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../domain/models'
import { DEFAULT_FILTERS, collectFilterOptions, filterExercises, hasActiveFilters } from './filterExercises'

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
    instructions: ['Lie on the bench.', 'Press the bar up.'],
    muscles: [{ muscleId: 'chest', weight: 1 }, { muscleId: 'triceps', weight: 0.5 }],
    defaultRestSeconds: 120,
    media: [],
    source: 'catalog',
    excluded: false,
    ...overrides,
  }
}

const squat = exercise({
  id: 'squat',
  name: 'Squat',
  aliases: ['Back Squat'],
  movementPattern: 'legs',
  equipment: ['barbell'],
  difficulty: 'advanced',
  muscles: [{ muscleId: 'quadriceps', weight: 1 }],
  instructions: ['Bend the knees.'],
})
const pushUp = exercise({
  id: 'push-up',
  name: 'Push-Up',
  equipment: ['bodyweight'],
  difficulty: 'beginner',
  movementPattern: 'push',
  muscles: [{ muscleId: 'chest', weight: 1 }],
})

const all = [exercise(), squat, pushUp]

describe('filterExercises', () => {
  it('returns everything for the default filters', () => {
    expect(filterExercises(all, DEFAULT_FILTERS)).toHaveLength(3)
  })

  it('matches by name, case-insensitively', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, query: 'squat' }).map((e) => e.id)).toEqual(['squat'])
  })

  it('matches by alias', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, query: 'back squat' }).map((e) => e.id)).toEqual(['squat'])
  })

  it('matches by instruction text', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, query: 'bend the knees' }).map((e) => e.id)).toEqual(['squat'])
  })

  it('filters by muscle', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, muscleId: 'quadriceps' }).map((e) => e.id)).toEqual(['squat'])
  })

  it('filters by equipment', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, equipment: 'bodyweight' }).map((e) => e.id)).toEqual(['push-up'])
  })

  it('filters by difficulty', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, difficulty: 'beginner' }).map((e) => e.id)).toEqual(['push-up'])
  })

  it('filters by movement pattern', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, movementPattern: 'legs' }).map((e) => e.id)).toEqual(['squat'])
  })

  it('combines multiple active filters with AND semantics', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, movementPattern: 'push', equipment: 'barbell' }).map((e) => e.id)).toEqual(['bench-press'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterExercises(all, { ...DEFAULT_FILTERS, query: 'nonexistent exercise' })).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('is false for the default filters', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('is true once any field diverges from the default', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: 'row' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, difficulty: 'beginner' })).toBe(true)
  })
})

describe('collectFilterOptions', () => {
  it('collects unique, sorted equipment and movement patterns', () => {
    expect(collectFilterOptions(all)).toEqual({
      equipment: ['barbell', 'bodyweight'],
      movementPatterns: ['legs', 'push'],
    })
  })
})
