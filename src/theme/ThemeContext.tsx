import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'
import { db as appDb } from '../data/appDatabase'
import type { RepwiseDatabase } from '../data/db'
import { DexieSettingsRepository, SETTINGS_SINGLETON_ID } from '../data/repositories/settingsRepository'
import { useLiveQuery } from '../data/useLiveQuery'
import { applyTheme, normalizeTheme, type Theme } from './theme'

interface ThemeContextValue {
  theme: Theme
  ready: boolean
  setTheme: (theme: Theme) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', ready: false, setTheme: async () => {} })

// eslint-disable-next-line react-refresh/only-export-components -- shared provider and hook
export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ db = appDb, children }: { db?: RepwiseDatabase; children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_SINGLETON_ID), [db])
  const theme = normalizeTheme(settings.status === 'ready' ? settings.value?.theme : undefined)

  useLayoutEffect(() => { applyTheme(theme) }, [theme])

  async function setTheme(next: Theme) {
    await new DexieSettingsRepository(db).setTheme(next)
  }

  return <ThemeContext.Provider value={{ theme, ready: settings.status === 'ready', setTheme }}>{children}</ThemeContext.Provider>
}
