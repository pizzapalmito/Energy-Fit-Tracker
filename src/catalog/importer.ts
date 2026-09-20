import type { Exercise, MuscleContribution } from '../domain/models'
import type { Muscle } from '../data/types'
import { PRIMARY_CONTRIBUTION_WEIGHT, SECONDARY_CONTRIBUTION_WEIGHT } from '../engines/shared/muscleContribution'
import type { ImportResult, RawExerciseRecord } from './types'

export const CATALOG_IMPORTER_VERSION = 'catalog-importer-v3'
export const CATALOG_CURATION_VERSION = 'focused-strength-v1'
export const FOCUSED_STRENGTH_EXERCISE_COUNT = 438

const DIFFICULTY_MAP: Record<string, Exercise['difficulty']> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  expert: 'advanced',
  advanced: 'advanced',
}
const DEFAULT_DIFFICULTY: Exercise['difficulty'] = 'intermediate'

const MECHANIC_VALUES: ReadonlySet<Exercise['mechanic']> = new Set(['compound', 'isolation'])

const EQUIPMENT_ALIASES: Record<string, string> = {
  'body only': 'bodyweight',
  'e-z curl bar': 'ez-curl-bar',
  'exercise ball': 'exercise-ball',
  'medicine ball': 'medicine-ball',
  'foam roll': 'foam-roller',
  kettlebells: 'kettlebell',
}
const DEFAULT_EQUIPMENT = 'bodyweight'

const DEFAULT_REST_SECONDS_BY_CATEGORY: Record<string, number> = {
  strength: 90,
  powerlifting: 180,
  'olympic weightlifting': 180,
  strongman: 150,
  plyometrics: 60,
  stretching: 30,
  cardio: 45,
}
const FALLBACK_DEFAULT_REST_SECONDS = 90

const EQUIPMENT_PRIORITY: Record<string, number> = {
  barbell: 8, dumbbell: 8, machine: 7, cable: 7, bodyweight: 6,
  'ez-curl-bar': 6, kettlebell: 5, other: 3, bands: 1, 'exercise-ball': 0, 'medicine-ball': 0,
}

// These labels identify technical, balance, rehabilitation, or novelty variants.
// They are deliberately deprioritized below the broadly useful resistance movements.
const SPECIALTY_NAME_MARKER = /\b(with bands?|with chains?|exercise ball|medicine ball|smith machine|bosu|swiss ball|foam roll|trx|suspension|windmill|turkish get-up|pirate ships|side bend|neck|external rotation|internal rotation|hip abduction|hip adduction|wrist|finger|forearm|shrug behind|guillotine|jefferson|zercher|frankenstein|pistol|sissy|wall squat|downward facing|clapping|plyo|jump|sprints?|handstand|weighted ball|clean|snatch|jerk)\b/i

/** Canonical free-exercise-db muscle vocabulary mapped to a coarse body-region grouping. */
const MUSCLE_GROUPS: Record<string, string> = {
  abdominals: 'core',
  abductors: 'legs',
  adductors: 'legs',
  biceps: 'arms',
  calves: 'legs',
  chest: 'chest',
  forearms: 'arms',
  glutes: 'legs',
  hamstrings: 'legs',
  lats: 'back',
  'lower back': 'back',
  'middle back': 'back',
  neck: 'neck',
  quadriceps: 'legs',
  shoulders: 'shoulders',
  traps: 'back',
  triceps: 'arms',
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
}

function normalizeDifficulty(level: string | null | undefined): Exercise['difficulty'] {
  if (!level) return DEFAULT_DIFFICULTY
  return DIFFICULTY_MAP[level.trim().toLowerCase()] ?? DEFAULT_DIFFICULTY
}

function normalizeMechanic(mechanic: string | null | undefined): Exercise['mechanic'] {
  if (!mechanic) return 'unknown'
  const lower = mechanic.trim().toLowerCase()
  return MECHANIC_VALUES.has(lower as Exercise['mechanic']) ? (lower as Exercise['mechanic']) : 'unknown'
}

function normalizeMovementPattern(force: string | null | undefined): string {
  if (!force) return 'unknown'
  const slug = slugify(force)
  return slug || 'unknown'
}

function normalizeEquipment(equipment: string | null | undefined): string[] {
  if (!equipment) return [DEFAULT_EQUIPMENT]
  const trimmed = equipment.trim().toLowerCase()
  if (!trimmed) return [DEFAULT_EQUIPMENT]
  const mapped = EQUIPMENT_ALIASES[trimmed] ?? slugify(trimmed)
  return [mapped || DEFAULT_EQUIPMENT]
}

function normalizeDefaultRest(category: string | null | undefined): number {
  if (!category) return FALLBACK_DEFAULT_REST_SECONDS
  return DEFAULT_REST_SECONDS_BY_CATEGORY[category.trim().toLowerCase()] ?? FALLBACK_DEFAULT_REST_SECONDS
}

function muscleGroupFor(name: string): string {
  return MUSCLE_GROUPS[name.trim().toLowerCase()] ?? 'other'
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function curationScore(exercise: Exercise): number {
  const equipmentScore = EQUIPMENT_PRIORITY[exercise.equipment[0] ?? ''] ?? 0
  const mechanicScore = exercise.mechanic === 'compound' ? 5 : exercise.mechanic === 'isolation' ? 2 : 0
  const difficultyScore = exercise.difficulty === 'beginner' ? 3 : exercise.difficulty === 'intermediate' ? 2 : 1
  return equipmentScore + mechanicScore + difficultyScore + (SPECIALTY_NAME_MARKER.test(exercise.name) ? -20 : 0)
}

/**
 * Keeps a compact, gym-focused library. Categories that are not conventional
 * resistance training (stretching, cardio, plyometrics, strongman, Olympic and
 * powerlifting-specialist variants) are removed before choosing the most
 * broadly applicable strength movements. Ties are name-sorted so builds are
 * deterministic.
 */
function curateFocusedStrengthLibrary(exercises: Exercise[]): Exercise[] {
  // Unit callers and small imports use the normalizer without unexpectedly
  // losing records. The shipped upstream source is well above this limit.
  if (exercises.length <= FOCUSED_STRENGTH_EXERCISE_COUNT) return exercises
  return exercises
    .filter((exercise) => exercise.category.toLowerCase() === 'strength')
    .sort((a, b) => curationScore(b) - curationScore(a) || a.name.localeCompare(b.name))
    .slice(0, FOCUSED_STRENGTH_EXERCISE_COUNT)
}

/**
 * Normalizes free-exercise-db-shaped JSON into the domain Exercise model.
 * Invalid records are quarantined into `rejected` (with the original raw
 * value and a reason) rather than guessed at or silently dropped.
 *
 * Assumptions (report to Codex): movementPattern is derived from the
 * source's `force` field (push/pull/static) since no dedicated
 * movement-pattern taxonomy exists upstream; primary muscles are weighted
 * 1.0 and secondary muscles 0.5 (see engines/shared/muscleContribution.ts);
 * defaultRestSeconds is derived from `category` with a 90s fallback. No
 * media is downloaded — `images` paths are copied through as-is.
 */
export function importCatalog(raw: unknown): ImportResult {
  const rejected: ImportResult['rejected'] = []

  if (!Array.isArray(raw)) {
    rejected.push({ index: -1, reason: 'root value is not an array', raw })
    return { exercises: [], muscles: [], rejected, curatedOutCount: 0 }
  }

  const exercises: Exercise[] = []
  const musclesById = new Map<string, Muscle>()
  const seenIds = new Set<string>()

  raw.forEach((record, index) => {
    if (typeof record !== 'object' || record === null) {
      rejected.push({ index, reason: 'record is not an object', raw: record })
      return
    }

    const r = record as RawExerciseRecord
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    if (!name) {
      rejected.push({ index, reason: 'missing or empty name', raw: record })
      return
    }

    const primaryMuscles = toStringArray(r.primaryMuscles)
    const secondaryMuscles = toStringArray(r.secondaryMuscles)
    if (primaryMuscles.length === 0 && secondaryMuscles.length === 0) {
      rejected.push({ index, reason: 'no primary or secondary muscles specified', raw: record })
      return
    }

    const rawId = typeof r.id === 'string' ? r.id.trim() : ''
    const id = slugify(rawId || name)
    if (!id) {
      rejected.push({ index, reason: 'unable to derive a stable id', raw: record })
      return
    }
    if (seenIds.has(id)) {
      rejected.push({ index, reason: `duplicate id "${id}"`, raw: record })
      return
    }
    seenIds.add(id)

    // Primary takes precedence: if the same normalized muscle id appears in
    // both arrays (or repeated within one array, including case/spacing
    // variants that normalize to the same id), it is recorded once, with
    // the primary weight.
    const weightByMuscleId = new Map<string, number>()
    for (const muscleName of primaryMuscles) {
      const muscleId = slugify(muscleName)
      if (!muscleId) continue
      weightByMuscleId.set(muscleId, PRIMARY_CONTRIBUTION_WEIGHT)
      if (!musclesById.has(muscleId)) {
        musclesById.set(muscleId, { id: muscleId, name: muscleName, group: muscleGroupFor(muscleName), aliases: [] })
      }
    }
    for (const muscleName of secondaryMuscles) {
      const muscleId = slugify(muscleName)
      if (!muscleId) continue
      if (!weightByMuscleId.has(muscleId)) weightByMuscleId.set(muscleId, SECONDARY_CONTRIBUTION_WEIGHT)
      if (!musclesById.has(muscleId)) {
        musclesById.set(muscleId, { id: muscleId, name: muscleName, group: muscleGroupFor(muscleName), aliases: [] })
      }
    }
    const muscles: MuscleContribution[] = [...weightByMuscleId.entries()].map(([muscleId, weight]) => ({ muscleId, weight }))

    if (muscles.length === 0) {
      rejected.push({ index, reason: 'muscle names could not be normalized to valid ids', raw: record })
      return
    }

    exercises.push({
      id,
      name,
      aliases: [],
      category: typeof r.category === 'string' && r.category.trim() ? r.category.trim() : 'uncategorized',
      movementPattern: normalizeMovementPattern(r.force),
      difficulty: normalizeDifficulty(r.level),
      mechanic: normalizeMechanic(r.mechanic),
      equipment: normalizeEquipment(r.equipment),
      instructions: toStringArray(r.instructions),
      muscles,
      defaultRestSeconds: normalizeDefaultRest(r.category),
      media: toStringArray(r.images),
      source: 'catalog',
      excluded: false,
    })
  })

  const curatedExercises = curateFocusedStrengthLibrary(exercises)
  const includedMuscleIds = new Set(curatedExercises.flatMap((exercise) => exercise.muscles.map((muscle) => muscle.muscleId)))
  return {
    exercises: curatedExercises,
    muscles: [...musclesById.values()].filter((muscle) => includedMuscleIds.has(muscle.id)),
    rejected,
    curatedOutCount: exercises.length - curatedExercises.length,
  }
}
