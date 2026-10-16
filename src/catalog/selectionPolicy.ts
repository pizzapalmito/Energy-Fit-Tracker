import type { Exercise } from '../domain/models'
import policy from './selection-policy.json'

export const SELECTION_POLICY_VERSION = policy.version
const allowed = new Set(policy.selectable.map(entry => entry.id))
const retired = new Set([...policy.retiredCatalog, ...policy.retiredBundled].map(entry => entry.id))

/** Reserved bundled IDs cannot bypass retirement by claiming to be custom. */
export function isExerciseSelectable(exercise: Exercise): boolean {
  return !exercise.excluded && !retired.has(exercise.id) && (exercise.source === 'custom' || allowed.has(exercise.id))
}

/** Retain the complete record; never reactivate a user's explicit exclusion. */
export function applyExercisePolicy(exercise: Exercise): Exercise {
  return isExerciseSelectable(exercise) ? exercise : { ...exercise, excluded: true }
}

export function assertExerciseSelectable(exercise: Exercise): void {
  if (!isExerciseSelectable(exercise)) throw new Error(`Exercise is retired or unavailable: ${exercise.id}`)
}

export function isBundledProgramSelectable(ids: string[]): boolean {
  return ids.every(id => allowed.has(id))
}
