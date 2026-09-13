import type { ExerciseRepository } from '../../domain/contracts'
import type { Exercise } from '../../domain/models'
import type { RepwiseDatabase } from '../db'

export class DexieExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async list(): Promise<Exercise[]> {
    return this.db.exercises.toArray()
  }

  async get(id: string): Promise<Exercise | undefined> {
    return this.db.exercises.get(id)
  }

  /** Persists a full or partial catalog import in one write. */
  async bulkUpsert(exercises: Exercise[]): Promise<void> {
    await this.db.exercises.bulkPut(exercises)
  }
}
