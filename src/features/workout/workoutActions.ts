import type { Exercise, SetType, Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { GeneratedWorkout, GeneratorInput } from '../../domain/contracts'
import type { WorkoutTemplate } from '../../data/types'
import type { RepwiseDatabase } from '../../data/db'
import { DexieMetadataRepository } from '../../data/repositories/metadataRepository'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { CATALOG_VERSION_METADATA_KEY } from '../../catalog/seedCatalog'
import { createId } from './id'
import { ActiveWorkoutConflictError } from '../../data/repositories/workoutRepository'

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

/**
 * Atomically creates an active workout from a reusable template without creating completed history or mutating the template.
 * Exercises the template's exerciseIds don't find in the catalog are resolved from `template.customExercises` and persisted
 * in the same transaction (via bulkAdd, so an existing exercise with the same id is never overwritten) before the workout is built.
 */
export async function startWorkoutTemplate(db: RepwiseDatabase, template: WorkoutTemplate, now: Date = new Date()): Promise<Workout> {
  const uniqueExerciseIds = [...new Set(template.exercises.map((entry) => entry.exerciseId))]
  const customExercisesById = new Map((template.customExercises ?? []).map((exercise) => [exercise.id, exercise] as const))

  const workout: Workout = {
    id: createId('workout'),
    date: todayIsoDate(now),
    startTime: now.toISOString(),
    name: template.name,
    notes: '',
    status: 'active',
  }
  const catalogVersion = (await db.metadata.get(CATALOG_VERSION_METADATA_KEY))?.value ?? 'unknown'

  await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, db.exercises, async () => {
    const active = await db.workouts.where('status').equals('active').first()
    if (active) throw new ActiveWorkoutConflictError(active.id)

    const existingExercises = await db.exercises.bulkGet(uniqueExerciseIds)
    const catalogById = new Map(existingExercises.flatMap((entry) => entry ? [[entry.id, entry] as const] : []))

    const missing = uniqueExerciseIds.filter((id) => !catalogById.has(id) && !customExercisesById.has(id))
    if (missing.length > 0) throw new Error(`Template exercises are unavailable: ${missing.join(', ')}`)

    const customExercisesToPersist = uniqueExerciseIds
      .filter((id) => !catalogById.has(id))
      .map((id) => customExercisesById.get(id)!)
    customExercisesToPersist.forEach((exercise) => catalogById.set(exercise.id, exercise))
    if (customExercisesToPersist.length > 0) await db.exercises.bulkAdd(customExercisesToPersist)

    const workoutExercises: WorkoutExercise[] = []
    const sets: WorkoutSet[] = []
    template.exercises.forEach((planned, order) => {
      const catalogExercise = catalogById.get(planned.exerciseId)!
      const workoutExerciseId = createId('we')
      workoutExercises.push({
        id: workoutExerciseId,
        workoutId: workout.id,
        exerciseId: catalogExercise.id,
        order,
        notes: '',
        restSeconds: planned.restSeconds,
        snapshot: {
          name: planned.displayName ?? catalogExercise.name,
          equipment: catalogExercise.equipment,
          movementPattern: catalogExercise.movementPattern,
          muscles: catalogExercise.muscles,
          catalogVersion,
        },
      })
      const plannedSets = planned.plannedSets?.length
        ? planned.plannedSets
        : Array.from({ length: planned.sets }, () => (
            planned.repRange ? { reps: planned.repRange[0] } : { durationSeconds: planned.durationRangeSeconds?.[0] }
          ))
      plannedSets.forEach((plannedSet, index) => sets.push({
        id: createId('set'),
        workoutExerciseId,
        setNumber: index + 1,
        type: 'working',
        completed: false,
        ...plannedSet,
      }))
    })

    await db.workouts.put(workout)
    await db.workoutExercises.bulkPut(workoutExercises)
    await db.sets.bulkPut(sets)
  })

  return workout
}

/** Creates a generated workout and its audit record as one all-or-nothing database operation. */
export async function startGeneratedWorkout(
  db: RepwiseDatabase,
  input: GeneratorInput,
  plan: GeneratedWorkout,
  displayName: string,
  now: Date = new Date(),
): Promise<Workout> {
  const workout: Workout = {
    id: createId('workout'), date: todayIsoDate(now), startTime: now.toISOString(),
    name: displayName.trim() || 'Workout', notes: '', status: 'active',
  }
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets, db.exercises, db.generatedPlans, db.metadata], async () => {
    const active = await db.workouts.where('status').equals('active').first()
    if (active) throw new ActiveWorkoutConflictError(active.id)
    const catalogVersion = (await db.metadata.get(CATALOG_VERSION_METADATA_KEY))?.value ?? 'unknown'
    const uniqueIds = [...new Set(plan.exercises.map((entry) => entry.exerciseId))]
    const available = await db.exercises.bulkGet(uniqueIds)
    const catalogById = new Map(available.flatMap((entry) => entry ? [[entry.id, entry] as const] : []))
    const missing = uniqueIds.filter((id) => !catalogById.has(id))
    if (missing.length > 0) throw new Error(`Generated workout exercises are unavailable: ${missing.join(', ')}`)

    const workoutExercises: WorkoutExercise[] = []
    const sets: WorkoutSet[] = []
    plan.exercises.forEach((planned, order) => {
      const catalogExercise = catalogById.get(planned.exerciseId)!
      const workoutExerciseId = createId('we')
      workoutExercises.push({
        id: workoutExerciseId, workoutId: workout.id, exerciseId: catalogExercise.id, order, notes: '',
        restSeconds: planned.restSeconds,
        snapshot: {
          name: catalogExercise.name, equipment: catalogExercise.equipment, movementPattern: catalogExercise.movementPattern,
          muscles: catalogExercise.muscles, catalogVersion,
        },
      })
      for (let index = 0; index < planned.sets; index += 1) {
        sets.push({
          id: createId('set'), workoutExerciseId, setNumber: index + 1, type: 'working', completed: false,
          reps: planned.repRange[0], ...(planned.recommendedLoadKg === undefined ? {} : { loadKg: planned.recommendedLoadKg }),
        })
      }
    })

    await db.workouts.put(workout)
    await db.workoutExercises.bulkPut(workoutExercises)
    await db.sets.bulkPut(sets)
    await db.generatedPlans.put({ id: createId('plan'), createdAt: now.toISOString(), input, plan })
  })
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

/** Deletes the workout exercise and all of its sets in one transaction, so an injected failure rolls back both. */
export async function removeWorkoutExercise(db: RepwiseDatabase, workoutExerciseId: string): Promise<void> {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    await new DexieSetRepository(db).deleteByWorkoutExercise(workoutExerciseId)
    await new DexieWorkoutExerciseRepository(db).delete(workoutExerciseId)
  })
}

export async function updateWorkoutExercise(db: RepwiseDatabase, workoutExercise: WorkoutExercise): Promise<void> {
  await new DexieWorkoutExerciseRepository(db).save(workoutExercise)
}

export function nextSetNumber(existingSets: WorkoutSet[]): number {
  if (existingSets.length === 0) return 1
  return Math.max(...existingSets.map((s) => s.setNumber)) + 1
}

export async function addSet(db: RepwiseDatabase, workoutExerciseId: string, type: SetType, existingSets: WorkoutSet[]): Promise<WorkoutSet> {
  return db.transaction('rw', db.sets, async () => {
    const persistedSets = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('setNumber')
    const sourceSets = persistedSets.length > 0 ? persistedSets : existingSets
    const lastSet = sourceSets.reduce<WorkoutSet | undefined>(
      (latest, candidate) => !latest || candidate.setNumber > latest.setNumber ? candidate : latest,
      undefined,
    )
    const set: WorkoutSet = {
      id: createId('set'),
      workoutExerciseId,
      setNumber: nextSetNumber(sourceSets),
      type,
      completed: false,
      ...(lastSet?.loadKg === undefined ? {} : { loadKg: lastSet.loadKg }),
      ...(lastSet?.reps === undefined ? {} : { reps: lastSet.reps }),
      ...(lastSet?.durationSeconds === undefined ? {} : { durationSeconds: lastSet.durationSeconds }),
      ...(lastSet?.distanceMeters === undefined ? {} : { distanceMeters: lastSet.distanceMeters }),
      ...(lastSet?.rir === undefined ? {} : { rir: lastSet.rir }),
      ...(lastSet?.rpe === undefined ? {} : { rpe: lastSet.rpe }),
    }
    await db.sets.put(set)
    return set
  })
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

/** Atomically completes an active workout. Throws IllegalWorkoutTransitionError if it is no longer active (already finished/discarded). */
export async function finishWorkout(db: RepwiseDatabase, workout: Workout, now: Date = new Date()): Promise<Workout> {
  return new DexieWorkoutRepository(db).transitionLifecycle(workout.id, 'completed', now.toISOString())
}

/** Atomically discards an active workout. Throws IllegalWorkoutTransitionError if it is no longer active (already finished/discarded). */
export async function discardWorkout(db: RepwiseDatabase, workout: Workout, now: Date = new Date()): Promise<Workout> {
  return new DexieWorkoutRepository(db).transitionLifecycle(workout.id, 'discarded', now.toISOString())
}

/** Patches only the name field against the current DB record, so a stale in-memory workout can never reactivate it or overwrite newer lifecycle fields. */
export async function renameWorkout(db: RepwiseDatabase, workout: Workout, name: string): Promise<void> {
  const trimmed = name.trim() || 'Workout'
  await new DexieWorkoutRepository(db).renameWorkout(workout.id, trimmed)
}
