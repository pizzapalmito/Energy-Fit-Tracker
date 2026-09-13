import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import type { Exercise, RecoveryFeedback, Workout, WorkoutExercise, WorkoutSet } from '../domain/models'
import { createDatabase, type RepwiseDatabase } from './db'
import { DexieExerciseRepository } from './repositories/exerciseRepository'
import { DexieMuscleRepository } from './repositories/muscleRepository'
import { DexieRecoveryFeedbackRepository } from './repositories/recoveryFeedbackRepository'
import { DexieSetRepository } from './repositories/setRepository'
import { ActiveWorkoutConflictError, DexieWorkoutRepository } from './repositories/workoutRepository'
import { DexieWorkoutExerciseRepository } from './repositories/workoutExerciseRepository'
import { DexieMetadataRepository } from './repositories/metadataRepository'
import { DexieSettingsRepository } from './repositories/settingsRepository'
import { DexieWorkoutTemplateRepository } from './repositories/templateRepository'
import { DexieGeneratedPlanRepository } from './repositories/generatedPlanRepository'
import type { GeneratedPlanRecord, Muscle, WorkoutTemplate } from './types'
import type { GeneratorInput } from '../domain/contracts'

let db: RepwiseDatabase
let testDbCounter = 0

beforeEach(async () => {
  testDbCounter += 1
  db = createDatabase(`repwise-test-${testDbCounter}`)
  await db.open()
})

function workout(overrides: Partial<Workout> = {}): Workout {
  return { id: 'w-1', date: '2026-01-10', startTime: '2026-01-10T08:00:00.000Z', name: 'Push Day', notes: '', status: 'active', ...overrides }
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'bench-press',
    name: 'Bench Press',
    aliases: [],
    category: 'strength',
    movementPattern: 'push',
    difficulty: 'intermediate',
    mechanic: 'compound',
    equipment: ['barbell'],
    instructions: [],
    muscles: [{ muscleId: 'chest', weight: 1 }],
    defaultRestSeconds: 120,
    media: [],
    source: 'catalog',
    excluded: false,
    ...overrides,
  }
}

describe('RepwiseDatabase persistence', () => {
  it('migrates v1 settings to the current preference defaults without losing the unit', async () => {
    const name = `repwise-migration-${testDbCounter}`
    const old = new Dexie(name)
    old.version(1).stores({ exercises: 'id', muscles: 'id', workouts: 'id,status,date,[status+date]', workoutExercises: 'id,workoutId,exerciseId,order,[workoutId+order]', sets: 'id,workoutExerciseId,setNumber,completed,[workoutExerciseId+setNumber]', recoveryFeedback: 'id,muscleId,date,[muscleId+date]', equipmentProfiles: 'id,isDefault', settings: 'id', templates: 'id,createdAt,updatedAt', generatedPlans: 'id,createdAt', metadata: 'key' })
    await old.open()
    await old.table('settings').put({ id: 'default', unit: 'lb' })
    old.close()
    const upgraded = createDatabase(name)
    await upgraded.open()
    expect(await upgraded.settings.get('default')).toMatchObject({ unit: 'lb', trainingGoal: 'hypertrophy', preferredSplit: 'full_body', defaultDurationMinutes: 60, locale: 'en' })
    upgraded.close()
    await upgraded.delete()
  })

  it('defaults a pre-localization settings row (no locale field) to English on upgrade', async () => {
    const name = `repwise-locale-migration-${testDbCounter}`
    const old = new Dexie(name)
    old.version(2).stores({ exercises: 'id', muscles: 'id', workouts: 'id,status,date,[status+date]', workoutExercises: 'id,workoutId,exerciseId,order,[workoutId+order]', sets: 'id,workoutExerciseId,setNumber,completed,[workoutExerciseId+setNumber]', recoveryFeedback: 'id,muscleId,date,[muscleId+date]', equipmentProfiles: 'id,isDefault', settings: 'id', templates: 'id,createdAt,updatedAt', generatedPlans: 'id,createdAt', metadata: 'key' })
    await old.open()
    await old.table('settings').put({ id: 'default', unit: 'kg', trainingGoal: 'strength', preferredSplit: 'upper', defaultDurationMinutes: 45 })
    old.close()
    const upgraded = createDatabase(name)
    await upgraded.open()
    expect(await upgraded.settings.get('default')).toMatchObject({ unit: 'kg', locale: 'en' })
    upgraded.close()
    await upgraded.delete()
  })

  it('normalizes an unsupported persisted locale to English on upgrade', async () => {
    const name = `repwise-locale-invalid-${testDbCounter}`
    const old = new Dexie(name)
    old.version(2).stores({ exercises: 'id', muscles: 'id', workouts: 'id,status,date,[status+date]', workoutExercises: 'id,workoutId,exerciseId,order,[workoutId+order]', sets: 'id,workoutExerciseId,setNumber,completed,[workoutExerciseId+setNumber]', recoveryFeedback: 'id,muscleId,date,[muscleId+date]', equipmentProfiles: 'id,isDefault', settings: 'id', templates: 'id,createdAt,updatedAt', generatedPlans: 'id,createdAt', metadata: 'key' })
    await old.open()
    await old.table('settings').put({ id: 'default', unit: 'kg', locale: 'de' })
    old.close()
    const upgraded = createDatabase(name)
    await upgraded.open()
    expect(await upgraded.settings.get('default')).toMatchObject({ unit: 'kg', locale: 'en' })
    upgraded.close()
    await upgraded.delete()
  })

  it('preserves a valid persisted locale across the upgrade', async () => {
    const name = `repwise-locale-valid-${testDbCounter}`
    const old = new Dexie(name)
    old.version(2).stores({ exercises: 'id', muscles: 'id', workouts: 'id,status,date,[status+date]', workoutExercises: 'id,workoutId,exerciseId,order,[workoutId+order]', sets: 'id,workoutExerciseId,setNumber,completed,[workoutExerciseId+setNumber]', recoveryFeedback: 'id,muscleId,date,[muscleId+date]', equipmentProfiles: 'id,isDefault', settings: 'id', templates: 'id,createdAt,updatedAt', generatedPlans: 'id,createdAt', metadata: 'key' })
    await old.open()
    await old.table('settings').put({ id: 'default', unit: 'kg', locale: 'fr' })
    old.close()
    const upgraded = createDatabase(name)
    await upgraded.open()
    expect(await upgraded.settings.get('default')).toMatchObject({ unit: 'kg', locale: 'fr' })
    upgraded.close()
    await upgraded.delete()
  })
  it('persists an exercise immediately and reads it back', async () => {
    const repo = new DexieExerciseRepository(db)
    await repo.bulkUpsert([exercise()])
    const fetched = await repo.get('bench-press')
    expect(fetched?.name).toBe('Bench Press')
    expect(await repo.list()).toHaveLength(1)
  })

  it('persists a muscle catalog', async () => {
    const repo = new DexieMuscleRepository(db)
    const muscle: Muscle = { id: 'chest', name: 'Chest', group: 'chest', aliases: [] }
    await repo.bulkUpsert([muscle])
    expect(await repo.get('chest')).toEqual(muscle)
  })

  it('allows saving a single active workout and retrieving it via getActive', async () => {
    const repo = new DexieWorkoutRepository(db)
    await repo.saveWorkout(workout({ status: 'active' }))
    const active = await repo.getActive()
    expect(active?.id).toBe('w-1')
  })

  it('enforces at most one active workout', async () => {
    const repo = new DexieWorkoutRepository(db)
    await repo.saveWorkout(workout({ id: 'w-1', status: 'active' }))
    await expect(repo.saveWorkout(workout({ id: 'w-2', status: 'active' }))).rejects.toThrow(ActiveWorkoutConflictError)
    const active = await repo.getActive()
    expect(active?.id).toBe('w-1')
  })

  it('allows re-saving the same active workout (update, not a conflict)', async () => {
    const repo = new DexieWorkoutRepository(db)
    await repo.saveWorkout(workout({ id: 'w-1', status: 'active', notes: 'first' }))
    await repo.saveWorkout(workout({ id: 'w-1', status: 'active', notes: 'second' }))
    const active = await repo.getActive()
    expect(active?.notes).toBe('second')
  })

  it('allows starting a new active workout after the previous one is completed', async () => {
    const repo = new DexieWorkoutRepository(db)
    await repo.saveWorkout(workout({ id: 'w-1', status: 'active' }))
    await repo.saveWorkout(workout({ id: 'w-1', status: 'completed' }))
    await repo.saveWorkout(workout({ id: 'w-2', status: 'active' }))
    const active = await repo.getActive()
    expect(active?.id).toBe('w-2')
  })

  it('orders workout exercises by their `order` field', async () => {
    const repo = new DexieWorkoutExerciseRepository(db)
    const snapshot = { name: 'Ex', equipment: [], movementPattern: 'push', muscles: [], catalogVersion: 'v1' }
    const entries: WorkoutExercise[] = [
      { id: 'we-2', workoutId: 'w-1', exerciseId: 'b', order: 2, notes: '', restSeconds: 90, snapshot },
      { id: 'we-1', workoutId: 'w-1', exerciseId: 'a', order: 1, notes: '', restSeconds: 90, snapshot },
    ]
    for (const entry of entries) await repo.save(entry)
    const ordered = await repo.listByWorkout('w-1')
    expect(ordered.map((e) => e.id)).toEqual(['we-1', 'we-2'])
  })

  it('orders sets by set number within a workout exercise', async () => {
    const repo = new DexieSetRepository(db)
    const sets: WorkoutSet[] = [
      { id: 's-2', workoutExerciseId: 'we-1', setNumber: 2, type: 'working', completed: true },
      { id: 's-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', completed: true },
    ]
    for (const s of sets) await repo.save(s)
    const ordered = await repo.listByWorkoutExercise('we-1')
    expect(ordered.map((s) => s.id)).toEqual(['s-1', 's-2'])
  })

  it('lists completed workout history most-recent-first', async () => {
    const repo = new DexieWorkoutRepository(db)
    await repo.saveWorkout(workout({ id: 'w-old', date: '2026-01-01', status: 'completed' }))
    await repo.saveWorkout(workout({ id: 'w-new', date: '2026-01-15', status: 'completed' }))
    const history = await repo.listHistory()
    expect(history.map((w) => w.id)).toEqual(['w-new', 'w-old'])
  })

  it('persists recovery feedback and lists it ordered by date', async () => {
    const repo = new DexieRecoveryFeedbackRepository(db)
    const entries: RecoveryFeedback[] = [
      { id: 'f-2', muscleId: 'chest', date: '2026-01-15', subjectiveState: 'sore' },
      { id: 'f-1', muscleId: 'chest', date: '2026-01-01', subjectiveState: 'fresh' },
    ]
    for (const entry of entries) await repo.save(entry)
    const ordered = await repo.listByMuscle('chest')
    expect(ordered.map((f) => f.id)).toEqual(['f-1', 'f-2'])
  })

  it('persists metadata key/value pairs', async () => {
    const repo = new DexieMetadataRepository(db)
    await repo.set('catalogVersion', 'v1')
    expect(await repo.get('catalogVersion')).toBe('v1')
  })

  it('persists app settings as a singleton row', async () => {
    const repo = new DexieSettingsRepository(db)
    await repo.save({ id: 'default', unit: 'kg' })
    const settings = await repo.get()
    expect(settings?.unit).toBe('kg')
  })

  it('keeps reusable workout templates and generated-plan history in separate tables with distinct shapes', async () => {
    const templateRepo = new DexieWorkoutTemplateRepository(db)
    const planRepo = new DexieGeneratedPlanRepository(db)

    const template: WorkoutTemplate = {
      id: 'tmpl-1',
      name: 'Push Day A',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      exercises: [{ exerciseId: 'bench-press', sets: 4, repRange: [6, 12], restSeconds: 120 }],
    }
    const generatorInput: GeneratorInput = {
      goal: 'hypertrophy',
      split: 'push',
      durationMinutes: 60,
      availableEquipment: ['barbell'],
      excludedExerciseIds: [],
      seed: 'seed-1',
    }
    const planRecord: GeneratedPlanRecord = {
      id: 'plan-1',
      createdAt: '2026-01-05T00:00:00.000Z',
      input: generatorInput,
      plan: { name: 'push — hypertrophy', exercises: [], engineVersion: 'generator-v2', seed: 'seed-1', estimatedDurationSeconds: 0 },
    }

    await templateRepo.save(template)
    await planRepo.save(planRecord)

    expect(await templateRepo.get('tmpl-1')).toEqual(template)
    expect(await db.templates.get('plan-1')).toBeUndefined()
    expect(await db.generatedPlans.get('tmpl-1')).toBeUndefined()

    const plans = await planRepo.list()
    expect(plans).toHaveLength(1)
    expect(plans[0]?.input.seed).toBe('seed-1')

    const templates = await templateRepo.list()
    expect(templates).toHaveLength(1)
    expect(templates[0]?.exercises[0]?.exerciseId).toBe('bench-press')
  })

  it('mutations are durable across repository instances backed by the same open database', async () => {
    await new DexieExerciseRepository(db).bulkUpsert([exercise()])
    const secondHandle = new DexieExerciseRepository(db)
    expect(await secondHandle.get('bench-press')).toBeDefined()
  })
})
