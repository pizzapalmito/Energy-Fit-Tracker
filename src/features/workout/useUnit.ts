import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { DexieSettingsRepository } from '../../data/repositories/settingsRepository'
import type { WeightUnit } from './units'

/** Weight display unit from app settings; defaults to kg when no settings row exists yet. */
export function useUnit(db: RepwiseDatabase): WeightUnit {
  const state = useLiveQuery(() => new DexieSettingsRepository(db).get(), [db])
  return state.status === 'ready' && state.value?.unit === 'lb' ? 'lb' : 'kg'
}
