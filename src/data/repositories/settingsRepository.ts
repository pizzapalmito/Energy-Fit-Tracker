import type { RepwiseDatabase } from '../db'
import type { AppSettings } from '../types'

export const SETTINGS_SINGLETON_ID = 'default'

export class DexieSettingsRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async get(): Promise<AppSettings | undefined> {
    return this.db.settings.get(SETTINGS_SINGLETON_ID)
  }

  async save(settings: AppSettings): Promise<void> {
    await this.db.settings.put(settings)
  }
}
