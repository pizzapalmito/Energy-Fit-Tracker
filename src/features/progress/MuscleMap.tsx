import { readinessStatus, type MuscleMapRecovery } from './readinessPresentation'
import styles from './MuscleMap.module.css'

type AnatomicalSide = 'left' | 'right' | 'center'

interface BodyRegion {
  muscleId: string
  view: 'front' | 'back'
  side: AnatomicalSide
  path: string
}

const bodyRegions: BodyRegion[] = [
  { muscleId: 'neck', view: 'front', side: 'center', path: 'M74 51 L86 51 L88 62 Q80 66 72 62Z' },
  { muscleId: 'shoulders', view: 'front', side: 'left', path: 'M54 61 Q45 64 42 75 L54 82 62 65Z' },
  { muscleId: 'shoulders', view: 'front', side: 'right', path: 'M106 61 Q115 64 118 75 L106 82 98 65Z' },
  { muscleId: 'chest', view: 'front', side: 'left', path: 'M61 66 Q69 62 79 66 L78 89 Q68 90 60 83Z' },
  { muscleId: 'chest', view: 'front', side: 'right', path: 'M99 66 Q91 62 81 66 L82 89 Q92 90 100 83Z' },
  { muscleId: 'biceps', view: 'front', side: 'left', path: 'M43 82 Q49 79 55 84 L52 112 Q47 117 42 111Z' },
  { muscleId: 'biceps', view: 'front', side: 'right', path: 'M117 82 Q111 79 105 84 L108 112 Q113 117 118 111Z' },
  { muscleId: 'forearms', view: 'front', side: 'left', path: 'M41 114 Q47 111 52 115 L48 139 Q43 144 39 137Z' },
  { muscleId: 'forearms', view: 'front', side: 'right', path: 'M119 114 Q113 111 108 115 L112 139 Q117 144 121 137Z' },
  { muscleId: 'abdominals', view: 'front', side: 'left', path: 'M65 93 L78 94 78 142 65 139Z' },
  { muscleId: 'abdominals', view: 'front', side: 'right', path: 'M95 93 L82 94 82 142 95 139Z' },
  { muscleId: 'abductors', view: 'front', side: 'left', path: 'M60 143 L75 147 71 166 57 158Z' },
  { muscleId: 'abductors', view: 'front', side: 'right', path: 'M100 143 L85 147 89 166 103 158Z' },
  { muscleId: 'adductors', view: 'front', side: 'left', path: 'M75 148 L79 151 78 184 69 166Z' },
  { muscleId: 'adductors', view: 'front', side: 'right', path: 'M85 148 L81 151 82 184 91 166Z' },
  { muscleId: 'quadriceps', view: 'front', side: 'left', path: 'M57 163 Q67 159 76 169 L74 222 Q65 228 57 219Z' },
  { muscleId: 'quadriceps', view: 'front', side: 'right', path: 'M103 163 Q93 159 84 169 L86 222 Q95 228 103 219Z' },
  { muscleId: 'calves', view: 'front', side: 'left', path: 'M58 229 Q67 225 73 234 L71 279 Q64 285 58 278Z' },
  { muscleId: 'calves', view: 'front', side: 'right', path: 'M102 229 Q93 225 87 234 L89 279 Q96 285 102 278Z' },
  { muscleId: 'shoulders', view: 'back', side: 'left', path: 'M214 61 Q205 64 202 75 L214 82 222 65Z' },
  { muscleId: 'shoulders', view: 'back', side: 'right', path: 'M266 61 Q275 64 278 75 L266 82 258 65Z' },
  { muscleId: 'traps', view: 'back', side: 'left', path: 'M223 59 L239 66 239 88 218 76Z' },
  { muscleId: 'traps', view: 'back', side: 'right', path: 'M257 59 L241 66 241 88 262 76Z' },
  { muscleId: 'triceps', view: 'back', side: 'left', path: 'M203 82 Q209 79 215 84 L212 113 Q207 117 202 111Z' },
  { muscleId: 'triceps', view: 'back', side: 'right', path: 'M277 82 Q271 79 265 84 L268 113 Q273 117 278 111Z' },
  { muscleId: 'lats', view: 'back', side: 'left', path: 'M219 78 L238 89 237 127 220 116Z' },
  { muscleId: 'lats', view: 'back', side: 'right', path: 'M261 78 L242 89 243 127 260 116Z' },
  { muscleId: 'middle-back', view: 'back', side: 'left', path: 'M224 82 L238 90 238 114 225 109Z' },
  { muscleId: 'middle-back', view: 'back', side: 'right', path: 'M256 82 L242 90 242 114 255 109Z' },
  { muscleId: 'lower-back', view: 'back', side: 'left', path: 'M224 116 L238 117 238 142 222 137Z' },
  { muscleId: 'lower-back', view: 'back', side: 'right', path: 'M256 116 L242 117 242 142 258 137Z' },
  { muscleId: 'glutes', view: 'back', side: 'left', path: 'M218 145 Q229 140 238 147 L238 168 Q226 174 217 164Z' },
  { muscleId: 'glutes', view: 'back', side: 'right', path: 'M262 145 Q251 140 242 147 L242 168 Q254 174 263 164Z' },
  { muscleId: 'hamstrings', view: 'back', side: 'left', path: 'M217 171 Q228 166 237 174 L234 225 Q225 231 217 221Z' },
  { muscleId: 'hamstrings', view: 'back', side: 'right', path: 'M263 171 Q252 166 243 174 L246 225 Q255 231 263 221Z' },
  { muscleId: 'calves', view: 'back', side: 'left', path: 'M218 231 Q227 226 233 235 L231 279 Q224 285 218 278Z' },
  { muscleId: 'calves', view: 'back', side: 'right', path: 'M262 231 Q253 226 247 235 L249 279 Q256 285 262 278Z' },
]

const legend = [
  { status: 'fatigued', label: 'Fatigued', range: '0–25%' },
  { status: 'recovering', label: 'Recovering', range: '26–75%' },
  { status: 'ready', label: 'Ready', range: '76–100%' },
] as const

function displayName(muscleId: string): string {
  return muscleId.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function readinessForRegion(entries: MuscleMapRecovery[], side: AnatomicalSide): number {
  const bilateral = entries.find((entry) => !entry.side || entry.side === 'bilateral')
  if (side === 'center') return bilateral?.recommendationReadiness ?? 100
  const sided = entries.find((entry) => entry.side === side)
  return sided?.recommendationReadiness ?? bilateral?.recommendationReadiness ?? 100
}

export function MuscleMap({ recovery, selected, onSelect }: { recovery: MuscleMapRecovery[]; selected?: string; onSelect: (muscleId: string) => void }) {
  const byMuscle = new Map<string, MuscleMapRecovery[]>()
  for (const entry of recovery) byMuscle.set(entry.muscleId, [...(byMuscle.get(entry.muscleId) ?? []), entry])

  const region = (entry: BodyRegion) => {
    const value = Math.max(0, Math.min(100, readinessForRegion(byMuscle.get(entry.muscleId) ?? [], entry.side)))
    const status = readinessStatus(value)
    const sideLabel = entry.side === 'center' ? 'center' : `${entry.side} side`
    return <path
      key={`${entry.view}-${entry.muscleId}-${entry.side}`}
      d={entry.path}
      className={styles.region}
      data-body-side={entry.side}
      data-muscle-id={entry.muscleId}
      data-readiness={Math.round(value)}
      data-selected={selected === entry.muscleId || undefined}
      data-status={status}
      fill={`url(#readiness-${status})`}
      opacity={selected && selected !== entry.muscleId ? .32 : 1}
      role="button"
      tabIndex={0}
      aria-label={`${displayName(entry.muscleId)}, ${sideLabel}, ${Math.round(value)} percent ready, ${status}`}
      onClick={() => onSelect(entry.muscleId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(entry.muscleId)
        }
      }}
    />
  }

  return <div className={styles.wrap}>
    <svg viewBox="0 0 320 310" role="img" aria-label="Front and back muscle readiness map">
      <defs>
        <pattern id="readiness-fatigued" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="#e86670" /><path d="M0 0V7" stroke="#8f303a" strokeWidth="2.4" />
        </pattern>
        <pattern id="readiness-recovering" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#e9b85f" /><circle cx="4.5" cy="4.5" r="1.6" fill="#855f27" />
        </pattern>
        <pattern id="readiness-ready" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#63d49a" />
        </pattern>
      </defs>
      <text x="80" y="14" textAnchor="middle">Front</text><text x="240" y="14" textAnchor="middle">Back</text>
      <g aria-label="Front body">
        <circle cx="80" cy="35" r="16" className={styles.outline} />
        <path d="M67 55 Q80 48 93 55 L108 63 121 128 Q123 136 116 140 109 143 106 134 L98 94 101 145 94 176 96 291 82 291 80 185 78 291 64 291 66 176 59 145 62 94 54 134 Q51 143 44 140 37 136 39 128 L52 63Z" className={styles.body} />
      </g>
      <g aria-label="Back body">
        <circle cx="240" cy="35" r="16" className={styles.outline} />
        <path d="M227 55 Q240 48 253 55 L268 63 281 128 Q283 136 276 140 269 143 266 134 L258 94 261 145 254 176 256 291 242 291 240 185 238 291 224 291 226 176 219 145 222 94 214 134 Q211 143 204 140 197 136 199 128 L212 63Z" className={styles.body} />
      </g>
      {bodyRegions.map(region)}
    </svg>
    <div className={styles.legend} aria-label="Readiness legend">
      {legend.map((entry) => <div key={entry.status} className={styles.legendItem}>
        <span className={styles.swatch} data-status={entry.status} aria-hidden="true" />
        <span><strong>{entry.label}</strong><small>{entry.range}</small></span>
      </div>)}
    </div>
    <p className={styles.hint}>Left and right share one muscle-group value unless side-specific data is recorded. Tap a region for details.</p>
  </div>
}
