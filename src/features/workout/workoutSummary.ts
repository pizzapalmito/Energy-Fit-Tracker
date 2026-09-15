import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'

export type ExerciseSummaryStatus = 'complete' | 'partial' | 'skipped'

export interface ExerciseSummary {
  workoutExerciseId: string
  name: string
  completedSetCount: number
  totalSetCount: number
  status: ExerciseSummaryStatus
  bestLoadKg?: number
}

export interface WorkoutSummary {
  workout: Workout
  durationSeconds: number | undefined
  completedSetCount: number
  totalSetCount: number
  volumeKg: number
  exercises: ExerciseSummary[]
}

function statusFor(totalSetCount: number, completedSetCount: number): ExerciseSummaryStatus {
  if (totalSetCount === 0 || completedSetCount === 0) return 'skipped'
  return completedSetCount === totalSetCount ? 'complete' : 'partial'
}

/**
 * Deterministic presentation summary built only from persisted completed-workout facts: a
 * completed set's recorded load/reps and the exercise snapshot recorded at logging time.
 * Never estimates a duration, calorie, or set count that was not actually recorded.
 */
export function buildWorkoutSummary(workout: Workout, exercises: WorkoutExercise[], setsByExerciseId: Map<string, WorkoutSet[]>): WorkoutSummary {
  if (workout.status != "completed") throw new Error("Only completed workouts have a summary")
  const orderedExercises = exercises.filter((exercise) => exercise.workoutId === workout.id).sort((a, b) => a.order - b.order)
  let completedSetCount = 0
  let totalSetCount = 0
  let volumeKg = 0

  const exerciseSummaries: ExerciseSummary[] = orderedExercises.map((exercise) => {
    const sets = (setsByExerciseId.get(exercise.id) ?? []).filter((set) => set.workoutExerciseId === exercise.id)
    const completedSets = sets.filter((set) => set.completed)
    completedSetCount += completedSets.length
    totalSetCount += sets.length
    volumeKg += completedSets.reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0)
    const bestLoadKg = completedSets.reduce<number | undefined>(
      (best, set) => set.loadKg === undefined ? best : Math.max(best ?? 0, set.loadKg),
      undefined,
    )
    return {
      workoutExerciseId: exercise.id,
      name: exercise.snapshot.name,
      completedSetCount: completedSets.length,
      totalSetCount: sets.length,
      status: statusFor(sets.length, completedSets.length),
      bestLoadKg,
    }
  })

  const elapsed = workout.endTime ? Date.parse(workout.endTime) - Date.parse(workout.startTime) : NaN
  const durationSeconds = Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed / 1000) : undefined

  return { workout, durationSeconds, completedSetCount, totalSetCount, volumeKg, exercises: exerciseSummaries }
}
