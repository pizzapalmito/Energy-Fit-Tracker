import type { EntityId } from '../../domain/models'

export const REST_TIMER_METADATA_KEY = 'restTimerState'

/**
 * Rest timer state persisted verbatim to app metadata. Correctness hinges on
 * `endsAt` being an absolute epoch-ms timestamp (not a decrement-only
 * counter) so remaining time can always be recomputed from `Date.now()`
 * after a reload, remount, or tab visibility change.
 */
export interface RestTimerState {
  workoutExerciseId: EntityId
  totalSeconds: number
  /** Absolute epoch ms the rest period ends. Only meaningful while `running`. */
  endsAt: number | null
  /** Authoritative remaining seconds while paused (not running). */
  remainingSeconds: number
  running: boolean
}

export function serializeRestTimerState(state: RestTimerState): string {
  return JSON.stringify(state)
}

export function parseRestTimerState(raw: string | undefined): RestTimerState | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return undefined
    const candidate = parsed as Partial<RestTimerState>
    if (
      typeof candidate.workoutExerciseId === 'string' &&
      typeof candidate.totalSeconds === 'number' && Number.isFinite(candidate.totalSeconds) && candidate.totalSeconds >= 0 &&
      (candidate.endsAt === null || (typeof candidate.endsAt === 'number' && Number.isFinite(candidate.endsAt))) &&
      typeof candidate.remainingSeconds === 'number' && Number.isFinite(candidate.remainingSeconds) && candidate.remainingSeconds >= 0 &&
      typeof candidate.running === 'boolean'
    ) return candidate as RestTimerState
    return undefined
  } catch {
    return undefined
  }
}

export function computeRemainingSeconds(state: RestTimerState, now: number): number {
  if (!state.running || state.endsAt === null) return Math.max(0, state.remainingSeconds)
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000))
}

export function startRestTimer(workoutExerciseId: EntityId, totalSeconds: number, now: number): RestTimerState {
  return { workoutExerciseId, totalSeconds, endsAt: now + totalSeconds * 1000, remainingSeconds: totalSeconds, running: true }
}

export function pauseRestTimer(state: RestTimerState, now: number): RestTimerState {
  if (!state.running) return state
  return { ...state, running: false, endsAt: null, remainingSeconds: computeRemainingSeconds(state, now) }
}

export function resumeRestTimer(state: RestTimerState, now: number): RestTimerState {
  if (state.running || state.remainingSeconds <= 0) return state
  return { ...state, running: true, endsAt: now + state.remainingSeconds * 1000 }
}

/** Adjusts remaining time by `deltaSeconds` (positive or negative), clamped so it never goes below zero. */
export function adjustRestTimer(state: RestTimerState, deltaSeconds: number, now: number): RestTimerState {
  const currentRemaining = computeRemainingSeconds(state, now)
  const nextRemaining = Math.max(0, currentRemaining + deltaSeconds)
  if (state.running) {
    return { ...state, endsAt: now + nextRemaining * 1000, remainingSeconds: nextRemaining }
  }
  return { ...state, remainingSeconds: nextRemaining }
}
