import type { Exercise } from '../domain/models'
import type { Muscle } from '../data/types'

/** Shape accepted from free-exercise-db-style JSON records (all fields optional/nullable in the wild). */
export interface RawExerciseRecord {
  id?: string | null
  name?: string | null
  force?: string | null
  level?: string | null
  mechanic?: string | null
  equipment?: string | null
  primaryMuscles?: unknown
  secondaryMuscles?: unknown
  instructions?: unknown
  category?: string | null
  images?: unknown
}

export interface ImportRejection {
  index: number
  reason: string
  raw: unknown
}

export interface ImportResult {
  exercises: Exercise[]
  muscles: Muscle[]
  rejected: ImportRejection[]
}
