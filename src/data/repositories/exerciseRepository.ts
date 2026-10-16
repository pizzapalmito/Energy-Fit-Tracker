import { applyExercisePolicy } from '../../catalog/selectionPolicy'
import type { ExerciseRepository } from '../../domain/contracts'
import type { Exercise } from '../../domain/models'
import type { RepwiseDatabase } from '../db'

export class DexieExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async list(): Promise<Exercise[]> {
    return (await this.db.exercises.toArray()).map(applyExercisePolicy)
  }

  async get(id: string): Promise<Exercise | undefined> {
    const exercise = await this.db.exercises.get(id)
    return exercise && applyExercisePolicy(exercise)
  }

  /** Persists a full or partial catalog import in one write. */
  async bulkUpsert(exercises: Exercise[]): Promise<void> {
    await this.db.exercises.bulkPut(exercises.map(applyExercisePolicy))
  }
}
