import type { MessageKey } from './messages'

export type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string

function titleCase(value: string): string {
  return value.length === 0 ? value : value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Looks up a fixed-vocabulary label; falls back to a readable title-cased form for any value outside the known set (e.g. catalog content not in our translation map). */
function lookupOrTitleCase(t: Translator, namespace: string, value: string): string {
  const key = `${namespace}.${value}` as MessageKey
  const translated = t(key)
  return translated === key ? titleCase(value) : translated
}

/** Energy Fit Tracker's own fixed equipment-profile vocabulary (see `ALL_EQUIPMENT` in `data/appDatabase.ts`), also used to tag catalog exercises. */
export function equipmentLabel(t: Translator, value: string): string {
  return lookupOrTitleCase(t, 'equipment', value)
}

/** The fixed anatomical muscle-id vocabulary used directly by UI-owned components (MuscleMap regions, generator readiness, custom split targets). */
export function muscleLabel(t: Translator, muscleId: string): string {
  return lookupOrTitleCase(t, 'muscle', muscleId)
}

export function difficultyLabel(t: Translator, value: string): string {
  return lookupOrTitleCase(t, 'difficulty', value)
}

export function trainingGoalLabel(t: Translator, value: string): string {
  return lookupOrTitleCase(t, 'trainingGoal', value)
}

export function splitLabel(t: Translator, value: string): string {
  return lookupOrTitleCase(t, 'split', value)
}

export function subjectiveStateLabel(t: Translator, value: string): string {
  return lookupOrTitleCase(t, 'subjectiveState', value)
}

export function readinessLabel(t: Translator, value: string): string {
  return lookupOrTitleCase(t, 'readiness', value)
}

/**
 * Catalog exercises derive `movementPattern` from a small closed vocabulary
 * (`push`/`pull`/`static`/`unknown`; see `normalizeMovementPattern` in
 * `catalog/importer.ts`). Falls back to a readable title-cased form for any
 * other value (e.g. a bundled custom exercise using a different tag).
 */
export function movementPatternLabel(t: Translator, value: string): string {
  return lookupOrTitleCase(t, 'movementPattern', value)
}

const DEFAULT_EQUIPMENT_PROFILE_ID_KEYS: Record<string, MessageKey> = {
  'commercial-gym': 'equipmentProfile.commercialGym',
  home: 'equipmentProfile.home',
  hotel: 'equipmentProfile.hotel',
}

/**
 * Energy Fit Tracker seeds three equipment profiles with stable ids ('commercial-gym',
 * 'home', 'hotel'; see `ensureAppDefaults` in `data/appDatabase.ts`) whose
 * display names should localize. Any other profile is user-created, so its
 * `name` is user-entered content and must be shown verbatim.
 */
export function equipmentProfileNameLabel(t: Translator, profile: { id: string; name: string }): string {
  const key = DEFAULT_EQUIPMENT_PROFILE_ID_KEYS[profile.id]
  return key ? t(key) : profile.name
}
