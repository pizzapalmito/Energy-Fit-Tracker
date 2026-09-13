import { LOCALE_INTL_TAGS, type SupportedLocale } from './locale'
import type { Messages, MessageKey } from './messages'

export type TranslateVars = Record<string, string | number>

const pluralRulesCache = new Map<SupportedLocale, Intl.PluralRules>()

function pluralRulesFor(locale: SupportedLocale): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_INTL_TAGS[locale])
    pluralRulesCache.set(locale, rules)
  }
  return rules
}

function lookup(messages: Messages, key: string): string {
  const parts = key.split('.')
  let node: unknown = messages
  for (const part of parts) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
  }
  return typeof node === 'string' ? node : key
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

/** Looks up `key` in `messages` (dot-path, e.g. "today.workoutsCount") and interpolates `{placeholders}` from `vars`. */
export function translate(messages: Messages, key: MessageKey, vars?: TranslateVars): string {
  return interpolate(lookup(messages, key), vars)
}

/**
 * Picks the plural form (`${key}_zero|_one|_two|_few|_many|_other`) using the active
 * locale's real CLDR plural category via `Intl.PluralRules` (not a hardcoded
 * count===1 rule), then interpolates, automatically exposing `count` as a variable.
 * Falls back to `_other` if the selected category has no matching message key
 * (our catalogs only define `_one`/`_other`, which covers en/es/fr/pt-BR).
 *
 * This matters beyond English: French and Brazilian Portuguese select the "one"
 * category for both 0 and 1 (e.g. "0 séance", "1 séance" vs "2 séances"), while
 * English and Spanish only select "one" for exactly 1.
 */
export function translatePlural(messages: Messages, key: string, count: number, locale: SupportedLocale, vars?: TranslateVars): string {
  const category = pluralRulesFor(locale).select(count)
  const mergedVars = { ...vars, count }
  const preferred = lookup(messages, `${key}_${category}`)
  const preferredKey = `${key}_${category}`
  if (preferred === preferredKey && category !== 'other') {
    return interpolate(lookup(messages, `${key}_other`), mergedVars)
  }
  return interpolate(preferred, mergedVars)
}
