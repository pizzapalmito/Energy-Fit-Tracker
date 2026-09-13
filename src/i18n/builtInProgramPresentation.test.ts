import { describe, expect, it } from 'vitest'
import { formatProgramFocus, formatProgramTemplateName } from './builtInProgramPresentation'
import { MESSAGES_BY_LOCALE } from './messages'
import { translate } from './translate'
import type { SupportedLocale } from './locale'
import type { MessageKey } from './messages'

function translatorFor(locale: SupportedLocale) {
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(MESSAGES_BY_LOCALE[locale], key, vars)
}

describe('formatProgramFocus', () => {
  it('localizes each of the four known built-in-program focus phrases', () => {
    expect(formatProgramFocus(translatorFor('en'), 'Chest + Biceps Emphasis')).toBe('Chest + Biceps Emphasis')
    expect(formatProgramFocus(translatorFor('fr'), 'Back + Glutes Emphasis')).toBe('Accent dos + fessiers')
    expect(formatProgramFocus(translatorFor('es'), 'Chest + Triceps Emphasis')).toBe('Énfasis en pecho + tríceps')
    expect(formatProgramFocus(translatorFor('pt-BR'), 'Shoulders + Glutes Emphasis')).toBe('Ênfase em Ombros + Glúteos')
  })

  it('falls back to the original text for an unrecognized focus phrase', () => {
    expect(formatProgramFocus(translatorFor('fr'), 'Some New Focus')).toBe('Some New Focus')
  })
})

describe('formatProgramTemplateName', () => {
  it('localizes a full "Week {n} Day {X} — {focus}" template name', () => {
    expect(formatProgramTemplateName(translatorFor('en'), 'Week 1 Day A — Chest + Biceps Emphasis')).toBe('Week 1 Day A — Chest + Biceps Emphasis')
    expect(formatProgramTemplateName(translatorFor('fr'), 'Week 2 Day D — Shoulders + Glutes Emphasis')).toBe('Semaine 2 Jour D — Accent épaules + fessiers')
    expect(formatProgramTemplateName(translatorFor('pt-BR'), 'Week 3 Day C — Chest + Triceps Emphasis')).toBe('Semana 3 Dia C — Ênfase em Peito + Tríceps')
  })

  it('falls back to the original text for a name that does not match the known shape', () => {
    expect(formatProgramTemplateName(translatorFor('fr'), 'A custom user-renamed workout')).toBe('A custom user-renamed workout')
  })
})
