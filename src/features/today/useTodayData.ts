import type { Workout } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery, type LiveQueryState } from '../../data/useLiveQuery'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { currentWeekRange, isWithinWeek } from './weekSummary'

export interface TodayData {
  activeWorkout: Workout | undefined
  lastCompletedWorkout: Workout | undefined
  weekCompletedWorkoutCount: number
  weekCompletedWorkingSetCount: number
}

async function queryTodayData(db: RepwiseDatabase, now: () => Date): Promise<TodayData> {
  const workoutRepo = new DexieWorkoutRepository(db)
  const workoutExerciseRepo = new DexieWorkoutExerciseRepository(db)
  const setRepo = new DexieSetRepository(db)

  const activeWorkout = await workoutRepo.getActive()
  const completed = await workoutRepo.listHistory()
  const lastCompletedWorkout = completed[0]

  const weekRange = currentWeekRange(now())
  const weekWorkouts = completed.filter((w) => isWithinWeek(w.date, weekRange))

  let weekCompletedWorkingSetCount = 0
  for (const workout of weekWorkouts) {
    const workoutExercises = await workoutExerciseRepo.listByWorkout(workout.id)
    for (const workoutExercise of workoutExercises) {
      const sets = await setRepo.listByWorkoutExercise(workoutExercise.id)
      weekCompletedWorkingSetCount += sets.filter((s) => s.completed && s.type === 'working').length
    }
  }

  return { activeWorkout, lastCompletedWorkout, weekCompletedWorkoutCount: weekWorkouts.length, weekCompletedWorkingSetCount }
}

/** Live Today summary: active workout, last completed workout, and current-week completed-workout/working-set totals. */
export function useTodayData(db: RepwiseDatabase, now: () => Date = () => new Date()): LiveQueryState<TodayData> {
  return useLiveQuery(() => queryTodayData(db, now), [db])
}
