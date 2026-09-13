import { useEffect, useState } from 'react'
import type { Exercise } from '../../domain/models'
import type { Muscle } from '../../data/types'
import type { RepwiseDatabase } from '../../data/db'
import { DexieExerciseRepository } from '../../data/repositories/exerciseRepository'
import { DexieMuscleRepository } from '../../data/repositories/muscleRepository'
import { useCatalogReadiness } from '../../catalog/useCatalogReadiness'

export type ExerciseCatalogState =
  | { status: 'loading' }
  | { status: 'blocked-error'; message: string }
  | { status: 'ready'; exercises: Exercise[]; muscles: Muscle[]; catalogNotice?: string }

/**
 * Reads exercises/muscles straight from Dexie (so custom exercises and any
 * previously-cached catalog data show up immediately) and re-reads whenever
 * catalog seeding transitions, so a freshly-seeded catalog appears without a
 * reload. Only reports a blocking state when there is no usable data at all.
 */
export function useExerciseCatalog(db: RepwiseDatabase): ExerciseCatalogState {
  const readiness = useCatalogReadiness()
  const [dexieState, setDexieState] = useState<{ loaded: boolean; exercises: Exercise[]; muscles: Muscle[]; error?: string }>({
    loaded: false,
    exercises: [],
    muscles: [],
  })

  useEffect(() => {
    let cancelled = false
    const exerciseRepo = new DexieExerciseRepository(db)
    const muscleRepo = new DexieMuscleRepository(db)
    Promise.all([exerciseRepo.list(), muscleRepo.list()])
      .then(([exercises, muscles]) => {
        if (!cancelled) setDexieState({ loaded: true, exercises, muscles })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDexieState({ loaded: true, exercises: [], muscles: [], error: error instanceof Error ? error.message : 'Failed to read the local exercise database.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [db, readiness.status])

  if (dexieState.error) {
    return { status: 'blocked-error', message: dexieState.error }
  }
  if (!dexieState.loaded || (dexieState.exercises.length === 0 && readiness.status === 'loading')) {
    return { status: 'loading' }
  }
  if (dexieState.exercises.length === 0 && readiness.status === 'error') {
    return { status: 'blocked-error', message: readiness.message }
  }
  return {
    status: 'ready',
    exercises: dexieState.exercises,
    muscles: dexieState.muscles,
    catalogNotice: readiness.status === 'error' ? `Catalog update failed (${readiness.message}). Showing previously loaded exercises.` : undefined,
  }
}
