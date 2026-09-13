import type { EntityId, Exercise, ISODateTime, TrainingGoal } from '../domain/models'
import type { GeneratedWorkout, GeneratorInput, WorkoutSplit } from '../domain/contracts'
import type { SupportedLocale } from '../i18n/locale'

/**
 * Persistence-layer entities that are not part of the senior-owned domain
 * contracts (src/domain/contracts.ts, src/domain/models.ts) but are required
 * to back the Dexie schema (muscle catalog, equipment profiles, settings,
 * generated plan history, and schema/catalog bookkeeping).
 */

export interface Muscle {
  id: EntityId
  name: string
  group: string
  aliases: string[]
}

export interface EquipmentProfile {
  id: EntityId
  name: string
  availableEquipment: string[]
  isDefault: boolean
}

export interface AppSettings {
  id: EntityId
  unit: 'kg' | 'lb'
  activeEquipmentProfileId?: EntityId
  theme?: string
  lastBackupAt?: ISODateTime
  trainingGoal?: TrainingGoal
  preferredSplit?: WorkoutSplit
  defaultDurationMinutes?: number
  /** Interface language. Absent/unsupported values fall back to English (see `normalizeLocale`). */
  locale?: SupportedLocale
}

/** A reusable, user-facing workout plan (hand-built or saved from a generated plan) that can be repeated across sessions. */
export interface WorkoutTemplateExercise {
  exerciseId: EntityId
  displayName?: string
  sets: number
  repRange?: [number, number]
  durationRangeSeconds?: [number, number]
  restSeconds: number
  plannedSets?: Array<{ loadKg?: number; reps?: number; durationSeconds?: number }>
}

export interface WorkoutTemplate {
  id: EntityId
  name: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  exercises: WorkoutTemplateExercise[]
  /** Bundled definitions for exerciseIds with no catalog equivalent; persisted on first use, never overwriting an existing exercise with the same id. */
  customExercises?: Exercise[]
}

/** An immutable audit record of one generator run: what was asked for, and what came out. Not user-editable. */
export interface GeneratedPlanRecord {
  id: EntityId
  createdAt: ISODateTime
  input: GeneratorInput
  plan: GeneratedWorkout
}

export interface MetadataRecord {
  key: string
  value: string
}
