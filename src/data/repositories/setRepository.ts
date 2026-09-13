import type { WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../db'

export class DexieSetRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  /** Ordered by set number within the workout exercise. */
  async listByWorkoutExercise(workoutExerciseId: string): Promise<WorkoutSet[]> {
    return this.db.sets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('setNumber')
  }

  async save(set: WorkoutSet): Promise<void> {
    await this.db.sets.put(set)
  }

  async delete(id: string): Promise<void> {
    await this.db.sets.delete(id)
  }

  async deleteByWorkoutExercise(workoutExerciseId: string): Promise<void> {
    await this.db.sets.where('workoutExerciseId').equals(workoutExerciseId).delete()
  }
}
