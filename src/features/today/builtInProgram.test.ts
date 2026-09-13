import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { GeneratedCatalog } from '../../catalog/generatedCatalog'
import { BUILT_IN_PROGRAM, CUSTOM_PUSH_UP_PLUS, CUSTOM_TIBIALIS_RAISE } from './builtInProgram'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const catalog = JSON.parse(readFileSync(join(repoRoot, 'public', 'catalog', 'catalog.json'), 'utf8')) as GeneratedCatalog
const catalogById = new Map(catalog.exercises.map((exercise) => [exercise.id, exercise]))

describe('BUILT_IN_PROGRAM', () => {
  it('has exactly the 12 templates of the 3-week, 4-day rotation in Week/Day order', () => {
    expect(BUILT_IN_PROGRAM.map((t) => t.id)).toEqual([
      'w1-day-a', 'w1-day-b', 'w1-day-c', 'w1-day-d',
      'w2-day-a', 'w2-day-b', 'w2-day-c', 'w2-day-d',
      'w3-day-a', 'w3-day-b', 'w3-day-c', 'w3-day-d',
    ])
    expect(BUILT_IN_PROGRAM.map((t) => t.name)).toEqual([
      'Week 1 Day A — Chest + Biceps Emphasis',
      'Week 1 Day B — Back + Glutes Emphasis',
      'Week 1 Day C — Chest + Triceps Emphasis',
      'Week 1 Day D — Shoulders + Glutes Emphasis',
      'Week 2 Day A — Chest + Biceps Emphasis',
      'Week 2 Day B — Back + Glutes Emphasis',
      'Week 2 Day C — Chest + Triceps Emphasis',
      'Week 2 Day D — Shoulders + Glutes Emphasis',
      'Week 3 Day A — Chest + Biceps Emphasis',
      'Week 3 Day B — Back + Glutes Emphasis',
      'Week 3 Day C — Chest + Triceps Emphasis',
      'Week 3 Day D — Shoulders + Glutes Emphasis',
    ])
  })

  it('every exercise resolves to either a stable, non-excluded catalog id or a bundled custom exercise carried on the same template', () => {
    for (const template of BUILT_IN_PROGRAM) {
      const customById = new Map((template.customExercises ?? []).map((exercise) => [exercise.id, exercise]))
      for (const entry of template.exercises) {
        const catalogExercise = catalogById.get(entry.exerciseId)
        const customExercise = customById.get(entry.exerciseId)
        expect(catalogExercise ?? customExercise, `${template.id}: ${entry.exerciseId} is neither a catalog id nor a bundled custom exercise on this template`).toBeDefined()
        if (catalogExercise) expect(catalogExercise.excluded, `${template.id}: ${entry.exerciseId} is excluded from the catalog`).toBe(false)
        if (customExercise) expect(customExercise.excluded, `${template.id}: custom ${entry.exerciseId} is excluded`).toBe(false)
      }
    }
  })

  it('never bundles a customExercises id that collides with a real catalog id', () => {
    for (const template of BUILT_IN_PROGRAM) {
      for (const custom of template.customExercises ?? []) {
        expect(catalogById.has(custom.id), `${template.id}: custom id ${custom.id} collides with a real catalog exercise`).toBe(false)
      }
    }
  })

  it('"Shoulders + Glutes Emphasis" days carry the 11-exercise D block, other days carry 9', () => {
    for (const template of BUILT_IN_PROGRAM) {
      const expected = template.id.endsWith('day-d') ? 11 : 9
      expect(template.exercises, template.id).toHaveLength(expected)
    }
  })

  it('preserves plan set counts and rep ranges for representative rep-based exercises', () => {
    const w1a = BUILT_IN_PROGRAM.find((t) => t.id === 'w1-day-a')!
    expect(w1a.exercises[0]).toMatchObject({ exerciseId: 'leverage-incline-chest-press', displayName: 'Incline Chest Press Machine', sets: 3, repRange: [8, 12] })
    expect(w1a.exercises[7]).toMatchObject({ exerciseId: 'seated-dumbbell-palms-down-wrist-curl', displayName: 'Reverse Wrist Curl', sets: 2, repRange: [15, 20] })

    const w1b = BUILT_IN_PROGRAM.find((t) => t.id === 'w1-day-b')!
    expect(w1b.exercises[7]).toMatchObject({ exerciseId: 'repwise-tibialis-raise', displayName: 'Tibialis Raise', sets: 2, repRange: [15, 25] })

    const w3c = BUILT_IN_PROGRAM.find((t) => t.id === 'w3-day-c')!
    expect(w3c.exercises[4]).toMatchObject({ exerciseId: 'dip-machine', displayName: 'Dip Machine', sets: 3, repRange: [8, 12] })
  })

  it('preserves /side and /leg display-name suffixes from the plan', () => {
    const w1a = BUILT_IN_PROGRAM.find((t) => t.id === 'w1-day-a')!
    expect(w1a.exercises.at(-1)).toMatchObject({ exerciseId: 'dead-bug', displayName: 'Dead Bug (/side)' })

    const w3d = BUILT_IN_PROGRAM.find((t) => t.id === 'w3-day-d')!
    expect(w3d.exercises.find((e) => e.exerciseId === 'bodyweight-walking-lunge')).toMatchObject({ displayName: 'Walking Lunge, Long Stride (/leg)' })
  })

  it('every Day D template plans Farmer Carry for 2 sets of a 30-45 second duration range, with no repRange', () => {
    const dayDTemplates = BUILT_IN_PROGRAM.filter((t) => t.id.endsWith('day-d'))
    expect(dayDTemplates).toHaveLength(3)
    for (const template of dayDTemplates) {
      const farmerCarry = template.exercises.find((e) => e.exerciseId === 'farmers-walk')
      expect(farmerCarry, template.id).toMatchObject({ displayName: 'Farmer Carry', sets: 2, durationRangeSeconds: [30, 45] })
      expect(farmerCarry?.repRange).toBeUndefined()
    }
  })

  it('uses the corrected catalog mappings from senior review', () => {
    const byId = (id: string) => BUILT_IN_PROGRAM.find((t) => t.id === id)!
    expect(byId('w1-day-b').exercises.find((e) => e.displayName === 'Neutral-Grip Lat Pulldown')).toMatchObject({ exerciseId: 'v-bar-pulldown' })
    expect(byId('w2-day-c').exercises.find((e) => e.displayName === 'Neutral-Grip Lat Pulldown')).toMatchObject({ exerciseId: 'v-bar-pulldown' })
    expect(byId('w1-day-c').exercises.find((e) => e.displayName === 'High-to-Low Cable Fly')).toMatchObject({ exerciseId: 'cable-crossover' })
    expect(byId('w2-day-a').exercises.find((e) => e.displayName === 'Cable Fly')).toMatchObject({ exerciseId: 'cable-crossover' })
    expect(byId('w1-day-d').exercises.find((e) => e.displayName === 'Reverse Pec Deck')).toMatchObject({ exerciseId: 'reverse-machine-flyes' })
    expect(byId('w3-day-c').exercises.find((e) => e.displayName === 'Reverse Lunge (/leg)')).toMatchObject({ exerciseId: 'dumbbell-rear-lunge' })
    expect(byId('w3-day-c').exercises.find((e) => e.displayName === 'EZ-Bar Overhead Triceps Extension')).toMatchObject({ exerciseId: 'standing-overhead-barbell-triceps-extension' })
    expect(byId('w3-day-d').exercises.find((e) => e.displayName === 'Walking Lunge, Long Stride (/leg)')).toMatchObject({ exerciseId: 'bodyweight-walking-lunge' })
  })

  it('no longer maps Tibialis Raise or Push-Up Plus to a materially different catalog movement', () => {
    for (const template of BUILT_IN_PROGRAM) {
      for (const entry of template.exercises) {
        if (entry.displayName === 'Tibialis Raise') expect(entry.exerciseId).toBe('repwise-tibialis-raise')
        if (entry.displayName === 'Push-Up Plus / Serratus Cable Punch') expect(entry.exerciseId).toBe('repwise-push-up-plus')
      }
      expect(template.exercises.map((e) => e.exerciseId)).not.toContain('anterior-tibialis-smr')
      expect(template.exercises.map((e) => e.exerciseId)).not.toContain('incline-push-up')
    }
  })

  it('attaches bundled custom exercise definitions only to the templates that reference them', () => {
    for (const template of BUILT_IN_PROGRAM) {
      const usesTibialis = template.exercises.some((e) => e.exerciseId === 'repwise-tibialis-raise')
      const usesPushUpPlus = template.exercises.some((e) => e.exerciseId === 'repwise-push-up-plus')
      const bundledIds = (template.customExercises ?? []).map((e) => e.id)

      expect(bundledIds.includes('repwise-tibialis-raise'), template.id).toBe(usesTibialis)
      expect(bundledIds.includes('repwise-push-up-plus'), template.id).toBe(usesPushUpPlus)
      expect(template.customExercises?.length ?? 0, template.id).toBe((usesTibialis ? 1 : 0) + (usesPushUpPlus ? 1 : 0))
    }
  })

  it('defines transparent bundled custom exercises with no media, source "custom", and the required primary muscle', () => {
    expect(CUSTOM_TIBIALIS_RAISE).toMatchObject({
      id: 'repwise-tibialis-raise',
      name: 'Tibialis Raise',
      category: 'strength',
      mechanic: 'isolation',
      equipment: ['bodyweight'],
      source: 'custom',
      excluded: false,
      media: [],
    })
    expect(CUSTOM_TIBIALIS_RAISE.muscles).toEqual([{ muscleId: 'calves', weight: 1 }])
    expect(CUSTOM_TIBIALIS_RAISE.instructions.join(' ')).toMatch(/dorsiflex|lift.*toes|shin/i)

    expect(CUSTOM_PUSH_UP_PLUS).toMatchObject({
      id: 'repwise-push-up-plus',
      name: 'Push-Up Plus',
      category: 'strength',
      mechanic: 'compound',
      equipment: ['bodyweight'],
      source: 'custom',
      excluded: false,
      media: [],
    })
    expect(CUSTOM_PUSH_UP_PLUS.muscles.find((m) => m.muscleId === 'chest')?.weight).toBe(1)
    expect(CUSTOM_PUSH_UP_PLUS.muscles.map((m) => m.muscleId)).toEqual(expect.arrayContaining(['shoulders', 'triceps']))
    expect(CUSTOM_PUSH_UP_PLUS.instructions.join(' ')).toMatch(/protract/i)
  })
})
