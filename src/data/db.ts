import Dexie, { type Table } from 'dexie'
import type { Exercise, RecoveryFeedback, Workout, WorkoutExercise, WorkoutSet } from '../domain/models'
import type { AppSettings, EquipmentProfile, GeneratedPlanRecord, MetadataRecord, Muscle, WorkoutTemplate } from './types'
import { normalizeLocale } from '../i18n/locale'

export const DB_SCHEMA_VERSION = 3
export const DEFAULT_DB_NAME = 'repwise'

export class RepwiseDatabase extends Dexie {
  exercises!: Table<Exercise, string>
  muscles!: Table<Muscle, string>
  workouts!: Table<Workout, string>
  workoutExercises!: Table<WorkoutExercise, string>
  sets!: Table<WorkoutSet, string>
  recoveryFeedback!: Table<RecoveryFeedback, string>
  equipmentProfiles!: Table<EquipmentProfile, string>
  settings!: Table<AppSettings, string>
  templates!: Table<WorkoutTemplate, string>
  generatedPlans!: Table<GeneratedPlanRecord, string>
  metadata!: Table<MetadataRecord, string>

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name)
    const stores = {
      exercises: 'id, name, category, movementPattern, difficulty, source, excluded',
      muscles: 'id, group, name',
      workouts: 'id, status, date, [status+date]',
      workoutExercises: 'id, workoutId, exerciseId, order, [workoutId+order]',
      sets: 'id, workoutExerciseId, setNumber, completed, [workoutExerciseId+setNumber]',
      recoveryFeedback: 'id, muscleId, date, [muscleId+date]',
      equipmentProfiles: 'id, isDefault',
      settings: 'id',
      templates: 'id, createdAt, updatedAt',
      generatedPlans: 'id, createdAt',
      metadata: 'key',
    }
    this.version(1).stores(stores)
    this.version(2).stores(stores).upgrade(async (transaction) => {
      await transaction.table<AppSettings, string>('settings').toCollection().modify((settings) => {
        settings.trainingGoal ??= 'hypertrophy'
        settings.preferredSplit ??= 'full_body'
        settings.defaultDurationMinutes ??= 60
      })
    })
    this.version(DB_SCHEMA_VERSION).stores(stores).upgrade(async (transaction) => {
      await transaction.table<AppSettings, string>('settings').toCollection().modify((settings) => {
        settings.locale = normalizeLocale(settings.locale)
      })
    })
  }
}

export function createDatabase(name?: string): RepwiseDatabase {
  return new RepwiseDatabase(name)
}
