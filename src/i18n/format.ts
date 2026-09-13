import { LOCALE_INTL_TAGS, type SupportedLocale } from './locale'

/** Locale-aware integer/decimal formatting for interface numbers (does not affect stored canonical values). */
export function formatNumber(value: number, locale: SupportedLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE_INTL_TAGS[locale], options).format(value)
}

/** Locale-aware formatting of a stored `YYYY-MM-DD` or ISO date string for display only. */
export function formatDate(isoDate: string, locale: SupportedLocale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const date = isoDate.length === 10 ? new Date(`${isoDate}T00:00:00Z`) : new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat(LOCALE_INTL_TAGS[locale], { ...options, timeZone: isoDate.length === 10 ? 'UTC' : undefined }).format(date)
}
