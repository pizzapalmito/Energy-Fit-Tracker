import type { Translator } from './enumLabels'
import type { MessageKey } from './messages'

/**
 * Localizes the built-in 3-week rotation's display text at the UI boundary.
 *
 * `builtInProgram.ts` (content, not touched here) names each template
 * `"Week {n} Day {X} — {focus}"` with a small closed set of focus phrases.
 * This module exactly matches that stable English shape and re-renders it in
 * the active locale, including the workout name passed to `startWorkoutTemplate`;
 * anything that doesn't match falls back to the original English text.
 */

const FOCUS_TITLE_KEYS: Record<string, MessageKey> = {
  'Chest + Biceps Emphasis': 'program.focusChestBiceps',
  'Back + Glutes Emphasis': 'program.focusBackGlutes',
  'Chest + Triceps Emphasis': 'program.focusChestTriceps',
  'Shoulders + Glutes Emphasis': 'program.focusShouldersGlutes',
}

const TEMPLATE_NAME_RE = /^Week (\d+) Day ([A-D]) — (.+)$/

/** Localizes one of the four known focus phrases; returns the input unchanged if unrecognized. */
export function formatProgramFocus(t: Translator, focus: string): string {
  const key = FOCUS_TITLE_KEYS[focus]
  return key ? t(key) : focus
}

/** Localizes a full `"Week {n} Day {X} — {focus}"` template name; returns the input unchanged if it doesn't match that shape. */
export function formatProgramTemplateName(t: Translator, name: string): string {
  const match = TEMPLATE_NAME_RE.exec(name)
  if (!match) return name
  const [, week, day, focus] = match
  return t('program.weekDayName', { week: week!, day: day!, focus: formatProgramFocus(t, focus!) })
}
