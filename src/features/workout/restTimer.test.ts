import { describe, expect, it } from 'vitest'
import { adjustRestTimer, computeRemainingSeconds, pauseRestTimer, parseRestTimerState, resumeRestTimer, serializeRestTimerState, startRestTimer } from './restTimer'

const T0 = 1_700_000_000_000

describe('restTimer pure state machine', () => {
  it('start sets an absolute endsAt, not a decrementing counter', () => {
    const state = startRestTimer('we-1', 90, T0)
    expect(state).toEqual({ workoutExerciseId: 'we-1', totalSeconds: 90, endsAt: T0 + 90_000, remainingSeconds: 90, running: true })
  })

  it('computes remaining seconds from Date.now() against the absolute endsAt', () => {
    const state = startRestTimer('we-1', 90, T0)
    expect(computeRemainingSeconds(state, T0)).toBe(90)
    expect(computeRemainingSeconds(state, T0 + 30_000)).toBe(60)
    expect(computeRemainingSeconds(state, T0 + 90_000)).toBe(0)
    expect(computeRemainingSeconds(state, T0 + 120_000)).toBe(0)
  })

  it('pause freezes the remaining time and clears endsAt', () => {
    const running = startRestTimer('we-1', 90, T0)
    const paused = pauseRestTimer(running, T0 + 30_000)
    expect(paused.running).toBe(false)
    expect(paused.endsAt).toBeNull()
    expect(paused.remainingSeconds).toBe(60)
    // remaining stays 60 no matter how much real time passes while paused
    expect(computeRemainingSeconds(paused, T0 + 999_000)).toBe(60)
  })

  it('resume recomputes a fresh endsAt from the paused remaining time', () => {
    const running = startRestTimer('we-1', 90, T0)
    const paused = pauseRestTimer(running, T0 + 30_000)
    const resumed = resumeRestTimer(paused, T0 + 500_000)
    expect(resumed.running).toBe(true)
    expect(resumed.endsAt).toBe(T0 + 500_000 + 60_000)
    expect(computeRemainingSeconds(resumed, T0 + 500_000)).toBe(60)
  })

  it('resume is a no-op when already running or when nothing remains', () => {
    const running = startRestTimer('we-1', 90, T0)
    expect(resumeRestTimer(running, T0 + 10_000)).toEqual(running)

    const depleted = { ...running, running: false, endsAt: null, remainingSeconds: 0 }
    expect(resumeRestTimer(depleted, T0 + 10_000)).toEqual(depleted)
  })

  it('adjusts remaining time up while running', () => {
    const running = startRestTimer('we-1', 60, T0)
    const adjusted = adjustRestTimer(running, 15, T0 + 10_000)
    expect(computeRemainingSeconds(adjusted, T0 + 10_000)).toBe(65)
  })

  it('adjusts remaining time down while running without crossing zero', () => {
    const running = startRestTimer('we-1', 60, T0)
    // 55s remain at T0+5000; subtracting 15 should floor at 40, not go negative
    const adjusted = adjustRestTimer(running, -15, T0 + 5_000)
    expect(computeRemainingSeconds(adjusted, T0 + 5_000)).toBe(40)

    // Subtracting far more than remains clamps to exactly zero.
    const clamped = adjustRestTimer(running, -1000, T0 + 5_000)
    expect(computeRemainingSeconds(clamped, T0 + 5_000)).toBe(0)
  })

  it('adjusts remaining time while paused too', () => {
    const running = startRestTimer('we-1', 60, T0)
    const paused = pauseRestTimer(running, T0 + 10_000)
    expect(paused.remainingSeconds).toBe(50)
    const adjusted = adjustRestTimer(paused, -100, T0 + 10_000)
    expect(adjusted.remainingSeconds).toBe(0)
    expect(adjusted.running).toBe(false)
  })

  it('serializes and parses round-trip cleanly, and tolerates missing/invalid input', () => {
    const state = startRestTimer('we-1', 60, T0)
    const raw = serializeRestTimerState(state)
    expect(parseRestTimerState(raw)).toEqual(state)
    expect(parseRestTimerState(undefined)).toBeUndefined()
    expect(parseRestTimerState('not json')).toBeUndefined()
    expect(parseRestTimerState('{"running":true}')).toBeUndefined()
  })
})
