import type { EntityId } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery, type LiveQueryState } from '../../data/useLiveQuery'
import { findPreviousPerformance, type PreviousPerformance } from './previousPerformance'

export function usePreviousPerformance(db: RepwiseDatabase, exerciseId: EntityId, excludeWorkoutId: EntityId): LiveQueryState<PreviousPerformance | undefined> {
  return useLiveQuery(() => findPreviousPerformance(db, exerciseId, excludeWorkoutId), [db, exerciseId, excludeWorkoutId])
}
