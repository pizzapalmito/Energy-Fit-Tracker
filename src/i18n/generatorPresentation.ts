import { movementPatternLabel, muscleLabel, splitLabel, trainingGoalLabel, type Translator } from './enumLabels'

/**
 * Localizes engine-generated `GeneratedWorkout` display text at the UI boundary.
 *
 * The generator engine (`src/engines/generator/generatorEngine.ts`) is a pure,
 * side-effect-free domain module with a stable contract: it must keep emitting
 * plain English `name`/`reasons` strings so historical `GeneratedPlanRecord`
 * audit rows and the engine version stay meaningful and unchanged. This module
 * exactly parses that stable English format and re-renders it in the active
 * locale; any input that doesn't match the known format (a future engine
 * version, a corrupted/foreign record) safely falls back to the original
 * English text instead of showing a broken or partially-translated string.
 */

const SPLIT_VALUES = new Set(['full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'recovery_adaptive', 'custom'])
const GOAL_VALUES = new Set(['strength', 'hypertrophy', 'general', 'endurance', 'maintenance'])

const PLAN_NAME_RE = /^(.+) — (.+)$/
const TARGETS_REASON_RE = /^targets "([^"]+)" at (-?\d+(?:\.\d+)?) recovery readiness$/
const MOVEMENT_REASON_RE = /^movement pattern: (.+?)( \(compound\))?$/
const LOAD_REASON_RE = /^recommended load from recent successful sets: (-?\d+(?:\.\d+)?)kg$/

/** Localizes a `GeneratedWorkout.name` (`"{split} — {goal}"`); returns the input unchanged if it doesn't match that exact shape. */
export function formatPlanName(t: Translator, name: string): string {
  const match = PLAN_NAME_RE.exec(name)
  if (!match) return name
  const [, splitPart, goalPart] = match
  if (!splitPart || !goalPart || !SPLIT_VALUES.has(splitPart) || !GOAL_VALUES.has(goalPart)) return name
  return `${splitLabel(t, splitPart)} — ${trainingGoalLabel(t, goalPart)}`
}

/** Localizes one engine-generated `reasons[]` entry; unrecognized text is returned unchanged (safe fallback). */
export function formatGeneratorReason(t: Translator, formatNumber: (value: number) => string, reason: string): string {
  const targetsMatch = TARGETS_REASON_RE.exec(reason)
  if (targetsMatch) {
    return t('generator.reasonTargets', { muscle: muscleLabel(t, targetsMatch[1]!), readiness: formatNumber(Number(targetsMatch[2])) })
  }

  const movementMatch = MOVEMENT_REASON_RE.exec(reason)
  if (movementMatch) {
    const base = t('generator.reasonMovement', { pattern: movementPatternLabel(t, movementMatch[1]!) })
    return movementMatch[2] ? `${base}${t('generator.reasonCompoundSuffix')}` : base
  }

  const loadMatch = LOAD_REASON_RE.exec(reason)
  if (loadMatch) {
    return t('generator.reasonRecommendedLoad', { load: formatNumber(Number(loadMatch[1])) })
  }

  return reason
}
