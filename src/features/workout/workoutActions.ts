import type { Exercise, SetType, Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { DexieMetadataRepository } from '../../data/repositories/metadataRepository'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { CATALOG_VERSION_METADATA_KEY } from '../../catalog/seedCatalog'
import { createId } from './id'

export function todayIsoDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Creates and persists a new active workout. Throws ActiveWorkoutConflictError if one is already active. */
export async function startWorkout(db: RepwiseDatabase, name: string, now: Date = new Date()): Promise<Workout> {
  const workout: Workout = {
    id: createId('workout'),
    date: todayIsoDate(now),
    startTime: now.toISOString(),
    name: name.trim() || 'Workout',
    notes: '',
    status: 'active',
  }
  await new DexieWorkoutRepository(db).saveWorkout(workout)
  return workout
}

export function isDuplicateExercise(existing: WorkoutExercise[], exerciseId: string): boolean {
  return existing.some((e) => e.exerciseId === exerciseId)
}

/** Adds an exercise to a workout, snapshotting its catalog facts (name/equipment/movement/muscles/catalog version) at add-time. */
export async function addExerciseToWorkout(db: RepwiseDatabase, workoutId: string, exercise: Exercise): Promise<WorkoutExercise> {
  const workoutExerciseRepo = new DexieWorkoutExerciseRepository(db)
  const existing = await workoutExerciseRepo.listByWorkout(workoutId)
  const catalogVersion = (await new DexieMetadataRepository(db).get(CATALOG_VERSION_METADATA_KEY)) ?? 'unknown'

  const workoutExercise: WorkoutExercise = {
    id: createId('we'),
    workoutId,
    exerciseId: exercise.id,
    order: existing.length,
    notes: '',
    restSeconds: exercise.defaultRestSeconds,
    snapshot: {
      name: exercise.name,
      equipment: exercise.equipment,
      movementPattern: exercise.movementPattern,
      muscles: exercise.muscles,
      catalogVersion,
    },
  }
  await workoutExerciseRepo.save(workoutExercise)
  return workoutExercise
}

export async function removeWorkoutExercise(db: RepwiseDatabase, workoutExerciseId: string): Promise<void> {
  await new DexieSetRepository(db).deleteByWorkoutExercise(workoutExerciseId)
  await new DexieWorkoutExerciseRepository(db).delete(workoutExerciseId)
}

export async function updateWorkoutExercise(db: RepwiseDatabase, workoutExercise: WorkoutExercise): Promise<void> {
  await new DexieWorkoutExerciseRepository(db).save(workoutExercise)
}

export function nextSetNumber(existingSets: WorkoutSet[]): number {
  if (existingSets.length === 0) return 1
  return Math.max(...existingSets.map((s) => s.setNumber)) + 1
}

export async function addSet(db: RepwiseDatabase, workoutExerciseId: string, type: SetType, existingSets: WorkoutSet[]): Promise<WorkoutSet> {
  const set: WorkoutSet = {
    id: createId('set'),
    workoutExerciseId,
    setNumber: nextSetNumber(existingSets),
    type,
    completed: false,
  }
  await new DexieSetRepository(db).save(set)
  return set
}

export async function removeSet(db: RepwiseDatabase, setId: string): Promise<void> {
  await new DexieSetRepository(db).delete(setId)
}

/** Persists a set as-is; caller is responsible for validating field values first. */
export async function saveSet(db: RepwiseDatabase, set: WorkoutSet): Promise<void> {
  await new DexieSetRepository(db).save(set)
}

/** Atomically updates only supplied fields, preventing stale whole-record writes during rapid logging. */
export async function updateSetFields(db: RepwiseDatabase, setId: string, changes: Partial<WorkoutSet>): Promise<void> {
  await db.sets.update(setId, changes)
}

export async function completeSet(db: RepwiseDatabase, set: WorkoutSet, now: Date = new Date()): Promise<WorkoutSet> {
  const updated: WorkoutSet = { ...set, completed: true, completedAt: now.toISOString() }
  await updateSetFields(db, set.id, { completed: true, completedAt: updated.completedAt })
  return updated
}

export async function uncompleteSet(db: RepwiseDatabase, set: WorkoutSet): Promise<WorkoutSet> {
  const updated: WorkoutSet = { ...set, completed: false, completedAt: undefined }
  await updateSetFields(db, set.id, { completed: false, completedAt: undefined })
  return updated
}

export function hasAnyCompletedSet(exercises: Array<{ sets: WorkoutSet[] }>): boolean {
  return exercises.some((e) => e.sets.some((s) => s.completed))
}

export async function finishWorkout(db: RepwiseDatabase, workout: Workout, now: Date = new Date()): Promise<Workout> {
  const updated: Workout = { ...workout, status: 'completed', endTime: now.toISOString() }
  await new DexieWorkoutRepository(db).saveWorkout(updated)
  return updated
}

export async function discardWorkout(db: RepwiseDatabase, workout: Workout, now: Date = new Date()): Promise<Workout> {
  const updated: Workout = { ...workout, status: 'discarded', endTime: now.toISOString() }
  await new DexieWorkoutRepository(db).saveWorkout(updated)
  return updated
}

export async function renameWorkout(db: RepwiseDatabase, workout: Workout, name: string): Promise<void> {
  const trimmed = name.trim() || 'Workout'
  if (trimmed === workout.name) return
  await new DexieWorkoutRepository(db).saveWorkout({ ...workout, name: trimmed })
}
