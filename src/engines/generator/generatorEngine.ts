import type { GeneratedWorkout, GeneratorInput, RecoveryResult, WorkoutGenerator, WorkoutSplit } from '../../domain/contracts'
import type { Exercise } from '../../domain/models'
import { PRIMARY_WEIGHT_THRESHOLD } from '../shared/muscleContribution'
import { PROGRESSION_GOAL_PRESETS } from '../progression/progressionEngine'

export const GENERATOR_ENGINE_VERSION = 'generator-v2'

/** Rough per-set time budget used only to decide how many exercises fit in the session. */
export const ESTIMATED_WORK_SECONDS_PER_SET = 45
const MAX_EXERCISES_PER_MOVEMENT_PATTERN = 2
const ALWAYS_AVAILABLE_EQUIPMENT = 'bodyweight'

/**
 * Built-in splits map to a fixed set of canonical (free-exercise-db-derived)
 * muscle ids. `full_body` and `recovery_adaptive` are intentionally absent:
 * both consider every muscle the catalog can target, differing only in that
 * `recovery_adaptive` is explicitly documented as pure highest-readiness
 * selection (which is already how muscle priority ordering works below).
 * `custom` is also absent: its targets come from `customTargetMuscleIds`.
 */
export const SPLIT_TARGET_MUSCLE_IDS: Partial<Record<WorkoutSplit, readonly string[]>> = {
  upper: ['chest', 'lats', 'middle-back', 'lower-back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'neck'],
  lower: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['lats', 'middle-back', 'lower-back', 'traps', 'biceps', 'forearms'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'],
}

export function estimateExerciseSeconds(sets: number, restSeconds: number): number {
  return sets * ESTIMATED_WORK_SECONDS_PER_SET + Math.max(0, sets - 1) * restSeconds
}

function isEquipmentAvailable(exercise: Exercise, availableEquipment: readonly string[]): boolean {
  const available = new Set(availableEquipment)
  return exercise.equipment.every((eq) => eq === ALWAYS_AVAILABLE_EQUIPMENT || available.has(eq))
}

/** Deterministic 32-bit FNV-1a style hash of a seed string. */
function seededHash(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function resolveTargetMuscleIds(input: GeneratorInput, allMuscleIds: readonly string[]): Set<string> {
  if (input.split === 'custom') return new Set(input.customTargetMuscleIds ?? [])
  const preset = SPLIT_TARGET_MUSCLE_IDS[input.split]
  return preset ? new Set(preset) : new Set(allMuscleIds)
}

/**
 * Local, deterministic, pure workout generator. Given the same normalized
 * inputs (including `seed`) and the same catalog/recovery snapshots, always
 * produces the same GeneratedWorkout, and never plans more estimated time
 * than `durationMinutes` allows.
 *
 * Selection strategy: resolve the split to a target muscle set (built-in
 * splits map to fixed muscle ids; `custom` uses `customTargetMuscleIds`;
 * `full_body`/`recovery_adaptive` leave every muscle eligible), restrict
 * candidates to exercises with a primary muscle in that target set, rank
 * those muscles by recovery readiness (most-recovered first, ties broken by
 * muscle id), rotate that priority order by a hash of the seed (so different
 * seeds explore different starting muscles/exercise mixes), then greedily
 * pick the best-scoring, not-yet-chosen exercise per muscle while respecting
 * a movement-pattern balance cap and the session duration budget. Exercise-
 * vs-exercise score ties are always broken by exercise id (never by seed).
 */
export class DeterministicWorkoutGenerator implements WorkoutGenerator {
  generate(input: GeneratorInput, exercises: Exercise[], recovery: RecoveryResult[]): GeneratedWorkout {
    const excluded = new Set(input.excludedExerciseIds)
    const usable = exercises.filter(
      (e) => !e.excluded && !excluded.has(e.id) && isEquipmentAvailable(e, input.availableEquipment),
    )

    const readinessByMuscle = new Map(recovery.map((r) => [r.muscleId, r.recommendationReadiness]))
    const readinessOf = (muscleId: string): number => readinessByMuscle.get(muscleId) ?? 100

    const allPrimaryMuscleIds = [
      ...new Set(
        usable.flatMap((e) => e.muscles.filter((m) => m.weight >= PRIMARY_WEIGHT_THRESHOLD).map((m) => m.muscleId)),
      ),
    ]
    const targetMuscleIds = resolveTargetMuscleIds(input, allPrimaryMuscleIds)
    const targetedUsable = usable.filter((e) =>
      e.muscles.some((m) => m.weight >= PRIMARY_WEIGHT_THRESHOLD && targetMuscleIds.has(m.muscleId)),
    )

    const muscleIds = [
      ...new Set(
        targetedUsable.flatMap((e) =>
          e.muscles.filter((m) => m.weight >= PRIMARY_WEIGHT_THRESHOLD && targetMuscleIds.has(m.muscleId)).map((m) => m.muscleId),
        ),
      ),
    ]
    const sortedMuscles = muscleIds.slice().sort((a, b) => readinessOf(b) - readinessOf(a) || a.localeCompare(b))
    const rotation = sortedMuscles.length > 0 ? seededHash(input.seed) % sortedMuscles.length : 0
    const muscleOrder = [...sortedMuscles.slice(rotation), ...sortedMuscles.slice(0, rotation)]

    const preset = PROGRESSION_GOAL_PRESETS[input.goal]
    const budgetSeconds = input.durationMinutes * 60
    let usedSeconds = 0
    const chosenIds = new Set<string>()
    const patternCounts = new Map<string, number>()
    const planned: GeneratedWorkout['exercises'] = []

    for (const muscleId of muscleOrder) {
      const candidates = targetedUsable.filter(
        (e) =>
          !chosenIds.has(e.id) &&
          e.muscles.some((m) => m.muscleId === muscleId && m.weight >= PRIMARY_WEIGHT_THRESHOLD) &&
          (patternCounts.get(e.movementPattern) ?? 0) < MAX_EXERCISES_PER_MOVEMENT_PATTERN,
      )
      if (candidates.length === 0) continue

      const best = candidates
        .map((e) => ({ exercise: e, score: readinessOf(muscleId) + (e.mechanic === 'compound' ? 5 : 0) }))
        .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))[0]!.exercise

      const sets = preset.setsHigh
      const cost = estimateExerciseSeconds(sets, preset.restSeconds)
      // Never plan more estimated time than the session budget allows, even for the first exercise.
      if (usedSeconds + cost > budgetSeconds) continue

      chosenIds.add(best.id)
      patternCounts.set(best.movementPattern, (patternCounts.get(best.movementPattern) ?? 0) + 1)
      usedSeconds += cost

      const reasons = [
        `targets "${muscleId}" at ${readinessOf(muscleId).toFixed(0)} recovery readiness`,
        `movement pattern: ${best.movementPattern}${best.mechanic === 'compound' ? ' (compound)' : ''}`,
      ]
      const recommendedLoadKg = input.recentSuccessfulLoadByExerciseId?.[best.id]
      if (recommendedLoadKg !== undefined) {
        reasons.push(`recommended load from recent successful sets: ${recommendedLoadKg}kg`)
      }

      planned.push({
        exerciseId: best.id,
        sets,
        repRange: [preset.repRangeLow, preset.repRangeHigh],
        restSeconds: preset.restSeconds,
        reasons,
        ...(recommendedLoadKg !== undefined ? { recommendedLoadKg } : {}),
      })
    }

    return {
      name: `${input.split} — ${input.goal}`,
      exercises: planned,
      engineVersion: GENERATOR_ENGINE_VERSION,
      seed: input.seed,
      estimatedDurationSeconds: usedSeconds,
    }
  }
}
