import { describe, expect, it } from 'vitest'
import { currentWeekRange, isWithinWeek } from './weekSummary'

describe('currentWeekRange', () => {
  it('returns the Monday-start week containing a mid-week date', () => {
    // 2026-09-16 is a Wednesday (UTC)
    const range = currentWeekRange(new Date('2026-09-16T12:00:00.000Z'))
    expect(range).toEqual({ start: '2026-09-14', end: '2026-09-20' })
  })

  it('treats Sunday as the last day of its week, not the first', () => {
    // 2026-09-20 is a Sunday
    const range = currentWeekRange(new Date('2026-09-20T23:00:00.000Z'))
    expect(range).toEqual({ start: '2026-09-14', end: '2026-09-20' })
  })

  it('treats Monday as the first day of its week', () => {
    const range = currentWeekRange(new Date('2026-09-14T00:00:00.000Z'))
    expect(range).toEqual({ start: '2026-09-14', end: '2026-09-20' })
  })
})

describe('isWithinWeek', () => {
  const range = { start: '2026-09-14', end: '2026-09-20' }
  it('includes both boundary dates', () => {
    expect(isWithinWeek('2026-09-14', range)).toBe(true)
    expect(isWithinWeek('2026-09-20', range)).toBe(true)
  })
  it('excludes dates outside the range', () => {
    expect(isWithinWeek('2026-09-13', range)).toBe(false)
    expect(isWithinWeek('2026-09-21', range)).toBe(false)
  })
})
