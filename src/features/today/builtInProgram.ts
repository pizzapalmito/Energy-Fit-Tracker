import type { Exercise } from '../../domain/models'
import type { WorkoutTemplate, WorkoutTemplateExercise } from '../../data/types'

const PROGRAM_TIMESTAMP = '2026-09-12T00:00:00.000Z'
const DEFAULT_REST_SECONDS = 90

/**
 * Bundled custom exercise definitions for plan movements with no equivalent catalog entry.
 * Deliberately have no media so the "no demonstration available" fallback is shown, rather than
 * silently borrowing a materially different catalog movement's photos.
 */
export const CUSTOM_TIBIALIS_RAISE: Exercise = {
  id: 'repwise-tibialis-raise',
  name: 'Tibialis Raise',
  aliases: [],
  category: 'strength',
  movementPattern: 'pull',
  difficulty: 'beginner',
  mechanic: 'isolation',
  equipment: ['bodyweight'],
  instructions: [
    'Stand tall with heels on the floor and toes resting on a raised edge, or lean back against a wall.',
    'Keeping your legs straight, lift your toes and the front of your foot upward by contracting your shins.',
    'Pause briefly at the top, then lower under control and repeat.',
  ],
  muscles: [{ muscleId: 'calves', weight: 1 }],
  defaultRestSeconds: 90,
  media: [],
  source: 'custom',
  excluded: false,
}

export const CUSTOM_PUSH_UP_PLUS: Exercise = {
  id: 'repwise-push-up-plus',
  name: 'Push-Up Plus',
  aliases: [],
  category: 'strength',
  movementPattern: 'push',
  difficulty: 'beginner',
  mechanic: 'compound',
  equipment: ['bodyweight'],
  instructions: [
    'Start in a push-up position and perform a standard push-up.',
    'At the top, keep your arms straight and push the floor away, protracting your shoulder blades to round your upper back.',
    'Hold briefly, then relax the shoulder blades and repeat.',
  ],
  muscles: [
    { muscleId: 'chest', weight: 1 },
    { muscleId: 'shoulders', weight: 0.5 },
    { muscleId: 'triceps', weight: 0.5 },
  ],
  defaultRestSeconds: 90,
  media: [],
  source: 'custom',
  excluded: false,
}

/** Rep-based planned exercise; the set is initialized to the lower rep bound while retaining the full repRange. */
function reps(exerciseId: string, displayName: string, sets: number, repRange: [number, number]): WorkoutTemplateExercise {
  return { exerciseId, displayName, sets, repRange, restSeconds: DEFAULT_REST_SECONDS }
}

/** Duration-based planned exercise (e.g. carries); the set is initialized to the lower duration bound while retaining the full range. */
function duration(exerciseId: string, displayName: string, sets: number, durationRangeSeconds: [number, number]): WorkoutTemplateExercise {
  return { exerciseId, displayName, sets, durationRangeSeconds, restSeconds: DEFAULT_REST_SECONDS }
}

function template(id: string, name: string, exercises: WorkoutTemplateExercise[], customExercises?: Exercise[]): WorkoutTemplate {
  return { id, name, createdAt: PROGRAM_TIMESTAMP, updatedAt: PROGRAM_TIMESTAMP, exercises, ...(customExercises ? { customExercises } : {}) }
}

export const BUILT_IN_PROGRAM: readonly WorkoutTemplate[] = [
  template('w1-day-a', 'Week 1 Day A — Chest + Biceps Emphasis', [
    reps('leverage-incline-chest-press', 'Incline Chest Press Machine', 3, [8, 12]),
    reps('butterfly', 'Pec Deck', 2, [10, 15]),
    reps('seated-cable-rows', 'Seated Row', 2, [8, 12]),
    reps('leg-press', 'Leg Press', 2, [8, 12]),
    reps('preacher-curl', 'Preacher Curl', 3, [8, 12]),
    reps('hammer-curls', 'Hammer Curl', 2, [10, 15]),
    reps('standing-calf-raises', 'Standing Calf Raise', 2, [12, 15]),
    reps('seated-dumbbell-palms-down-wrist-curl', 'Reverse Wrist Curl', 2, [15, 20]),
    reps('dead-bug', 'Dead Bug (/side)', 2, [8, 12]),
  ]),
  template('w1-day-b', 'Week 1 Day B — Back + Glutes Emphasis', [
    reps('v-bar-pulldown', 'Neutral-Grip Lat Pulldown', 3, [8, 12]),
    reps('leverage-iso-row', 'Chest-Supported Row Machine', 3, [8, 12]),
    reps('barbell-hip-thrust', 'Hip Thrust Machine', 3, [8, 12]),
    reps('seated-leg-curl', 'Seated Leg Curl', 2, [10, 15]),
    reps('leverage-shoulder-press', 'Shoulder Press Machine', 2, [8, 12]),
    reps('leverage-chest-press', 'Chest Press Machine', 2, [10, 15]),
    reps('dumbbell-shrug', 'Dumbbell Shrug', 2, [10, 15]),
    reps('repwise-tibialis-raise', 'Tibialis Raise', 2, [15, 25]),
    reps('external-rotation', 'External Shoulder Rotation (/side)', 2, [12, 20]),
  ], [CUSTOM_TIBIALIS_RAISE]),
  template('w1-day-c', 'Week 1 Day C — Chest + Triceps Emphasis', [
    reps('leverage-chest-press', 'Flat Chest Press Machine', 3, [8, 12]),
    reps('cable-crossover', 'High-to-Low Cable Fly', 2, [10, 15]),
    reps('seated-cable-rows', 'Cable Row', 2, [8, 12]),
    reps('split-squat-with-dumbbells', 'Bulgarian Split Squat (/leg)', 2, [8, 12]),
    reps('triceps-pushdown-rope-attachment', 'Rope Triceps Pushdown', 3, [8, 12]),
    reps('cable-rope-overhead-triceps-extension', 'Overhead Cable Triceps Extension', 2, [10, 15]),
    reps('seated-calf-raise', 'Seated Calf Raise', 2, [12, 20]),
    reps('thigh-adductor', 'Hip Adductor Machine', 2, [12, 20]),
    reps('repwise-push-up-plus', 'Push-Up Plus / Serratus Cable Punch', 2, [12, 15]),
  ], [CUSTOM_PUSH_UP_PLUS]),
  template('w1-day-d', 'Week 1 Day D — Shoulders + Glutes Emphasis', [
    reps('cable-internal-rotation', 'Internal Rotation Machine (/side)', 2, [12, 15]),
    reps('standing-dumbbell-straight-arm-front-delt-raise-above-head', 'Straight-Arm Shoulder Flexion Machine', 2, [12, 15]),
    reps('leverage-shoulder-press', 'Shoulder Press Machine', 3, [8, 12]),
    reps('cable-seated-lateral-raise', 'Machine Lateral Raise', 3, [10, 15]),
    reps('reverse-machine-flyes', 'Reverse Pec Deck', 2, [12, 15]),
    reps('barbell-hip-thrust', 'Hip Thrust Machine', 3, [8, 12]),
    reps('romanian-deadlift', 'Romanian Deadlift', 2, [8, 12]),
    reps('leverage-chest-press', 'Chest Press Machine', 2, [10, 15]),
    duration('farmers-walk', 'Farmer Carry', 2, [30, 45]),
    reps('face-pull', 'Face Pull', 2, [12, 20]),
    reps('pallof-press', 'Pallof Press (/side)', 2, [10, 15]),
  ]),
  template('w2-day-a', 'Week 2 Day A — Chest + Biceps Emphasis', [
    reps('incline-dumbbell-press', 'Incline Dumbbell Press', 3, [8, 12]),
    reps('cable-crossover', 'Cable Fly', 2, [10, 15]),
    reps('dumbbell-incline-row', 'Chest-Supported Dumbbell Row', 2, [8, 12]),
    reps('goblet-squat', 'Goblet Squat', 2, [8, 12]),
    reps('ez-bar-curl', 'EZ-Bar Curl', 3, [8, 12]),
    reps('incline-dumbbell-curl', 'Incline Dumbbell Curl', 2, [10, 15]),
    reps('standing-calf-raises', 'Standing Calf Raise', 2, [12, 15]),
    reps('seated-dumbbell-palms-down-wrist-curl', 'Reverse Wrist Curl', 2, [15, 20]),
    reps('dead-bug', 'Dead Bug (/side)', 2, [8, 12]),
  ]),
  template('w2-day-b', 'Week 2 Day B — Back + Glutes Emphasis', [
    reps('band-assisted-pull-up', 'Assisted Pull-Up', 3, [8, 12]),
    reps('t-bar-row-with-handle', 'T-Bar / Chest-Supported Row', 3, [8, 12]),
    reps('barbell-hip-thrust', 'Barbell Hip Thrust', 3, [8, 12]),
    reps('lying-leg-curls', 'Lying Leg Curl', 2, [10, 15]),
    reps('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 2, [8, 12]),
    reps('dumbbell-bench-press', 'Push-Up or Dumbbell Bench Press', 2, [10, 15]),
    reps('dumbbell-shrug', 'Dumbbell Shrug', 2, [10, 15]),
    reps('repwise-tibialis-raise', 'Tibialis Raise', 2, [15, 25]),
    reps('external-rotation', 'External Shoulder Rotation (/side)', 2, [12, 20]),
  ], [CUSTOM_TIBIALIS_RAISE]),
  template('w2-day-c', 'Week 2 Day C — Chest + Triceps Emphasis', [
    reps('dumbbell-bench-press', 'Flat Dumbbell Press', 3, [8, 12]),
    reps('dips-chest-version', 'Assisted Chest Dip', 2, [8, 15]),
    reps('v-bar-pulldown', 'Neutral-Grip Lat Pulldown', 2, [8, 12]),
    reps('dumbbell-step-ups', 'Step-Up (/leg)', 2, [8, 12]),
    reps('close-grip-barbell-bench-press', 'Close-Grip Press', 3, [8, 12]),
    reps('standing-dumbbell-triceps-extension', 'Dumbbell Overhead Triceps Extension', 2, [10, 15]),
    reps('seated-calf-raise', 'Seated Calf Raise', 2, [12, 20]),
    reps('thigh-adductor', 'Hip Adductor Machine', 2, [12, 20]),
    reps('repwise-push-up-plus', 'Push-Up Plus / Serratus Cable Punch', 2, [12, 15]),
  ], [CUSTOM_PUSH_UP_PLUS]),
  template('w2-day-d', 'Week 2 Day D — Shoulders + Glutes Emphasis', [
    reps('cable-internal-rotation', 'Internal Rotation Machine (/side)', 2, [12, 15]),
    reps('standing-dumbbell-straight-arm-front-delt-raise-above-head', 'Straight-Arm Shoulder Flexion Machine', 2, [12, 15]),
    reps('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 3, [8, 12]),
    reps('cable-seated-lateral-raise', 'Cable Lateral Raise', 3, [10, 15]),
    reps('cable-rear-delt-fly', 'Cable Rear-Delt Fly', 2, [12, 15]),
    reps('split-squat-with-dumbbells', 'Bulgarian Split Squat, Long Stride (/leg)', 3, [8, 12]),
    reps('stiff-legged-dumbbell-deadlift', 'Dumbbell Romanian Deadlift', 2, [8, 12]),
    reps('straight-arm-pulldown', 'Straight-Arm Pulldown', 2, [10, 15]),
    duration('farmers-walk', 'Farmer Carry', 2, [30, 45]),
    reps('face-pull', 'Face Pull', 2, [12, 20]),
    reps('pallof-press', 'Pallof Press (/side)', 2, [10, 15]),
  ]),
  template('w3-day-a', 'Week 3 Day A — Chest + Biceps Emphasis', [
    reps('smith-machine-incline-bench-press', 'Smith Incline Press', 3, [8, 12]),
    reps('dumbbell-flyes', 'Flat Dumbbell Fly', 2, [10, 15]),
    reps('seated-one-arm-cable-pulley-rows', 'One-Arm Cable Row', 2, [8, 12]),
    reps('split-squat-with-dumbbells', 'Bulgarian Split Squat (/leg)', 2, [8, 12]),
    reps('dumbbell-alternate-bicep-curl', 'Alternating Dumbbell Curl', 3, [8, 12]),
    reps('cross-body-hammer-curl', 'Cross-Body Hammer Curl', 2, [10, 15]),
    reps('standing-calf-raises', 'Standing Calf Raise', 2, [12, 15]),
    reps('seated-dumbbell-palms-down-wrist-curl', 'Reverse Wrist Curl', 2, [15, 20]),
    reps('dead-bug', 'Dead Bug (/side)', 2, [8, 12]),
  ]),
  template('w3-day-b', 'Week 3 Day B — Back + Glutes Emphasis', [
    reps('wide-grip-lat-pulldown', 'Wide/Medium-Grip Lat Pulldown', 3, [8, 12]),
    reps('one-arm-dumbbell-row', 'One-Arm Dumbbell Row', 3, [8, 12]),
    reps('single-leg-glute-bridge', 'Single-Leg Hip Thrust', 3, [10, 15]),
    reps('stiff-legged-dumbbell-deadlift', 'Dumbbell Romanian Deadlift', 2, [8, 12]),
    reps('arnold-dumbbell-press', 'Arnold Press', 2, [8, 12]),
    reps('leverage-chest-press', 'Chest Press Machine', 2, [10, 15]),
    reps('dumbbell-shrug', 'Dumbbell Shrug', 2, [10, 15]),
    reps('repwise-tibialis-raise', 'Tibialis Raise', 2, [15, 25]),
    reps('external-rotation', 'External Shoulder Rotation (/side)', 2, [12, 20]),
  ], [CUSTOM_TIBIALIS_RAISE]),
  template('w3-day-c', 'Week 3 Day C — Chest + Triceps Emphasis', [
    reps('decline-dumbbell-bench-press', 'Slight-Decline Dumbbell Press', 3, [8, 12]),
    reps('cable-crossover', 'Cable Crossover', 2, [10, 15]),
    reps('leverage-iso-row', 'Chest-Supported Row', 2, [8, 12]),
    reps('dumbbell-rear-lunge', 'Reverse Lunge (/leg)', 2, [8, 12]),
    reps('dip-machine', 'Dip Machine', 3, [8, 12]),
    reps('standing-overhead-barbell-triceps-extension', 'EZ-Bar Overhead Triceps Extension', 2, [10, 15]),
    reps('seated-calf-raise', 'Seated Calf Raise', 2, [12, 20]),
    reps('thigh-abductor', 'Hip Abductor Machine', 2, [12, 20]),
    reps('repwise-push-up-plus', 'Push-Up Plus / Serratus Cable Punch', 2, [12, 15]),
  ], [CUSTOM_PUSH_UP_PLUS]),
  template('w3-day-d', 'Week 3 Day D — Shoulders + Glutes Emphasis', [
    reps('cable-internal-rotation', 'Internal Rotation Machine (/side)', 2, [12, 15]),
    reps('standing-dumbbell-straight-arm-front-delt-raise-above-head', 'Straight-Arm Shoulder Flexion Machine', 2, [12, 15]),
    reps('arnold-dumbbell-press', 'Arnold Press', 3, [8, 12]),
    reps('side-lateral-raise', 'Lean-Away Dumbbell Lateral Raise', 3, [10, 15]),
    reps('barbell-rear-delt-row', 'Rear-Delt Row', 2, [12, 15]),
    reps('bodyweight-walking-lunge', 'Walking Lunge, Long Stride (/leg)', 3, [10, 12]),
    reps('romanian-deadlift', 'Barbell Romanian Deadlift', 2, [8, 12]),
    reps('dumbbell-bench-press', 'Dumbbell Chest Press', 2, [10, 15]),
    duration('farmers-walk', 'Farmer Carry', 2, [30, 45]),
    reps('face-pull', 'Face Pull', 2, [12, 20]),
    reps('pallof-press', 'Pallof Press (/side)', 2, [10, 15]),
  ]),
]
