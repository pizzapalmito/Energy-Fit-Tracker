import type { RecoveryResult } from '../../domain/contracts'
import styles from './MuscleMap.module.css'

const frontRegions = [
  ['chest', 54, 61, 52, 26], ['shoulders', 37, 57, 18, 25], ['biceps', 31, 89, 15, 37],
  ['abdominals', 66, 93, 28, 54], ['quadriceps', 48, 160, 25, 67], ['adductors', 74, 160, 16, 55], ['calves', 50, 232, 21, 54],
] as const
const backRegions = [
  ['traps', 222, 51, 36, 29], ['lats', 211, 76, 58, 58], ['middle-back', 228, 79, 24, 33],
  ['lower-back', 224, 117, 32, 28], ['triceps', 195, 88, 15, 39], ['glutes', 214, 146, 52, 32],
  ['hamstrings', 217, 180, 21, 55], ['calves', 218, 239, 20, 48],
] as const

function color(value: number) {
  if (value >= 76) return '#64d89b'
  if (value >= 51) return '#d8c45f'
  if (value >= 26) return '#e9954f'
  return '#ff6b72'
}

export function MuscleMap({ recovery, selected, onSelect }: { recovery: RecoveryResult[]; selected?: string; onSelect: (muscleId: string) => void }) {
  const byMuscle = new Map(recovery.map((entry) => [entry.muscleId, entry]))
  const region = (side: string, [id, x, y, width, height]: (typeof frontRegions)[number] | (typeof backRegions)[number]) => {
    const value = byMuscle.get(id)?.recommendationReadiness ?? 100
    return <rect key={`${side}-${id}`} x={x} y={y} width={width} height={height} rx="7" fill={color(value)} opacity={selected && selected !== id ? .35 : .9} role="button" tabIndex={0} aria-label={`${id.replaceAll('-', ' ')}, ${Math.round(value)} percent ready`} onClick={() => onSelect(id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(id) }} />
  }
  return <div className={styles.wrap}>
    <svg viewBox="0 0 320 320" role="img" aria-label="Front and back training readiness map">
      <text x="80" y="13" textAnchor="middle">Front</text><text x="240" y="13" textAnchor="middle">Back</text>
      <g><circle cx="80" cy="35" r="17" className={styles.outline} /><path d="M53 55 Q80 43 107 55 L123 137 Q107 154 106 294 L84 294 80 174 76 294 54 294 Q53 154 37 137Z" className={styles.body} />{frontRegions.map((entry) => region('front', entry))}</g>
      <g><circle cx="240" cy="35" r="17" className={styles.outline} /><path d="M213 55 Q240 43 267 55 L283 137 Q267 154 266 294 L244 294 240 174 236 294 214 294 Q213 154 197 137Z" className={styles.body} />{backRegions.map((entry) => region('back', entry))}</g>
    </svg>
    <div className={styles.legend}><span>Fatigued</span><span>Recovering</span><span>Ready</span></div>
  </div>
}
