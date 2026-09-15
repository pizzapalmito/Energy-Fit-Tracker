import type { WorkoutRepository } from '../../domain/contracts'
import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../db'

export class ActiveWorkoutConflictError extends Error {
  constructor(public readonly conflictingWorkoutId: string) {
    super(`Cannot save workout as active: workout "${conflictingWorkoutId}" is already active`)
    this.name = 'ActiveWorkoutConflictError'
  }
}

/** Thrown when a lifecycle transition (finish/discard) is requested from a status that no longer permits it. */
export class IllegalWorkoutTransitionError extends Error {
  constructor(public readonly workoutId: string, public readonly fromStatus: Workout['status'], public readonly toStatus: Workout['status']) {
    super(`Cannot transition workout "${workoutId}" from "${fromStatus}" to "${toStatus}".`)
    this.name = 'IllegalWorkoutTransitionError'
  }
}

/**
 * Dexie-backed WorkoutRepository. Enforces at most one active workout by
 * checking, inside the same write transaction, whether another workout is
 * already active before allowing an insert/update that would activate this
 * one. Conflicts are rejected (not silently auto-completed) so callers keep
 * control over resolving concurrent "active workout" state.
 */
export class DexieWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async getActive(): Promise<Workout | undefined> {
    return this.db.workouts.where('status').equals('active').first()
  }

  async saveWorkout(workout: Workout): Promise<void> {
    await this.db.transaction('rw', this.db.workouts, async () => {
      if (workout.status === 'active') {
        const activeWorkouts = await this.db.workouts.where('status').equals('active').toArray()
        const conflict = activeWorkouts.find((existing) => existing.id !== workout.id)
        if (conflict) throw new ActiveWorkoutConflictError(conflict.id)
      }
      await this.db.workouts.put(workout)
    })
  }

  /** Patches only the name against the current DB record, never the whole (possibly stale) object. */
  async renameWorkout(workoutId: string, name: string): Promise<void> {
    await this.db.transaction('rw', this.db.workouts, async () => {
      const current = await this.db.workouts.get(workoutId)
      if (!current || current.name === name) return
      await this.db.workouts.update(workoutId, { name })
    })
  }

  /**
   * Atomically transitions a workout to `completed` or `discarded`, reading the current DB
   * record inside the transaction (never the caller's possibly-stale copy) and merging only
   * the lifecycle fields. Only a currently-`active` workout may transition; anything else
   * (already finished/discarded, or a concurrent double-submit) throws IllegalWorkoutTransitionError
   * instead of silently reactivating or overwriting newer fields.
   */
  async transitionLifecycle(workoutId: string, toStatus: 'completed' | 'discarded', endTime: string): Promise<Workout> {
    return this.db.transaction('rw', this.db.workouts, async () => {
      const current = await this.db.workouts.get(workoutId)
      if (!current) throw new IllegalWorkoutTransitionError(workoutId, 'active', toStatus)
      if (current.status !== 'active') throw new IllegalWorkoutTransitionError(workoutId, current.status, toStatus)
      const updated: Workout = { ...current, status: toStatus, endTime }
      await this.db.workouts.put(updated)
      return updated
    })
  }

  async saveExercise(exercise: WorkoutExercise): Promise<void> {
    await this.db.workoutExercises.put(exercise)
  }

  async saveSet(set: WorkoutSet): Promise<void> {
    await this.db.sets.put(set)
  }

  /** History ordered most-recent-first, for the history-by-date views. */
  async listHistory(): Promise<Workout[]> {
    const completed = await this.db.workouts.where('status').equals('completed').toArray()
    return completed.sort((a, b) => b.date.localeCompare(a.date))
  }
}
