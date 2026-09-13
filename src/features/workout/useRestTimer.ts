import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EntityId } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { DexieMetadataRepository } from '../../data/repositories/metadataRepository'
import {
  REST_TIMER_METADATA_KEY,
  adjustRestTimer,
  computeRemainingSeconds,
  pauseRestTimer,
  parseRestTimerState,
  resumeRestTimer,
  serializeRestTimerState,
  startRestTimer,
  type RestTimerState,
} from './restTimer'

export interface RestTimerControls {
  loaded: boolean
  running: boolean
  workoutExerciseId: EntityId | undefined
  totalSeconds: number
  remainingSeconds: number
  start: (workoutExerciseId: EntityId, totalSeconds: number) => void
  pause: () => void
  resume: () => void
  adjust: (deltaSeconds: number) => void
  skip: () => void
}

/**
 * Rest timer backed by an absolute `endsAt` epoch timestamp persisted to app
 * metadata, so it survives reload/remount and recomputes correctly from
 * `Date.now()` rather than decrementing in place. A tick interval only
 * drives re-renders while running; the displayed value is always derived
 * fresh from `endsAt`, and a `visibilitychange` listener forces an
 * immediate recompute when the tab regains focus.
 */
export function useRestTimer(db: RepwiseDatabase): RestTimerControls {
  const metadataRepo = useMemo(() => new DexieMetadataRepository(db), [db])
  const [state, setState] = useState<RestTimerState | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    metadataRepo
      .get(REST_TIMER_METADATA_KEY)
      .then((raw) => {
        if (cancelled) return
        setState(parseRestTimerState(raw))
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [metadataRepo])

  useEffect(() => {
    const recompute = () => setTick((n) => n + 1)
    document.addEventListener('visibilitychange', recompute)
    return () => document.removeEventListener('visibilitychange', recompute)
  }, [])

  useEffect(() => {
    if (!state?.running) return
    const interval = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(interval)
  }, [state?.running])

  const persist = useCallback(
    (next: RestTimerState | undefined) => {
      setState(next)
      if (next) void metadataRepo.set(REST_TIMER_METADATA_KEY, serializeRestTimerState(next))
      else void metadataRepo.delete(REST_TIMER_METADATA_KEY)
    },
    [metadataRepo],
  )

  const start = useCallback((workoutExerciseId: EntityId, totalSeconds: number) => persist(startRestTimer(workoutExerciseId, totalSeconds, Date.now())), [persist])
  const pause = useCallback(() => {
    if (state) persist(pauseRestTimer(state, Date.now()))
  }, [state, persist])
  const resume = useCallback(() => {
    if (state) persist(resumeRestTimer(state, Date.now()))
  }, [state, persist])
  const adjust = useCallback(
    (deltaSeconds: number) => {
      if (state) persist(adjustRestTimer(state, deltaSeconds, Date.now()))
    },
    [state, persist],
  )
  const skip = useCallback(() => persist(undefined), [persist])

  const remainingSeconds = state ? computeRemainingSeconds(state, Date.now()) : 0

  return {
    loaded,
    running: state?.running ?? false,
    workoutExerciseId: state?.workoutExerciseId,
    totalSeconds: state?.totalSeconds ?? 0,
    remainingSeconds,
    start,
    pause,
    resume,
    adjust,
    skip,
  }
}
