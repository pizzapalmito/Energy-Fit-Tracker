import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db as appDb } from '../data/appDatabase'
import type { RepwiseDatabase } from '../data/db'
import { useLiveQuery } from '../data/useLiveQuery'
import { SETTINGS_SINGLETON_ID } from '../data/repositories/settingsRepository'
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from './locale'
import { MESSAGES_BY_LOCALE } from './messages'
import { formatDate, formatNumber } from './format'
import { translate, translatePlural, type TranslateVars } from './translate'
import type { MessageKey } from './messages'

export interface I18nContextValue {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: MessageKey, vars?: TranslateVars) => string
  tn: (key: string, count: number, vars?: TranslateVars) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatDate: (isoDate: string, options?: Intl.DateTimeFormatOptions) => string
}

function buildValue(locale: SupportedLocale, setLocale: (locale: SupportedLocale) => void): I18nContextValue {
  const messages = MESSAGES_BY_LOCALE[locale]
  return {
    locale,
    setLocale,
    t: (key, vars) => translate(messages, key, vars),
    tn: (key, count, vars) => translatePlural(messages, key, count, locale, vars),
    formatNumber: (value, options) => formatNumber(value, locale, options),
    formatDate: (isoDate, options) => formatDate(isoDate, locale, options),
  }
}

/** Static English fallback used by any component rendered without an <I18nProvider> ancestor (e.g. unit tests that render a feature component in isolation). */
const DEFAULT_CONTEXT_VALUE: I18nContextValue = buildValue(DEFAULT_LOCALE, () => {})

const I18nContext = createContext<I18nContextValue>(DEFAULT_CONTEXT_VALUE)

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider/context by design
export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

/**
 * Owns the active locale: reads/normalizes it from the singleton AppSettings row,
 * applies it optimistically on change (no reload, no network), persists it, and
 * keeps `document.documentElement.lang` in sync. Defaults to English until the
 * settings row resolves, so existing users with no saved locale stay in English.
 */
export function I18nProvider({ db = appDb, children }: { db?: RepwiseDatabase; children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE)
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_SINGLETON_ID), [db])

  useEffect(() => {
    if (settings.status === 'ready') {
      setLocaleState(normalizeLocale(settings.value?.locale))
    }
  }, [settings])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  function setLocale(next: SupportedLocale) {
    const normalized = normalizeLocale(next)
    setLocaleState(normalized)
    void (async () => {
      const current = await db.settings.get(SETTINGS_SINGLETON_ID)
      await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'kg', ...current, locale: normalized })
    })()
  }

  const value = useMemo(() => buildValue(locale, setLocale), [locale, db])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
