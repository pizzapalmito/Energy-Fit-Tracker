import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'

export interface ExerciseProgressMetric { exerciseId: string; name: string; bestLoadKg: number; estimatedOneRepMaxKg: number; totalVolumeKg: number; sessions: number }

export function estimatedOneRepMax(loadKg: number | undefined, reps: number | undefined): number {
  if (!loadKg || !reps || loadKg < 0 || reps < 1) return 0
  return Math.round(loadKg * (1 + Math.min(reps, 30) / 30) * 10) / 10
}

export function buildExerciseProgress(exercises: WorkoutExercise[], sets: WorkoutSet[]): ExerciseProgressMetric[] {
  const byInstance = new Map(exercises.map((exercise) => [exercise.id, exercise]))
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

export function trainingConsistency(workouts: Workout[], now = new Date(), weeks = 8): number {
  const activeWeeks = new Set<string>()
  const cutoff = now.getTime() - weeks * 7 * 86400000
  for (const workout of workouts) {
    const time = Date.parse(`${workout.date}T00:00:00Z`)
    if (workout.status !== 'completed' || time < cutoff || time > now.getTime()) continue
    const date = new Date(time)
    const day = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() - day + 1)
    activeWeeks.add(date.toISOString().slice(0, 10))
  }
  return Math.round(activeWeeks.size / weeks * 100)
}
