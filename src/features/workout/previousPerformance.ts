import type { EntityId, Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { kgToDisplayWeight, type WeightUnit } from './units'

export interface PreviousPerformance {
  workout: Workout
  workoutExercise: WorkoutExercise
  sets: WorkoutSet[]
}

function workoutTimestamp(workout: Workout): string {
  return `${workout.date}T${workout.startTime}`
}

/**
 * Most recent *completed* prior instance of an exercise, excluding the
 * current in-progress workout. Used to show "last time" context on a
 * workout exercise card.
 */
export async function findPreviousPerformance(db: RepwiseDatabase, exerciseId: EntityId, excludeWorkoutId: EntityId): Promise<PreviousPerformance | undefined> {
  const workoutExerciseRepo = new DexieWorkoutExerciseRepository(db)
  const workoutRepo = new DexieWorkoutRepository(db)
  const setRepo = new DexieSetRepository(db)

  const candidates = await workoutExerciseRepo.listByExerciseId(exerciseId)
  const relevantCandidates = candidates.filter((we) => we.workoutId !== excludeWorkoutId)
  if (relevantCandidates.length === 0) return undefined

  const completedWorkouts = await workoutRepo.listHistory()
  const completedById = new Map(completedWorkouts.map((w) => [w.id, w]))

  const completedCandidates = relevantCandidates
    .flatMap((workoutExercise) => {
      const workout = completedById.get(workoutExercise.workoutId)
      return workout ? [{ workout, workoutExercise }] : []
    })
    .sort((a, b) => workoutTimestamp(b.workout).localeCompare(workoutTimestamp(a.workout)))

  for (const candidate of completedCandidates) {
    const sets = await setRepo.listByWorkoutExercise(candidate.workoutExercise.id)
    if (sets.some((set) => set.completed)) return { ...candidate, sets }
  }
  return undefined
}

/** Compact "last time" summary of working sets, e.g. "60kg×8, 60kg×8, 65kg×6". */
export function summarizeWorkingSets(sets: WorkoutSet[], formatLoad: (kg: number | undefined) => string): string {
  const working = sets.filter((s) => s.type === 'working' && s.completed)
  if (working.length === 0) return 'No completed working sets recorded.'
  return working.map((s) => `${formatLoad(s.loadKg)}×${s.reps ?? '—'}`).join(', ')
}

/** Formats one completed historical set for the compact active-workout Previous column. */
export function formatPreviousSet(set: WorkoutSet | undefined, unit: WeightUnit): string {
  if (!set) return '—'
  const load = set.loadKg === undefined ? '—' : `${kgToDisplayWeight(set.loadKg, unit)} ${unit}`
  return `${load} × ${set.reps ?? '—'}`
}
