import type { RepwiseDatabase } from '../data/db'
import { applyExercisePolicy, SELECTION_POLICY_VERSION } from './selectionPolicy'

/** Also runs on same-version startup and old backup restore; never touches history. */
export async function enforceStoredExercisePolicy(db: RepwiseDatabase): Promise<void> {
  await db.transaction('rw', db.exercises, db.metadata, async () => {
    const current = await db.exercises.toArray()
    const retired = current.filter(exercise => !exercise.excluded && applyExercisePolicy(exercise).excluded)
    if (retired.length) await db.exercises.bulkPut(retired.map(applyExercisePolicy))
    await db.metadata.put({ key: 'catalogSelectionPolicy', value: SELECTION_POLICY_VERSION })
  })
}
