import type { EntityId, Exercise, WorkoutExercise } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { DexieExerciseRepository } from '../../data/repositories/exerciseRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { addExerciseToWorkout } from '../workout/workoutActions'

/** Thrown when there is no active workout to add a catalog exercise to (the UI must never silently create one). */
export class NoActiveWorkoutError extends Error {
  constructor() {
    super('No active workout to add this exercise to.')
    this.name = 'NoActiveWorkoutError'
  }
}

/** Thrown when the workout the caller expected to still be active is no longer the active one (finished, discarded, or replaced since the UI last read it). */
export class StaleActiveWorkoutError extends Error {
  constructor(public readonly expectedWorkoutId: EntityId, public readonly actualWorkoutId: EntityId) {
    super(`Expected active workout "${expectedWorkoutId}" but "${actualWorkoutId}" is now active.`)
    this.name = 'StaleActiveWorkoutError'
  }
}

/** Thrown when the exercise is already in the target workout and the caller did not explicitly allow a duplicate. */
export class DuplicateCatalogExerciseError extends Error {
  constructor(public readonly exerciseId: EntityId) {
    super(`Exercise "${exerciseId}" is already in this workout.`)
    this.name = 'DuplicateCatalogExerciseError'
  }
}

export class CatalogExerciseUnavailableError extends Error {
  constructor() { super('This catalog exercise is no longer available.'); this.name = 'CatalogExerciseUnavailableError' }
}

export interface AddCatalogExerciseOptions {
  /** Explicit override for a confirmed duplicate addition (e.g. the user confirmed "add another occurrence"). */
  allowDuplicate?: boolean
}

/**
 * Adds a catalog exercise (opened from the Exercises library or a Progress record) to the
 * caller's expected active workout, in one write transaction over workouts/workoutExercises/
 * exercises/metadata. The active workout and duplicate state are both re-read from the database
 * inside the transaction — never trusted from the caller's (possibly stale) snapshot — so this
 * can never write into the wrong session, resurrect a finished/discarded workout, or silently
 * duplicate an exercise. Never creates a workout and never touches completed history.
 */
export async function addCatalogExerciseToActiveWorkout(
  db: RepwiseDatabase,
  expectedActiveWorkoutId: EntityId,
  exercise: Exercise,
  options: AddCatalogExerciseOptions = {},
): Promise<WorkoutExercise> {
  return db.transaction('rw', [db.workouts, db.workoutExercises, db.exercises, db.metadata], async () => {
    const active = await new DexieWorkoutRepository(db).getActive()
    if (!active) throw new NoActiveWorkoutError()
    if (active.id !== expectedActiveWorkoutId) throw new StaleActiveWorkoutError(expectedActiveWorkoutId, active.id)

    const workoutExerciseRepo = new DexieWorkoutExerciseRepository(db)
    const existing = await workoutExerciseRepo.listByWorkout(active.id)
    if (!options.allowDuplicate && existing.some((entry) => entry.exerciseId === exercise.id)) {
      throw new DuplicateCatalogExerciseError(exercise.id)
    }

    const storedExercise = await new DexieExerciseRepository(db).get(exercise.id)
    if (!storedExercise) throw new CatalogExerciseUnavailableError()
    return addExerciseToWorkout(db, active.id, storedExercise)

  })
}
