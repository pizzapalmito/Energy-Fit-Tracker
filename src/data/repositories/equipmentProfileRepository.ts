import type { RepwiseDatabase } from '../db'
import type { EquipmentProfile } from '../types'

export class DexieEquipmentProfileRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async list(): Promise<EquipmentProfile[]> {
    return this.db.equipmentProfiles.toArray()
  }

  async save(profile: EquipmentProfile): Promise<void> {
    await this.db.equipmentProfiles.put(profile)
  }
}
