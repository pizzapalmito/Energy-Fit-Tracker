import type { EntityId, ISODateTime, TrainingGoal } from '../domain/models'
import type { GeneratedWorkout, GeneratorInput, WorkoutSplit } from '../domain/contracts'

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
}

/** A reusable, user-facing workout plan (hand-built or saved from a generated plan) that can be repeated across sessions. */
export interface WorkoutTemplateExercise {
  exerciseId: EntityId
  sets: number
  repRange: [number, number]
  restSeconds: number
}

export interface WorkoutTemplate {
  id: EntityId
  name: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  exercises: WorkoutTemplateExercise[]
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
