import type { RepwiseDatabase } from '../db'
import type { WorkoutTemplate } from '../types'

/** Reusable, user-facing workout templates (distinct from generated-plan history; see generatedPlanRepository.ts). */
export class DexieWorkoutTemplateRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async list(): Promise<WorkoutTemplate[]> {
    const all = await this.db.templates.toArray()
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<WorkoutTemplate | undefined> {
    return this.db.templates.get(id)
  }

  async save(template: WorkoutTemplate): Promise<void> {
    await this.db.templates.put(template)
  }
}
