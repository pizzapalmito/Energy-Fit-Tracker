import type { RepwiseDatabase } from '../db'

export class DexieMetadataRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async get(key: string): Promise<string | undefined> {
    const record = await this.db.metadata.get(key)
    return record?.value
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.metadata.put({ key, value })
  }

  async delete(key: string): Promise<void> {
    await this.db.metadata.delete(key)
  }
}
