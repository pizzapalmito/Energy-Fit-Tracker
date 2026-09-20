import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const catalogPath = resolve(root, 'public/catalog/catalog.json')
const outputPath = resolve(root, 'public/catalog/greek-ink-sheets-v1/plan.json')

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const priorityIds = [
  'bodyweight-squat',
  'incline-push-up',
  'bodyweight-walking-lunge',
  'plank',
  'rocking-standing-calf-raise',
  'single-leg-glute-bridge',
  'sit-up',
  'freehand-jump-squat',
  'rope-jumping',
  'ankle-circles',
  'ankle-on-the-knee',
  'arm-circles',
  'calf-stretch-elbows-against-wall',
  'calf-stretch-hands-against-wall',
  'cat-stretch',
  'childs-pose',
  'chin-to-chest-stretch',
  'dancers-stretch',
  '3-4-sit-up',
  'alternate-heel-touchers',
  'bent-knee-hip-raise',
  'butt-lift-bridge',
  'crunch-hands-overhead',
  'crunches',
  'dead-bug',
  'decline-crunch',
  'flutter-kicks',
  'bench-jump',
  'frog-hops',
  'knee-tuck-jump',
  'rocket-jump',
  'scissors-jump',
  'side-standing-long-jump',
  'split-jump',
  'star-jump',
  'standing-long-jump',
  'chair-lower-back-stretch',
  'dynamic-back-stretch',
  'dynamic-chest-stretch',
  'elbow-circles',
  'elbows-back',
  'front-leg-raises',
  'hamstring-stretch',
  'hip-circles-prone',
  'hug-knees-to-chest',
  'jackknife-sit-up',
  'mountain-climbers',
  'reverse-crunch',
  'side-jackknife',
  'side-leg-raises',
  'superman',
  'hanging-leg-raise',
  'decline-reverse-crunch',
  'flat-bench-lying-leg-raise',
  'barbell-bench-press-medium-grip',
  'barbell-curl',
  'barbell-deadlift',
  'barbell-full-squat',
  'barbell-glute-bridge',
  'barbell-shoulder-press',
  'barbell-shrug',
  'barbell-side-bend',
  'barbell-rear-delt-row',
  'dumbbell-bench-press',
  'dumbbell-bicep-curl',
  'dumbbell-clean',
  'dumbbell-floor-press',
  'dumbbell-flyes',
  'dumbbell-lunges',
  'dumbbell-shoulder-press',
  'dumbbell-shrug',
  'dumbbell-side-bend',
  'kettlebell-dead-clean',
  'kettlebell-halo',
  'kettlebell-hang-clean',
  'kettlebell-one-legged-deadlift',
  'kettlebell-overhead-triceps-extension',
  'kettlebell-seated-press',
  'kettlebell-sumo-high-pull',
  'kettlebell-thruster',
  'kettlebell-windmill',
]
const priorityRank = new Map(priorityIds.map((id, index) => [id, index]))
const exercises = [...catalog.exercises]
  .sort((left, right) => {
    const leftRank = priorityRank.get(left.id)
    const rightRank = priorityRank.get(right.id)
    if (leftRank !== undefined || rightRank !== undefined) {
      return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER)
    }
    const leftKey = `${left.equipment.join('|')}|${left.category}|${left.name}`
    const rightKey = `${right.equipment.join('|')}|${right.category}|${right.name}`
    return leftKey.localeCompare(rightKey)
  })

const sheets = Array.from({ length: Math.ceil(exercises.length / 9) }, (_, index) => ({
  id: `sheet-${String(index + 1).padStart(3, '0')}`,
  status: 'planned',
  exerciseIds: exercises.slice(index * 9, index * 9 + 9).map((exercise) => exercise.id),
}))

const plan = {
  version: 1,
  palette: { paper: '#ece7db', ink: '#1c1b18' },
  layout: { columns: 3, rows: 3, tileCount: 9 },
  source: 'public/catalog/catalog.json',
  exerciseCount: exercises.length,
  sheets,
}

await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`)
console.log(`Wrote ${sheets.length} sheets for ${exercises.length} exercises to ${outputPath}`)
