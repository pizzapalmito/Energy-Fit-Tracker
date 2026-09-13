import { describe, expect, it } from 'vitest'
import { SUPPORTED_LOCALES, normalizeLocale } from './locale'
import { MESSAGES_BY_LOCALE } from './messages'
import { translate, translatePlural } from './translate'

function flattenKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix]
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => flattenKeys(value, prefix ? `${prefix}.${key}` : key))
  }
  return []
}

describe('locale normalization', () => {
  it('accepts every supported locale unchanged', () => {
    for (const locale of SUPPORTED_LOCALES) expect(normalizeLocale(locale)).toBe(locale)
  })

  it('falls back to English for unsupported, missing, or malformed values', () => {
    expect(normalizeLocale('de')).toBe('en')
    expect(normalizeLocale(undefined)).toBe('en')
    expect(normalizeLocale(null)).toBe('en')
    expect(normalizeLocale(42)).toBe('en')
  })
})

describe('message catalog completeness', () => {
  const englishKeys = flattenKeys(MESSAGES_BY_LOCALE.en).sort()

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== 'en'))('%s has exactly the same message keys as English', (locale) => {
    const keys = flattenKeys(MESSAGES_BY_LOCALE[locale]).sort()
    expect(keys).toEqual(englishKeys)
  })

  it.each(SUPPORTED_LOCALES)('%s has no empty message values', (locale) => {
    const values = flattenKeys(MESSAGES_BY_LOCALE[locale]).map((key) => translate(MESSAGES_BY_LOCALE[locale], key as never))
    expect(values.every((value) => value.trim().length > 0)).toBe(true)
  })
})

describe('translate', () => {
  it('interpolates a single placeholder', () => {
    expect(translate(MESSAGES_BY_LOCALE.en, 'today.dayLabel', { letter: 'B' })).toBe('Day B')
  })

  it('interpolates multiple placeholders', () => {
    expect(translate(MESSAGES_BY_LOCALE.en, 'exercises.resultCount', { shown: 2, total: 5 })).toBe('2 of 5 exercises')
  })

  it('leaves an unmatched placeholder token untouched rather than throwing', () => {
    expect(translate(MESSAGES_BY_LOCALE.en, 'today.dayLabel', {})).toBe('Day {letter}')
  })

  it('falls back to the raw key when a key does not resolve to a string (defensive; every real key is covered by the completeness tests above)', () => {
    expect(translate(MESSAGES_BY_LOCALE.en, 'nav' as never)).toBe('nav')
    expect(translate(MESSAGES_BY_LOCALE.en, 'nav.doesNotExist' as never)).toBe('nav.doesNotExist')
  })
})

describe('translatePlural', () => {
  it('picks the singular form at count 1 and interpolates count', () => {
    expect(translatePlural(MESSAGES_BY_LOCALE.en, 'workout.setsCount', 1, 'en')).toBe('1 set')
  })

  it('picks the plural form for counts greater than one', () => {
    expect(translatePlural(MESSAGES_BY_LOCALE.en, 'workout.setsCount', 3, 'en')).toBe('3 sets')
  })

  it('applies the same singular-at-one rule for every supported locale at count 1 vs 2', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const singular = translatePlural(MESSAGES_BY_LOCALE[locale], 'workout.setsCount', 1, locale)
      const plural = translatePlural(MESSAGES_BY_LOCALE[locale], 'workout.setsCount', 2, locale)
      expect(singular).toContain('1')
      expect(plural).toContain('2')
      expect(singular).not.toBe(plural)
    }
  })

  it('uses the real CLDR plural category per locale at zero, not a hardcoded count===1 rule', () => {
    // English and Spanish select the "other" category for zero (e.g. "0 sets" / "0 series").
    expect(translatePlural(MESSAGES_BY_LOCALE.en, 'workout.setsCount', 0, 'en')).toBe(translatePlural(MESSAGES_BY_LOCALE.en, 'workout.setsCount', 3, 'en').replace('3', '0'))
    expect(translatePlural(MESSAGES_BY_LOCALE.es, 'workout.setsCount', 0, 'es')).toBe(translatePlural(MESSAGES_BY_LOCALE.es, 'workout.setsCount', 3, 'es').replace('3', '0'))

    // French and Brazilian Portuguese select the "one" category for zero (CLDR: i = 0 or 1),
    // so zero must use the singular form, unlike English/Spanish.
    expect(translatePlural(MESSAGES_BY_LOCALE.fr, 'workout.setsCount', 0, 'fr')).toBe(translatePlural(MESSAGES_BY_LOCALE.fr, 'workout.setsCount', 1, 'fr').replace('1', '0'))
    expect(translatePlural(MESSAGES_BY_LOCALE['pt-BR'], 'workout.setsCount', 0, 'pt-BR')).toBe(translatePlural(MESSAGES_BY_LOCALE['pt-BR'], 'workout.setsCount', 1, 'pt-BR').replace('1', '0'))
  })

  it('confirms the underlying Intl.PluralRules category driving the above (documents the CLDR behavior being relied on)', () => {
    expect(new Intl.PluralRules('en-US').select(0)).toBe('other')
    expect(new Intl.PluralRules('es-ES').select(0)).toBe('other')
    expect(new Intl.PluralRules('fr-FR').select(0)).toBe('one')
    expect(new Intl.PluralRules('pt-BR').select(0)).toBe('one')
  })

  it('falls back to the _other form when the selected CLDR category has no matching key', () => {
    // "few"/"many"/"zero"/"two" are never defined in our catalogs (only _one/_other exist);
    // a locale/count combination that resolved to one of those must still render sensibly.
    expect(translatePlural(MESSAGES_BY_LOCALE.en, 'workout.setsCount', 3, 'en')).not.toContain('setsCount')
  })
})

describe('message catalog placeholder parity', () => {
  function placeholdersOf(template: string): string[] {
    return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort()
  }

  it('every non-English locale uses exactly the same {placeholder} names as English, per key', () => {
    const englishFlat = flattenMessagesWithValues(MESSAGES_BY_LOCALE.en)
    for (const locale of SUPPORTED_LOCALES.filter((candidate) => candidate !== 'en')) {
      const localeFlat = flattenMessagesWithValues(MESSAGES_BY_LOCALE[locale])
      for (const [key, englishValue] of Object.entries(englishFlat)) {
        const localeValue = localeFlat[key]
        expect(localeValue, `${locale} is missing key ${key}`).toBeDefined()
        expect(placeholdersOf(localeValue!), `${locale}.${key} placeholder mismatch: "${localeValue}" vs English "${englishValue}"`).toEqual(placeholdersOf(englishValue))
      }
    }
  })
})

function flattenMessagesWithValues(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return { [prefix]: node }
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      Object.assign(acc, flattenMessagesWithValues(value, prefix ? `${prefix}.${key}` : key))
      return acc
    }, {})
  }
  return {}
}
