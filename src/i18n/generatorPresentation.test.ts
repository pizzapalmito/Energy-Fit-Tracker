import { describe, expect, it } from 'vitest'
import { formatNumber } from './format'
import { formatGeneratorReason, formatPlanName } from './generatorPresentation'
import { MESSAGES_BY_LOCALE } from './messages'
import { translate } from './translate'
import type { SupportedLocale } from './locale'
import type { MessageKey } from './messages'

function translatorFor(locale: SupportedLocale) {
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(MESSAGES_BY_LOCALE[locale], key, vars)
}

function numberFormatterFor(locale: SupportedLocale) {
  return (value: number) => formatNumber(value, locale)
}

describe('formatPlanName', () => {
  it('localizes a recognized "{split} — {goal}" engine plan name', () => {
    expect(formatPlanName(translatorFor('en'), 'full_body — hypertrophy')).toBe('Full body — Hypertrophy')
    expect(formatPlanName(translatorFor('fr'), 'push — strength')).toBe('Poussée — Force')
    expect(formatPlanName(translatorFor('es'), 'custom — endurance')).toBe('Personalizado — Resistencia')
    expect(formatPlanName(translatorFor('pt-BR'), 'recovery_adaptive — maintenance')).toBe('Adaptativo à recuperação — Manutenção')
  })

  it('falls back to the original engine text for an unrecognized shape (defensive, e.g. a future engine format)', () => {
    expect(formatPlanName(translatorFor('en'), 'not the expected shape')).toBe('not the expected shape')
    expect(formatPlanName(translatorFor('en'), 'unknownsplit — hypertrophy')).toBe('unknownsplit — hypertrophy')
    expect(formatPlanName(translatorFor('en'), 'full_body — unknowngoal')).toBe('full_body — unknowngoal')
  })
})

describe('formatGeneratorReason', () => {
  it('localizes a "targets" reason and formats the readiness number for the locale', () => {
    expect(formatGeneratorReason(translatorFor('en'), numberFormatterFor('en'), 'targets "chest" at 80 recovery readiness')).toBe('targets Chest at 80 recovery readiness')
    expect(formatGeneratorReason(translatorFor('fr'), numberFormatterFor('fr'), 'targets "lower-back" at 62 recovery readiness')).toBe('cible Bas du dos à 62 de récupération')
  })

  it('localizes a compound movement-pattern reason, translating both the movement pattern and the word "compound"', () => {
    expect(formatGeneratorReason(translatorFor('en'), numberFormatterFor('en'), 'movement pattern: push (compound)')).toBe('movement pattern: Push (compound)')
    expect(formatGeneratorReason(translatorFor('es'), numberFormatterFor('es'), 'movement pattern: push (compound)')).toBe('patrón de movimiento: Empuje (compuesto)')
  })

  it('localizes a non-compound movement-pattern reason without appending a compound suffix', () => {
    expect(formatGeneratorReason(translatorFor('en'), numberFormatterFor('en'), 'movement pattern: isolation-curl')).toBe('movement pattern: Isolation Curl')
  })

  it('localizes a recommended-load reason and formats the load number for the locale (decimal separator)', () => {
    expect(formatGeneratorReason(translatorFor('en'), numberFormatterFor('en'), 'recommended load from recent successful sets: 62.5kg')).toBe('recommended load from recent successful sets: 62.5kg')
    expect(formatGeneratorReason(translatorFor('fr'), numberFormatterFor('fr'), 'recommended load from recent successful sets: 62.5kg')).toBe('charge recommandée d’après les séries récentes réussies : 62,5 kg')
  })

  it('returns unrecognized reason text unchanged (safe fallback for a future engine version or foreign record)', () => {
    expect(formatGeneratorReason(translatorFor('en'), numberFormatterFor('en'), 'a completely new kind of explanation')).toBe('a completely new kind of explanation')
  })
})
