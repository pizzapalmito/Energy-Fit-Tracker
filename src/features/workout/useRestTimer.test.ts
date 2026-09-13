import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { DexieMetadataRepository } from '../../data/repositories/metadataRepository'
import { REST_TIMER_METADATA_KEY, parseRestTimerState } from './restTimer'
import { useRestTimer } from './useRestTimer'

let db: RepwiseDatabase
let counter = 0

// Controls Date.now() directly instead of vi.useFakeTimers(), which would also
// stall fake-indexeddb's internal task scheduling that Dexie depends on.
let currentTime = 1_700_000_000_000

beforeEach(async () => {
  counter += 1
  db = createDatabase(`rest-timer-${counter}`)
  await db.open()
  currentTime = 1_700_000_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function advance(ms: number) {
  currentTime += ms
}

describe('useRestTimer', () => {
  it('starts idle with no active timer', async () => {
    const { result } = renderHook(() => useRestTimer(db))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.workoutExerciseId).toBeUndefined()
    expect(result.current.running).toBe(false)
  })

  it('start/pause/resume/+15/-15/skip all work and persist immediately', async () => {
    const { result } = renderHook(() => useRestTimer(db))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.start('we-1', 90))
    expect(result.current.running).toBe(true)
    expect(result.current.remainingSeconds).toBe(90)

    let persisted = parseRestTimerState(await new DexieMetadataRepository(db).get(REST_TIMER_METADATA_KEY))
    expect(persisted?.running).toBe(true)

    advance(30_000)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.remainingSeconds).toBe(60)

    act(() => result.current.pause())
    expect(result.current.running).toBe(false)
    expect(result.current.remainingSeconds).toBe(60)

    // Remaining stays frozen while paused, even as real/elapsed time passes.
    advance(20_000)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.remainingSeconds).toBe(60)

    act(() => result.current.resume())
    expect(result.current.running).toBe(true)
    expect(result.current.remainingSeconds).toBe(60)

    act(() => result.current.adjust(15))
    expect(result.current.remainingSeconds).toBe(75)

    act(() => result.current.adjust(-15))
    expect(result.current.remainingSeconds).toBe(60)

    // -15s repeatedly must never cross zero.
    act(() => result.current.adjust(-1000))
    expect(result.current.remainingSeconds).toBe(0)

    act(() => result.current.skip())
    expect(result.current.workoutExerciseId).toBeUndefined()
    expect(result.current.remainingSeconds).toBe(0)

    persisted = parseRestTimerState(await new DexieMetadataRepository(db).get(REST_TIMER_METADATA_KEY))
    expect(persisted).toBeUndefined()
  })

  it('restores a running timer after remount, recomputed from elapsed real time', async () => {
    const first = renderHook(() => useRestTimer(db))
    await waitFor(() => expect(first.result.current.loaded).toBe(true))
    act(() => first.result.current.start('we-1', 120))
    first.unmount()

    advance(50_000)

    const second = renderHook(() => useRestTimer(db))
    await waitFor(() => expect(second.result.current.loaded).toBe(true))
    expect(second.result.current.running).toBe(true)
    expect(second.result.current.workoutExerciseId).toBe('we-1')
    expect(second.result.current.remainingSeconds).toBe(70)
  })

  it('recomputes remaining time on tab visibility change rather than trusting a stale value', async () => {
    const { result } = renderHook(() => useRestTimer(db))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => result.current.start('we-1', 60))

    // Advance elapsed time without any state-changing call (simulates a backgrounded tab).
    advance(40_000)

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.remainingSeconds).toBe(20)
  })
})
