import type { WorkoutRepository } from '../../domain/contracts'
import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../db'

export class ActiveWorkoutConflictError extends Error {
  constructor(public readonly conflictingWorkoutId: string) {
    super(`Cannot save workout as active: workout "${conflictingWorkoutId}" is already active`)
    this.name = 'ActiveWorkoutConflictError'
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
