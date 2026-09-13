import type { Exercise } from '../../domain/models'

export interface ExerciseFilters {
  query: string
  muscleId: string
  equipment: string
  difficulty: Exercise['difficulty'] | 'all'
  movementPattern: string
}

export const ALL = 'all'

export const DEFAULT_FILTERS: ExerciseFilters = {
  query: '',
  muscleId: ALL,
  equipment: ALL,
  difficulty: ALL,
  movementPattern: ALL,
}

export function hasActiveFilters(filters: ExerciseFilters): boolean {
  return filters.query.trim() !== '' || filters.muscleId !== ALL || filters.equipment !== ALL || filters.difficulty !== ALL || filters.movementPattern !== ALL
}

function matchesQuery(exercise: Exercise, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (exercise.name.toLowerCase().includes(q)) return true
  if (exercise.aliases.some((alias) => alias.toLowerCase().includes(q))) return true
  if (exercise.instructions.some((step) => step.toLowerCase().includes(q))) return true
  return false
}

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  return exercises.filter((exercise) => {
    if (!matchesQuery(exercise, filters.query)) return false
    if (filters.muscleId !== ALL && !exercise.muscles.some((m) => m.muscleId === filters.muscleId)) return false
    if (filters.equipment !== ALL && !exercise.equipment.includes(filters.equipment)) return false
    if (filters.difficulty !== ALL && exercise.difficulty !== filters.difficulty) return false
    if (filters.movementPattern !== ALL && exercise.movementPattern !== filters.movementPattern) return false
    return true
  })
}

export interface FilterOptions {
  equipment: string[]
  movementPatterns: string[]
}

export function collectFilterOptions(exercises: Exercise[]): FilterOptions {
  const equipment = new Set<string>()
  const movementPatterns = new Set<string>()
  for (const exercise of exercises) {
    for (const item of exercise.equipment) equipment.add(item)
    movementPatterns.add(exercise.movementPattern)
  }
  return { equipment: [...equipment].sort(), movementPatterns: [...movementPatterns].sort() }
}
