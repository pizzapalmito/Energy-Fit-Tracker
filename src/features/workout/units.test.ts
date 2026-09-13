import { describe, expect, it } from 'vitest'
import { displayWeightToKg, formatWeight, kgToDisplayWeight } from './units'

describe('units', () => {
  it('defaults to displaying kg unchanged (rounded)', () => {
    expect(kgToDisplayWeight(60, 'kg')).toBe(60)
    expect(displayWeightToKg(60, 'kg')).toBe(60)
  })

  it('converts kg to lb and back within normal gym increments (round-trip safe)', () => {
    const increments = [2.5, 5, 10, 20, 40, 60, 100, 102.5, 140]
    for (const kg of increments) {
      const lb = kgToDisplayWeight(kg, 'lb')
      const roundTripped = displayWeightToKg(lb, 'lb')
      expect(roundTripped).toBeCloseTo(kg, 1)
    }
  })

  it('converts a known plate weight correctly', () => {
    expect(kgToDisplayWeight(100, 'lb')).toBeCloseTo(220.46, 1)
    expect(displayWeightToKg(225, 'lb')).toBeCloseTo(102.06, 1)
  })

  it('is round-trip safe starting from a lb entry too', () => {
    const lbEntries = [45, 95, 135, 185, 225, 315]
    for (const lb of lbEntries) {
      const kg = displayWeightToKg(lb, 'lb')
      const roundTripped = kgToDisplayWeight(kg, 'lb')
      expect(roundTripped).toBeCloseTo(lb, 1)
    }
  })

  it('formats weight with the unit suffix, and a placeholder when undefined', () => {
    expect(formatWeight(60, 'kg')).toBe('60kg')
    expect(formatWeight(undefined, 'kg')).toBe('—')
  })
})
