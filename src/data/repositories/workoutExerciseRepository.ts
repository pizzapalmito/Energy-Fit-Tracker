import type { WorkoutExercise } from '../../domain/models'
import type { RepwiseDatabase } from '../db'

export class DexieWorkoutExerciseRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  /** Ordered by the exercise's position within the workout. */
  async listByWorkout(workoutId: string): Promise<WorkoutExercise[]> {
    return this.db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order')
  }

  async save(exercise: WorkoutExercise): Promise<void> {
    await this.db.workoutExercises.put(exercise)
  }

  async delete(id: string): Promise<void> {
    await this.db.workoutExercises.delete(id)
  }

  /** All instances of an exercise across every workout, for previous-performance lookups. */
  async listByExerciseId(exerciseId: string): Promise<WorkoutExercise[]> {
    return this.db.workoutExercises.where('exerciseId').equals(exerciseId).toArray()
  }
}
