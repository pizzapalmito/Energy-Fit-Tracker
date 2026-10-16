import type { RepwiseDatabase } from '../db'
import type { AppSettings } from '../types'
import type { Theme } from '../../theme/theme'

export const SETTINGS_SINGLETON_ID = 'default'

export class DexieSettingsRepository {
  constructor(private readonly db: RepwiseDatabase) {}

  async get(): Promise<AppSettings | undefined> {
    return this.db.settings.get(SETTINGS_SINGLETON_ID)
  }

  async save(settings: AppSettings): Promise<void> {
    await this.db.settings.put(settings)
  }

  async setTheme(theme: Theme): Promise<void> {
    await this.db.transaction('rw', this.db.settings, async () => {
      const current = await this.get()
      await this.save({ id: SETTINGS_SINGLETON_ID, unit: 'kg', ...current, theme })
    })
  }
}
