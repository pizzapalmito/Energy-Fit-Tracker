import type { Translator } from './enumLabels'
import type { MessageKey } from './messages'

/**
 * Localizes `validateSetFields` error strings (`features/workout/validation.ts`)
 * at the UI boundary. That module's contract (input/output shapes, and the
 * exact English text it returns) is untouched — pure validation logic must
 * stay side-effect-free and framework-agnostic. This exactly matches its
 * known message shapes and re-renders them in the active locale; anything
 * that doesn't match is returned unchanged (safe fallback).
 */

const NON_NEGATIVE_RE = /^(Load|Reps|Duration|Distance) must be a number that is zero or greater\.$/
const RIR_RANGE_MESSAGE = 'RIR must be between 0 and 10.'
const RPE_RANGE_MESSAGE = 'RPE must be between 1 and 10.'

const FIELD_LABEL_KEYS: Record<string, MessageKey> = {
  Load: 'validation.load',
  Reps: 'validation.reps',
  Duration: 'validation.duration',
  Distance: 'validation.distance',
}

export function formatSetFieldError(t: Translator, message: string): string {
  const match = NON_NEGATIVE_RE.exec(message)
  if (match) {
    const labelKey = FIELD_LABEL_KEYS[match[1]!]
    return t('validation.nonNegative', { label: labelKey ? t(labelKey) : match[1]! })
  }
  if (message === RIR_RANGE_MESSAGE) return t('validation.rirRange')
  if (message === RPE_RANGE_MESSAGE) return t('validation.rpeRange')
  return message
}
