import type { RecoveryEngine, RecoveryResult } from '../../domain/contracts'
import type { RecoveryFeedback, SetType, SubjectiveState, Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'

export const RECOVERY_ENGINE_VERSION = 'recovery-v1'

export const SET_TYPE_MULTIPLIERS: Record<SetType, number> = {
  warmup: 0.25,
  working: 1,
  backoff: 0.85,
  dropset: 1.15,
  failure: 1.25,
}

/** Multiplier applied per completed set based on effort (RIR bucket). */
export const RIR_MULTIPLIERS: Record<'0' | '1' | '2' | '3' | '4plus', number> = {
  '0': 1.2,
  '1': 1.1,
  '2': 1.0,
  '3': 0.9,
  '4plus': 0.75,
}

/** Multiplier used when a set has neither RIR nor RPE recorded. */
export const DEFAULT_EFFORT_MULTIPLIER = 1.0

export const FATIGUE_POINTS_PER_STIMULUS_POINT = 12
export const RECOVERY_HALF_LIFE_HOURS = 36

export const SUBJECTIVE_READINESS_OFFSETS: Record<SubjectiveState, number> = {
  very_sore: -30,
  sore: -15,
  normal: 0,
  fresh: 10,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function rirMultiplier(rir: number): number {
  const bucket = Math.round(rir)
  if (bucket <= 0) return RIR_MULTIPLIERS['0']
  if (bucket === 1) return RIR_MULTIPLIERS['1']
  if (bucket === 2) return RIR_MULTIPLIERS['2']
  if (bucket === 3) return RIR_MULTIPLIERS['3']
  return RIR_MULTIPLIERS['4plus']
}

function effortMultiplier(set: WorkoutSet): number {
  if (typeof set.rir === 'number') return rirMultiplier(set.rir)
  if (typeof set.rpe === 'number') return rirMultiplier(10 - set.rpe)
  return DEFAULT_EFFORT_MULTIPLIER
}

/** Exponential decay with a fixed half-life; never amplifies (elapsed < 0 is treated as no decay). */
function decayFactor(hoursElapsed: number): number {
  if (hoursElapsed <= 0) return 1
  return Math.pow(0.5, hoursElapsed / RECOVERY_HALF_LIFE_HOURS)
}

/**
 * Deterministic, pure recovery engine. Consumes only completed sets, uses
 * the exercise snapshot captured on each WorkoutExercise (not live catalog
 * data, so historical fatigue math is stable even if the catalog changes
 * later), and applies exponential time decay per set based on `now`.
 */
export class DeterministicRecoveryEngine implements RecoveryEngine {
  calculate(
    now: string,
    workouts: Workout[],
    exercises: WorkoutExercise[],
    sets: WorkoutSet[],
    feedback: RecoveryFeedback[],
  ): RecoveryResult[] {
    const nowMs = Date.parse(now)
    const workoutExerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
    const discardedWorkoutIds = new Set(workouts.filter((w) => w.status === 'discarded').map((w) => w.id))

    const fatigueByMuscle = new Map<string, number>()
    const contributingSetsByMuscle = new Map<string, number>()

    for (const set of sets) {
      if (!set.completed || !set.completedAt) continue
      const workoutExercise = workoutExerciseById.get(set.workoutExerciseId)
      if (!workoutExercise) continue
      if (discardedWorkoutIds.has(workoutExercise.workoutId)) continue

      const elapsedHours = (nowMs - Date.parse(set.completedAt)) / 3_600_000
      if (!Number.isFinite(elapsedHours) || elapsedHours < 0) continue

      const stimulus = SET_TYPE_MULTIPLIERS[set.type] * effortMultiplier(set)
      const fatiguePoints = stimulus * FATIGUE_POINTS_PER_STIMULUS_POINT * decayFactor(elapsedHours)

      for (const contribution of workoutExercise.snapshot.muscles) {
        const delta = fatiguePoints * contribution.weight
        fatigueByMuscle.set(contribution.muscleId, (fatigueByMuscle.get(contribution.muscleId) ?? 0) + delta)
        contributingSetsByMuscle.set(contribution.muscleId, (contributingSetsByMuscle.get(contribution.muscleId) ?? 0) + 1)
      }
    }

    const nowDate = now.slice(0, 10)
    const latestFeedbackByMuscle = new Map<string, RecoveryFeedback>()
    for (const entry of feedback) {
      if (entry.date > nowDate) continue
      const existing = latestFeedbackByMuscle.get(entry.muscleId)
      if (!existing || entry.date > existing.date) latestFeedbackByMuscle.set(entry.muscleId, entry)
    }

    const muscleIds = new Set<string>([...fatigueByMuscle.keys(), ...latestFeedbackByMuscle.keys()])
    const results: RecoveryResult[] = []

    for (const muscleId of muscleIds) {
      const rawFatigue = fatigueByMuscle.get(muscleId) ?? 0
      const fatigue = clamp(rawFatigue, 0, 100)
      const calculatedRecovery = 100 - fatigue
      const feedbackEntry = latestFeedbackByMuscle.get(muscleId)
      const offset = feedbackEntry ? SUBJECTIVE_READINESS_OFFSETS[feedbackEntry.subjectiveState] : 0
      const recommendationReadiness = clamp(calculatedRecovery + offset, 0, 100)

      const explanation: string[] = []
      const setCount = contributingSetsByMuscle.get(muscleId) ?? 0
      explanation.push(`${setCount} completed set(s) contributed ${rawFatigue.toFixed(1)} raw fatigue point(s)`)
      if (rawFatigue !== fatigue) explanation.push(`fatigue clamped from ${rawFatigue.toFixed(1)} to ${fatigue.toFixed(1)}`)
      if (feedbackEntry) {
        explanation.push(
          `subjective state "${feedbackEntry.subjectiveState}" on ${feedbackEntry.date} applied ${offset >= 0 ? '+' : ''}${offset} readiness offset`,
        )
      } else {
        explanation.push('no subjective feedback available; readiness equals calculated recovery')
      }

      results.push({ muscleId, calculatedRecovery, recommendationReadiness, explanation, algorithmVersion: RECOVERY_ENGINE_VERSION })
    }

    return results.sort((a, b) => a.muscleId.localeCompare(b.muscleId))
  }
}
