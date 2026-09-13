import { useEffect, useState } from 'react'

/** Seconds elapsed since `startTimeIso`, ticking once per second. Recomputes from Date.now() on every tick/remount rather than counting up in place. */
export function useElapsedSeconds(startTimeIso: string | undefined): number {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!startTimeIso) return
    const interval = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [startTimeIso])

  if (!startTimeIso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(startTimeIso).getTime()) / 1000))
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
