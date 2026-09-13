import { describe, expect, it } from 'vitest'
import { hasSetFieldErrors, validateSetFields } from './validation'

describe('validateSetFields', () => {
  it('allows undefined fields (partial edits) without error', () => {
    expect(validateSetFields({})).toEqual({})
  })

  it('rejects negative values for load/reps/duration/distance', () => {
    expect(validateSetFields({ loadKg: -1 }).loadKg).toBeTruthy()
    expect(validateSetFields({ reps: -1 }).reps).toBeTruthy()
    expect(validateSetFields({ durationSeconds: -1 }).durationSeconds).toBeTruthy()
    expect(validateSetFields({ distanceMeters: -1 }).distanceMeters).toBeTruthy()
  })

  it('rejects non-finite values', () => {
    expect(validateSetFields({ loadKg: NaN }).loadKg).toBeTruthy()
    expect(validateSetFields({ reps: Infinity }).reps).toBeTruthy()
  })

  it('accepts zero and positive finite values', () => {
    expect(hasSetFieldErrors(validateSetFields({ loadKg: 0, reps: 0, durationSeconds: 0, distanceMeters: 0 }))).toBe(false)
    expect(hasSetFieldErrors(validateSetFields({ loadKg: 60, reps: 8 }))).toBe(false)
  })

  it('enforces RIR between 0 and 10 inclusive', () => {
    expect(validateSetFields({ rir: -1 }).rir).toBeTruthy()
    expect(validateSetFields({ rir: 11 }).rir).toBeTruthy()
    expect(hasSetFieldErrors(validateSetFields({ rir: 0 }))).toBe(false)
    expect(hasSetFieldErrors(validateSetFields({ rir: 10 }))).toBe(false)
  })

  it('enforces RPE between 1 and 10 inclusive', () => {
    expect(validateSetFields({ rpe: 0 }).rpe).toBeTruthy()
    expect(validateSetFields({ rpe: 11 }).rpe).toBeTruthy()
    expect(hasSetFieldErrors(validateSetFields({ rpe: 1 }))).toBe(false)
    expect(hasSetFieldErrors(validateSetFields({ rpe: 10 }))).toBe(false)
  })
})
