export interface WeekRange {
  start: string
  end: string
}

/** Monday-start ISO calendar week (UTC) containing `now`. */
export function currentWeekRange(now: Date): WeekRange {
  const day = now.getUTCDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday))
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) }
}

export function isWithinWeek(date: string, range: WeekRange): boolean {
  return date >= range.start && date <= range.end
}
