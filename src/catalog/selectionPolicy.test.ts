import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createDatabase, type RepwiseDatabase } from '../data/db'
import type { Exercise } from '../domain/models'
import type { GeneratedWorkout, GeneratorInput } from '../domain/contracts'
import type { GeneratedCatalog } from './generatedCatalog'
import policy from './selection-policy.json'
import { applyExercisePolicy, isExerciseSelectable, isBundledProgramSelectable } from './selectionPolicy'
import { seedCatalog } from './seedCatalog'
import { importCatalog } from './importer'
import { exportBackup, restoreBackup, validateBackup } from '../services/backupService'
import { DexieExerciseRepository } from '../data/repositories/exerciseRepository'
import { DeterministicWorkoutGenerator } from '../engines/generator/generatorEngine'
import { WeightedSubstitutionEngine } from '../engines/substitution/substitutionEngine'
import { addExerciseToWorkout, startGeneratedWorkout, startWorkout, startWorkoutTemplate, updateWorkoutExercise } from '../features/workout/workoutActions'
import { addCatalogExerciseToActiveWorkout } from '../features/exercises/catalogWorkoutActions'

const catalog = JSON.parse(readFileSync('public/catalog/catalog.json', 'utf8')) as GeneratedCatalog
const roller = { ...catalog.exercises.find(entry => entry.id === 'ab-roller')!, excluded: false }
const modern = catalog.exercises.find(entry => entry.id === 'barbell-curl')!
const custom: Exercise = { ...modern, id: 'user-own-exercise', name: 'My own exercise', source: 'custom', media: [] }
const input: GeneratorInput = { goal: 'hypertrophy', split: 'full_body', durationMinutes: 60, availableEquipment: ['barbell', 'other'], excludedExerciseIds: [], seed: 'policy-regression' }
let db: RepwiseDatabase
beforeEach(async () => { db = createDatabase(`selection-policy-${crypto.randomUUID()}`); await db.open() })
afterEach(async () => { await db.delete() })

describe('owner-selected modern cohort', () => {
  it('pins exactly 374 latest candidates and retires exactly the other 91 IDs, without a blanket core filter', () => {
    expect(policy.selectable).toHaveLength(374)
    expect(policy.retiredCatalog).toHaveLength(91)
    expect(policy.retiredBundled).toHaveLength(8)
    expect(new Set([...policy.selectable, ...policy.retiredCatalog].map(e => e.id)).size).toBe(465)
    expect(catalog.exercises.filter(isExerciseSelectable)).toHaveLength(374)
    expect(isExerciseSelectable(roller)).toBe(false)
    expect(isExerciseSelectable(catalog.exercises.find(e => e.id === 'barbell-ab-rollout-on-knees')!)).toBe(true)
    expect(applyExercisePolicy({ ...custom, excluded: true }).excluded).toBe(true)
    expect(isExerciseSelectable(custom)).toBe(true)
    expect(isExerciseSelectable({ ...modern, id: 'new-upstream-exercise' })).toBe(false)
  })

  it('normalizes a small import too; category ranking cannot revive Ab Roller', () => {
    const result = importCatalog([{ id: 'Ab_Roller', name: 'Ab Roller', category: 'strength', equipment: 'other', primaryMuscles: ['abdominals'], instructions: ['Kneel and roll.'] }])
    expect(result.exercises[0]).toMatchObject({ id: 'ab-roller', excluded: true })
  })

  it('enforces retirement on same-version startup and repeated updates', async () => {
    await seedCatalog(db, () => Promise.resolve(catalog))
    await db.exercises.put(roller)
    await db.exercises.put(custom)
    expect((await seedCatalog(db, () => Promise.resolve(catalog))).status).toBe('up-to-date')
    expect(await db.exercises.get(roller.id)).toMatchObject({ excluded: true })
    await seedCatalog(db, () => Promise.resolve({ ...catalog, version: 'stale-payload', exercises: catalog.exercises.map(e => ({ ...e, excluded: false })) }))
    expect((await db.exercises.toArray()).filter(isExerciseSelectable)).toHaveLength(375)
    expect(await db.exercises.get(custom.id)).toEqual(custom)
    expect((await new DexieExerciseRepository(db).get(roller.id))?.excluded).toBe(true)
  })

  it('restores a checksum-valid pre-policy backup without reviving old entries or changing historical facts', async () => {
    await db.exercises.bulkPut([roller, modern, custom, ...policy.retiredBundled.map(e => ({ ...custom, ...e }))])
    await db.metadata.put({ key: 'catalogVersion', value: catalog.version })
    const workout = { id: 'historic', date: '2026-10-01', startTime: '2026-10-01T12:00:00Z', endTime: '2026-10-01T12:05:00Z', name: 'Old workout', notes: 'Keep', status: 'completed' as const }
    const historical = { id: 'historic-exercise', workoutId: workout.id, exerciseId: roller.id, order: 0, notes: 'Exact snapshot', restSeconds: 90, snapshot: { name: roller.name, equipment: roller.equipment, movementPattern: roller.movementPattern, muscles: roller.muscles, catalogVersion: 'old' } }
    const set = { id: 'historic-set', workoutExerciseId: historical.id, setNumber: 1, type: 'working' as const, completed: true, loadKg: 15, reps: 8 }
    await db.workouts.put(workout); await db.workoutExercises.put(historical); await db.sets.put(set)
    const backup = await exportBackup(db)
    expect((await validateBackup(backup)).valid).toBe(true)
    await restoreBackup(db, backup)
    expect(await db.workouts.get(workout.id)).toEqual(workout)
    expect(await db.workoutExercises.get(historical.id)).toEqual(historical)
    expect(await db.sets.get(set.id)).toEqual(set)
    expect(await db.exercises.get(roller.id)).toEqual({ ...roller, excluded: true })
    expect(await db.exercises.get(custom.id)).toEqual(custom)
    for (const e of policy.retiredBundled) expect((await db.exercises.get(e.id))?.excluded).toBe(true)
    expect(await db.exercises.count()).toBe(11)
  })

  it('rejects stale direct-add, template and generated-plan entry points atomically', async () => {
    await db.exercises.bulkPut([roller, modern])
    const active = await startWorkout(db, 'Manual')
    await expect(addExerciseToWorkout(db, active.id, roller)).rejects.toThrow('retired')
    await expect(addCatalogExerciseToActiveWorkout(db, active.id, roller)).rejects.toThrow('retired')
    expect(await db.workoutExercises.count()).toBe(0)
    const current = await addExerciseToWorkout(db, active.id, modern)
    await expect(updateWorkoutExercise(db, { ...current, exerciseId: roller.id })).rejects.toThrow('retired')
    expect(await db.workoutExercises.get(current.id)).toEqual(current)
    await db.workouts.update(active.id, { status: 'completed' })
    const template = { id: 'old-template', name: 'Old program', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', exercises: [{ exerciseId: roller.id, sets: 3, repRange: [8, 12] as [number, number], restSeconds: 90 }] }
    await expect(startWorkoutTemplate(db, template)).rejects.toThrow('retired')
    const plan: GeneratedWorkout = { name: 'Stale', exercises: [{ ...template.exercises[0]!, reasons: [] }], engineVersion: 'old', seed: 'old', estimatedDurationSeconds: 300 }
    await expect(startGeneratedWorkout(db, input, plan, plan.name)).rejects.toThrow('retired')
    expect(await db.workouts.count()).toBe(1)
    expect(await db.generatedPlans.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
  })

  it('does not inject bundled definitions through templates; genuine custom templates still work', async () => {
    for (const retired of policy.retiredBundled) {
      const exercise = { ...custom, ...retired }
      const template = { id: 'bundled', name: 'Bundled', createdAt: '2026-10-01', updatedAt: '2026-10-01', exercises: [{ exerciseId: exercise.id, sets: 1, repRange: [8, 12] as [number, number], restSeconds: 60 }], customExercises: [exercise] }
      await expect(startWorkoutTemplate(db, template)).rejects.toThrow('retired')
    }
    expect(await db.exercises.count()).toBe(0)
    expect(await db.workouts.count()).toBe(0)
    expect(isBundledProgramSelectable([modern.id])).toBe(true)
    expect(isBundledProgramSelectable(['repwise-push-up-plus'])).toBe(false)
    await startWorkoutTemplate(db, { id: 'personal', name: 'Personal', createdAt: '2026-10-01', updatedAt: '2026-10-01', exercises: [{ exerciseId: custom.id, sets: 1, repRange: [8, 12], restSeconds: 60 }], customExercises: [custom] })
    expect(await db.exercises.get(custom.id)).toEqual(custom)
  })

  it('filters retired candidates from both deterministic engines despite stale exclusion flags', () => {
    const generator = new DeterministicWorkoutGenerator()
    expect(generator.generate(input, [roller], []).exercises).toEqual([])
    expect(generator.generate(input, [custom], []).exercises.map(e => e.exerciseId)).toContain(custom.id)
    const substitution = new WeightedSubstitutionEngine()
    const source = { ...roller, id: 'user-core-movement', source: 'custom' as const, equipment: ['dumbbell'] }
    expect(substitution.rank(source, [roller], ['dumbbell', 'other'])).toEqual([])
    expect(substitution.rank(source, [{ ...roller, id: custom.id, source: 'custom' }], ['dumbbell', 'other'])).toHaveLength(1)
  })
})
