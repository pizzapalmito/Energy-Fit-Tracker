import { describe, expect, it } from 'vitest'
import { formatSetFieldError } from './validationPresentation'
import { MESSAGES_BY_LOCALE } from './messages'
import { translate } from './translate'
import type { SupportedLocale } from './locale'
import type { MessageKey } from './messages'
import { validateSetFields } from '../features/workout/validation'

function translatorFor(locale: SupportedLocale) {
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(MESSAGES_BY_LOCALE[locale], key, vars)
}

describe('formatSetFieldError', () => {
  it('localizes each known non-negative field message, using the real validateSetFields output', () => {
    const errors = validateSetFields({ loadKg: -1, reps: -1, durationSeconds: -1, distanceMeters: -1 })
    expect(formatSetFieldError(translatorFor('en'), errors.loadKg!)).toBe('Load must be a number that is zero or greater.')
    expect(formatSetFieldError(translatorFor('en'), errors.reps!)).toBe('Reps must be a number that is zero or greater.')
    expect(formatSetFieldError(translatorFor('en'), errors.durationSeconds!)).toBe('Duration must be a number that is zero or greater.')
    expect(formatSetFieldError(translatorFor('en'), errors.distanceMeters!)).toBe('Distance must be a number that is zero or greater.')
  })

  it('localizes the load message into French, Spanish, and Brazilian Portuguese', () => {
    const errors = validateSetFields({ loadKg: -1 })
    expect(formatSetFieldError(translatorFor('fr'), errors.loadKg!)).toBe('La charge doit être un nombre égal ou supérieur à zéro.')
    expect(formatSetFieldError(translatorFor('es'), errors.loadKg!)).toBe('La carga debe ser un número igual o mayor que cero.')
    expect(formatSetFieldError(translatorFor('pt-BR'), errors.loadKg!)).toBe('Carga deve ser um número igual ou maior que zero.')
  })

  it('localizes the RIR and RPE range messages', () => {
    const errors = validateSetFields({ rir: 11, rpe: 0 })
    expect(formatSetFieldError(translatorFor('en'), errors.rir!)).toBe('RIR must be between 0 and 10.')
    expect(formatSetFieldError(translatorFor('fr'), errors.rir!)).toBe('Le RIR doit être compris entre 0 et 10.')
    expect(formatSetFieldError(translatorFor('en'), errors.rpe!)).toBe('RPE must be between 1 and 10.')
    expect(formatSetFieldError(translatorFor('es'), errors.rpe!)).toBe('El RPE debe estar entre 1 y 10.')
  })

  it('returns unrecognized text unchanged (safe fallback)', () => {
    expect(formatSetFieldError(translatorFor('en'), 'Some future validation message')).toBe('Some future validation message')
  })
})
