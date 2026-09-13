import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery, type LiveQueryState } from '../../data/useLiveQuery'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'

export interface WorkoutExerciseWithSets {
  workoutExercise: WorkoutExercise
  sets: WorkoutSet[]
}

export interface ActiveWorkoutData {
  workout: Workout | undefined
  exercises: WorkoutExerciseWithSets[]
}

async function queryActiveWorkoutData(db: RepwiseDatabase): Promise<ActiveWorkoutData> {
  const workout = await new DexieWorkoutRepository(db).getActive()
  if (!workout) return { workout: undefined, exercises: [] }

  const workoutExercises = await new DexieWorkoutExerciseRepository(db).listByWorkout(workout.id)
  const setRepo = new DexieSetRepository(db)
  const exercises = await Promise.all(
    workoutExercises.map(async (workoutExercise) => ({ workoutExercise, sets: await setRepo.listByWorkoutExercise(workoutExercise.id) })),
  )
  return { workout, exercises }
}

/** Live view of the active workout (if any) with its exercises and sets, reactive to any write in those tables. */
export function useActiveWorkoutData(db: RepwiseDatabase): LiveQueryState<ActiveWorkoutData> {
  return useLiveQuery(() => queryActiveWorkoutData(db), [db])
}
