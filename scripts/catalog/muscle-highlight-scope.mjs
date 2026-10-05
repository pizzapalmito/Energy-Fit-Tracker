// Apparatus labels alone miss movements whose resistance is the athlete's body.
// These IDs were checked against the current catalog instructions; weighted
// plate, sled, barbell and seated resistance-machine movements remain eligible.
export const APPARATUS_CALISTHENICS = new Set([
  'ab-roller', 'band-assisted-pull-up', 'bodyweight-mid-row', 'dips-chest-version',
  'gironda-sternum-chins', 'inverted-row-with-straps', 'kipping-muscle-up',
  'london-bridges', 'muscle-up', 'parallel-bar-dip', 'ring-dips',
  'rocky-pull-ups-pulldowns', 'rope-climb', 'side-to-side-chins',
  'single-leg-high-box-squat', 'suspended-push-up', 'suspended-row', 'bodyweight-flyes',
])

export function calisthenicsReason(exercise) {
  if (exercise.equipment?.includes('bodyweight')) return 'Bodyweight is the recorded resistance.'
  if (APPARATUS_CALISTHENICS.has(exercise.id)) return 'Instructions use apparatus to support or assist bodyweight resistance.'
  return null
}

export const MUSCLE_HIGHLIGHT_STYLE = 'matte-3d-muscle-cutaway-v1'
