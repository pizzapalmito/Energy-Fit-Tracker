import type { RepwiseDatabase } from '../../data/db'
import type { WorkoutSet } from '../../domain/models'
import { useLiveQuery, type LiveQueryState } from '../../data/useLiveQuery'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { DexieSetRepository } from '../../data/repositories/setRepository'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { buildWorkoutSummary, type WorkoutSummary } from './workoutSummary'

async function loadSummary(db: RepwiseDatabase, workoutId: string): Promise<WorkoutSummary | undefined> {
  return db.transaction('r', db.workouts, db.workoutExercises, db.sets, async () => {
    const workout = (await new DexieWorkoutRepository(db).listHistory()).find((entry) => entry.id === workoutId)
    if (!workout || workout.status !== 'completed') return undefined

    const exercises = await new DexieWorkoutExerciseRepository(db).listByWorkout(workoutId)
    const setRepo = new DexieSetRepository(db)
    const setsByExerciseId = new Map<string, WorkoutSet[]>()
    for (const exercise of exercises) {
      setsByExerciseId.set(exercise.id, await setRepo.listByWorkoutExercise(exercise.id))
    }
    return buildWorkoutSummary(workout, exercises, setsByExerciseId)
  })
}

/** Live, reload-safe read of a completed workout's summary. `undefined` means missing or not (yet/anymore) completed — never a stale in-progress view. */
export function useWorkoutSummary(db: RepwiseDatabase, workoutId: string): LiveQueryState<WorkoutSummary | undefined> {
  return useLiveQuery(() => loadSummary(db, workoutId), [db, workoutId])
}
