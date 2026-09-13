import type { RepwiseDatabase } from '../db'
import type { GeneratedPlanRecord } from '../types'

/** Immutable history of generator runs (distinct from reusable templates; see templateRepository.ts). */
export class DexieGeneratedPlanRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async list(): Promise<GeneratedPlanRecord[]> {
    const all = await this.db.generatedPlans.toArray()
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async save(record: GeneratedPlanRecord): Promise<void> {
    await this.db.generatedPlans.put(record)
  }
}
