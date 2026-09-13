import type { RecoveryResult } from '../../domain/contracts'

export type ReadinessSide = 'left' | 'right' | 'bilateral'
export type MuscleMapRecovery = RecoveryResult & { side?: ReadinessSide }
export type ReadinessStatus = 'fatigued' | 'recovering' | 'ready'

export function readinessStatus(value: number): ReadinessStatus {
  if (value <= 25) return 'fatigued'
  if (value <= 75) return 'recovering'
  return 'ready'
}
