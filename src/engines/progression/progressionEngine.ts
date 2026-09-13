import type { ProgressionEngine, ProgressionSuggestion } from '../../domain/contracts'
import type { TrainingGoal, WorkoutSet } from '../../domain/models'

export const PROGRESSION_ENGINE_VERSION = 'progression-v1'

export interface GoalPreset {
  repRangeLow: number
  repRangeHigh: number
  setsLow: number
  setsHigh: number
  restSeconds: number
}

/** Versioned goal presets: rep range / set range / rest seconds. */
export const PROGRESSION_GOAL_PRESETS: Record<TrainingGoal, GoalPreset> = {
  strength: { repRangeLow: 3, repRangeHigh: 6, setsLow: 3, setsHigh: 5, restSeconds: 180 },
  hypertrophy: { repRangeLow: 6, repRangeHigh: 12, setsLow: 3, setsHigh: 4, restSeconds: 120 },
  general: { repRangeLow: 8, repRangeHigh: 15, setsLow: 2, setsHigh: 4, restSeconds: 90 },
  endurance: { repRangeLow: 12, repRangeHigh: 20, setsLow: 2, setsHigh: 4, restSeconds: 60 },
  maintenance: { repRangeLow: 6, repRangeHigh: 15, setsLow: 2, setsHigh: 3, restSeconds: 120 },
}

/** Versioned double-progression thresholds. */
export const PROGRESSION_CONFIG = {
  /** A set counts as "at target effort" when its RIR (or RPE-derived RIR) is at or below this. */
  targetEffortMaxRir: 1,
  reduceLoadPercent: 0.05,
  deloadPercent: 0.1,
  failedExposuresForReduce: 2,
  failedExposuresForDeload: 3,
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function effectiveRir(set: WorkoutSet): number | undefined {
  if (typeof set.rir === 'number') return set.rir
  if (typeof set.rpe === 'number') return 10 - set.rpe
  return undefined
}

function isAtTargetEffort(set: WorkoutSet): boolean {
  const rir = effectiveRir(set)
  return rir !== undefined && rir <= PROGRESSION_CONFIG.targetEffortMaxRir
}

/** One "exposure" = the working sets logged for one instance (workoutExercise) of the movement. */
function groupExposures(history: WorkoutSet[]): WorkoutSet[][] {
  const byExposure = new Map<string, WorkoutSet[]>()
  for (const set of history) {
    const list = byExposure.get(set.workoutExerciseId) ?? []
    list.push(set)
    byExposure.set(set.workoutExerciseId, list)
  }
  const groups = [...byExposure.values()]
  const earliestTimestamp = (sets: WorkoutSet[]): string => {
    const timestamps = sets.map((s) => s.completedAt).filter((t): t is string => typeof t === 'string')
    return timestamps.length > 0 ? timestamps.sort()[0]! : ''
  }
  return groups.sort((a, b) => earliestTimestamp(a).localeCompare(earliestTimestamp(b)))
}

function workingSets(exposure: WorkoutSet[]): WorkoutSet[] {
  return exposure.filter((s) => s.type === 'working')
}

function isFailedExposure(exposure: WorkoutSet[], preset: GoalPreset): boolean {
  const working = workingSets(exposure)
  if (working.length === 0) return false
  return working.some((s) => !s.completed || (s.reps ?? 0) < preset.repRangeLow)
}

function isTopOfRangeExposure(exposure: WorkoutSet[], preset: GoalPreset): boolean {
  const working = workingSets(exposure)
  if (working.length === 0) return false
  return working.every((s) => s.completed && (s.reps ?? 0) >= preset.repRangeHigh && isAtTargetEffort(s))
}

function maxLoad(sets: WorkoutSet[]): number | undefined {
  const loads = sets.map((s) => s.loadKg).filter((load): load is number => typeof load === 'number')
  return loads.length > 0 ? Math.max(...loads) : undefined
}

/**
 * Deterministic, pure transparent double-progression engine. `history`
 * is expected to contain all sets (across sessions) for a single exercise,
 * ordered or not — exposures are reconstructed by grouping on
 * `workoutExerciseId` and sorting by earliest `completedAt`.
 */
export class DoubleProgressionEngine implements ProgressionEngine {
  suggest(history: WorkoutSet[], goal: TrainingGoal, incrementKg: number): ProgressionSuggestion {
    const preset = PROGRESSION_GOAL_PRESETS[goal]
    const exposures = groupExposures(history)

    if (exposures.length === 0) {
      return { action: 'repeat', reason: 'no prior exposures recorded; repeat the previous plan' }
    }

    const latest = exposures[exposures.length - 1]
    if (!latest) {
      return { action: 'repeat', reason: 'no prior exposures recorded; repeat the previous plan' }
    }
    const latestWorking = workingSets(latest)
    const lastLoad = maxLoad(latestWorking)

    if (isTopOfRangeExposure(latest, preset)) {
      return {
        action: 'increase_load',
        targetLoadKg: lastLoad !== undefined ? round1(lastLoad + incrementKg) : undefined,
        targetReps: preset.repRangeLow,
        reason: `all working sets reached ${preset.repRangeHigh} reps at target effort (RIR<=${PROGRESSION_CONFIG.targetEffortMaxRir}); increase load and reset to bottom of range`,
      }
    }

    let failStreak = 0
    for (let i = exposures.length - 1; i >= 0; i--) {
      const exposure = exposures[i]
      if (exposure && isFailedExposure(exposure, preset)) failStreak++
      else break
    }

    if (failStreak >= PROGRESSION_CONFIG.failedExposuresForDeload) {
      return {
        action: 'deload',
        targetLoadKg: lastLoad !== undefined ? round1(lastLoad * (1 - PROGRESSION_CONFIG.deloadPercent)) : undefined,
        reason: `${failStreak} consecutive failed exposures below ${preset.repRangeLow} reps; deloading ${PROGRESSION_CONFIG.deloadPercent * 100}%`,
      }
    }
    if (failStreak >= PROGRESSION_CONFIG.failedExposuresForReduce) {
      return {
        action: 'reduce_load',
        targetLoadKg: lastLoad !== undefined ? round1(lastLoad * (1 - PROGRESSION_CONFIG.reduceLoadPercent)) : undefined,
        reason: `${failStreak} consecutive failed exposures below ${preset.repRangeLow} reps; reducing load ${PROGRESSION_CONFIG.reduceLoadPercent * 100}%`,
      }
    }
    if (failStreak === 1) {
      return {
        action: 'repeat',
        targetLoadKg: lastLoad,
        reason: `did not reach ${preset.repRangeLow} reps on all working sets; repeat current load`,
      }
    }

    const currentTopReps = latestWorking.reduce((max, s) => Math.max(max, s.reps ?? 0), 0)
    const nextReps = Math.min(preset.repRangeHigh, currentTopReps + 1)
    return {
      action: 'increase_reps',
      targetLoadKg: lastLoad,
      targetReps: nextReps,
      reason: `progressing reps toward the top of the ${preset.repRangeLow}-${preset.repRangeHigh} range at the same load`,
    }
  }
}
