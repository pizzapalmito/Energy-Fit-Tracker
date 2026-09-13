import type { RepwiseDatabase } from '../db'
import type { Muscle } from '../types'

export class DexieMuscleRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async list(): Promise<Muscle[]> {
    return this.db.muscles.toArray()
  }

  async get(id: string): Promise<Muscle | undefined> {
    return this.db.muscles.get(id)
  }

  async bulkUpsert(muscles: Muscle[]): Promise<void> {
    await this.db.muscles.bulkPut(muscles)
  }
}
