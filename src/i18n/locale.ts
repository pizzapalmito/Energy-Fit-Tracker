export const SUPPORTED_LOCALES = ['en', 'pt-BR', 'fr', 'es'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'

/** Native, self-contained language names for the Settings language control. */
export const LOCALE_NATIVE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  es: 'Español',
}

/** BCP 47 tags handed to Intl formatters. */
export const LOCALE_INTL_TAGS: Record<SupportedLocale, string> = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
  fr: 'fr-FR',
  es: 'es-ES',
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Normalizes any persisted/backup-restored value to a supported locale, defaulting unknown/missing values to English. */
export function normalizeLocale(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE
}
