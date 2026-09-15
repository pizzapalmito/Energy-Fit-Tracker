import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'

export interface ExerciseProgressMetric { exerciseId: string; name: string; bestLoadKg: number; estimatedOneRepMaxKg: number; totalVolumeKg: number; sessions: number }

export function estimatedOneRepMax(loadKg: number | undefined, reps: number | undefined): number {
  if (!loadKg || !reps || loadKg < 0 || reps < 1) return 0
  return Math.round(loadKg * (1 + Math.min(reps, 30) / 30) * 10) / 10
}

/**
 * Historical records (personal bests, volume, session counts) must reflect only completed
 * workouts — an active workout's in-progress sets or a discarded workout's sets must never
 * contribute, even though their WorkoutSet rows are `completed: true`.
 */
export function buildExerciseProgress(exercises: WorkoutExercise[], sets: WorkoutSet[], workouts: Workout[]): ExerciseProgressMetric[] {
  const completedWorkoutIds = new Set(workouts.filter((workout) => workout.status === 'completed').map((workout) => workout.id))
  const byInstance = new Map(exercises.filter((exercise) => completedWorkoutIds.has(exercise.workoutId)).map((exercise) => [exercise.id, exercise]))
  const metrics = new Map<string, ExerciseProgressMetric & { sessionIds: Set<string> }>()
  for (const set of sets) {
    if (!set.completed || set.type !== 'working') continue
    const instance = byInstance.get(set.workoutExerciseId)
    if (!instance) continue
    const existing = metrics.get(instance.exerciseId) ?? { exerciseId: instance.exerciseId, name: instance.snapshot.name, bestLoadKg: 0, estimatedOneRepMaxKg: 0, totalVolumeKg: 0, sessions: 0, sessionIds: new Set<string>() }
    existing.bestLoadKg = Math.max(existing.bestLoadKg, set.loadKg ?? 0)
    existing.estimatedOneRepMaxKg = Math.max(existing.estimatedOneRepMaxKg, estimatedOneRepMax(set.loadKg, set.reps))
    existing.totalVolumeKg += (set.loadKg ?? 0) * (set.reps ?? 0)
    existing.sessionIds.add(instance.workoutId)
    metrics.set(instance.exerciseId, existing)
  }
  return [...metrics.values()].map(({ sessionIds, ...metric }) => ({ ...metric, sessions: sessionIds.size })).sort((a, b) => b.estimatedOneRepMaxKg - a.estimatedOneRepMaxKg || a.name.localeCompare(b.name))
}

export function workoutDurationMinutes(workout: Workout): number {
  if (!workout.endTime) return 0
  return Math.max(0, Math.round((Date.parse(workout.endTime) - Date.parse(workout.startTime)) / 60000))
}

/** Monday of the local calendar week containing `date` (Mon=1..Sun=7), as a YYYY-MM-DD key, ignoring time-of-day. */
function localWeekStartKey(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  const month = String(monday.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(monday.getDate()).padStart(2, '0')
  return `${monday.getFullYear()}-${month}-${dayOfMonth}`
}

/** Parses a `YYYY-MM-DD` workout date as a local-midnight Date, matching how it was produced (see todayIsoDate). */
function parseLocalIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year!, (month ?? 1) - 1, day)
}

/**
 * Percentage of distinct Monday-based local/calendar weeks — the current week plus the
 * previous `weeks - 1` weeks — that contain at least one completed workout. Only weeks
 * within that fixed window count, so the result is always clamped to 0..100 regardless of
 * how workout dates land relative to `now` (a rolling millisecond window could previously
 * span more distinct weeks than `weeks`, pushing the percentage above 100). Workouts dated
 * later than today (local date, compared date-only so time-of-day never excludes today's
 * own workout) are excluded even when they fall inside the current calendar week.
 */
export function trainingConsistency(workouts: Workout[], now = new Date(), weeks = 8): number {
  if (weeks <= 0) return 0
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentWeekStart = parseLocalIsoDate(localWeekStartKey(now))
  const allowedWeeks = new Set<string>()
  for (let i = 0; i < weeks; i += 1) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(currentWeekStart.getDate() - i * 7)
    allowedWeeks.add(localWeekStartKey(weekStart))
  }

  const activeWeeks = new Set<string>()
  for (const workout of workouts) {
    if (workout.status !== 'completed') continue
    const workoutDate = parseLocalIsoDate(workout.date)
    if (workoutDate.getTime() > today.getTime()) continue
    const key = localWeekStartKey(workoutDate)
    if (allowedWeeks.has(key)) activeWeeks.add(key)
  }

  const percent = (activeWeeks.size / weeks) * 100
  return Math.round(Math.min(100, Math.max(0, percent)))
}
