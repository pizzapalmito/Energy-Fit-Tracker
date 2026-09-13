import type { RecoveryFeedback } from '../../domain/models'
import type { RepwiseDatabase } from '../db'

export class DexieRecoveryFeedbackRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async save(feedback: RecoveryFeedback): Promise<void> {
    await this.db.recoveryFeedback.put(feedback)
  }

  async listByMuscle(muscleId: string): Promise<RecoveryFeedback[]> {
    return this.db.recoveryFeedback.where('muscleId').equals(muscleId).sortBy('date')
  }

  async listAll(): Promise<RecoveryFeedback[]> {
    return this.db.recoveryFeedback.toArray()
  }
}
