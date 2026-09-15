import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type RepwiseDatabase } from '../data/db'
import { exportBackup, exportWorkoutCsv, MAX_BACKUP_BYTES, restoreBackup, validateBackup, type BackupEnvelope } from './backupService'

let source: RepwiseDatabase
let target: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  source = createDatabase(`backup-source-${counter}`)
  target = createDatabase(`backup-target-${counter}`)
  await Promise.all([source.open(), target.open()])
})

afterEach(async () => { source.close(); target.close(); await Promise.all([source.delete(), target.delete()]) })

async function checksum(payload: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read test blob.'))
    reader.readAsText(blob)
  })
}

describe('backup service', () => {
  it('exports, validates, and transactionally restores all database tables', async () => {
    await source.equipmentProfiles.put({ id: 'home', name: 'Home', availableEquipment: ['dumbbell'], isDefault: true })
    await source.settings.put({ id: 'default', unit: 'lb', activeEquipmentProfileId: 'home' })
    await source.muscles.put({ id: 'chest', name: 'Chest', group: 'upper', aliases: [] })
    await source.workouts.put({ id: 'w1', date: '2026-09-12', startTime: '2026-09-12T10:00:00Z', endTime: '2026-09-12T11:00:00Z', name: 'Test', notes: '', status: 'completed' })
    await source.workoutExercises.put({ id: 'we1', workoutId: 'w1', exerciseId: 'removed-catalog-exercise', order: 0, notes: '', restSeconds: 90, snapshot: { name: 'Bench', equipment: ['dumbbell'], movementPattern: 'push', muscles: [{ muscleId: 'chest', weight: 1 }], catalogVersion: 'old' } })
    await source.sets.put({ id: 's1', workoutExerciseId: 'we1', setNumber: 1, type: 'working', loadKg: 25, reps: 8, completed: true, completedAt: '2026-09-12T10:30:00Z' })
    await source.recoveryFeedback.put({ id: 'chest-2026-09-12', muscleId: 'chest', date: '2026-09-12', subjectiveState: 'normal' })
    const blob = await exportBackup(source)
    expect((await validateBackup(blob)).valid).toBe(true)
    await target.settings.put({ id: 'default', unit: 'kg' })
    await restoreBackup(target, blob)
    expect((await target.settings.get('default'))?.unit).toBe('lb')
    expect((await target.settings.get('default'))?.trainingGoal).toBe('hypertrophy')
    expect(await target.workouts.get('w1')).toBeDefined()
    expect(await target.sets.get('s1')).toMatchObject({ loadKg: 25, reps: 8 })
  })

  it('rejects checksum damage and duplicate primary keys before restore', async () => {
    const original = JSON.parse(await blobText(await exportBackup(source))) as BackupEnvelope
    original.payload.tables.settings = [{ id: 'default', unit: 'kg' }, { id: 'default', unit: 'lb' }]
    original.checksum = await checksum(original.payload)
    const validation = await validateBackup(new Blob([JSON.stringify(original)]))
    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Duplicate IDs in table: settings.')
    original.checksum = 'damaged'
    expect((await validateBackup(new Blob([JSON.stringify(original)]))).errors).toContain('The backup checksum does not match.')
  })

  it('rejects malformed records and unsupported future schemas', async () => {
    const envelope = JSON.parse(await blobText(await exportBackup(source))) as BackupEnvelope
    envelope.payload.dbSchemaVersion = 999
    envelope.payload.tables.workouts = [{ id: 'bad', status: 'unknown' }]
    envelope.checksum = await checksum(envelope.payload)
    const validation = await validateBackup(new Blob([JSON.stringify(envelope)]))
    expect(validation.errors.some((error) => error.includes('Unsupported database schema'))).toBe(true)
    expect(validation.errors).toContain('workouts[0] is malformed.')
  })

  it('rejects checksum-valid structural corruption and relationship orphans', async () => {
    await source.workouts.put({ id: 'w1', date: '2026-09-12', startTime: '2026-09-12T10:00:00Z', name: 'Test', notes: '', status: 'completed' })
    await source.workoutExercises.put({ id: 'we1', workoutId: 'w1', exerciseId: 'historical-only', order: 0, notes: '', restSeconds: 90, snapshot: { name: 'Bench', equipment: [], movementPattern: 'push', muscles: [], catalogVersion: 'v1' } })
    await source.sets.put({ id: 's1', workoutExerciseId: 'we1', setNumber: 1, type: 'working', loadKg: 50, reps: 8, completed: true })
    const envelope = JSON.parse(await blobText(await exportBackup(source))) as BackupEnvelope
    ;(envelope.payload.tables.workoutExercises![0] as Record<string, unknown>).snapshot = null
    ;(envelope.payload.tables.sets![0] as Record<string, unknown>).workoutExerciseId = 'missing-parent'
    ;(envelope.payload.tables.sets![0] as Record<string, unknown>).loadKg = -500
    envelope.checksum = await checksum(envelope.payload)

    const validation = await validateBackup(new Blob([JSON.stringify(envelope)]))
    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('workoutExercises[0] is malformed.')
    expect(validation.errors).toContain('sets[0] is malformed.')
  })

  it('validates template and generated-plan internals instead of accepting arbitrary keyed objects', async () => {
    const envelope = JSON.parse(await blobText(await exportBackup(source))) as BackupEnvelope
    envelope.payload.tables.templates = [{ id: 'template-bad', name: 'Broken', createdAt: 'not-a-date', updatedAt: 'not-a-date', exercises: 'not-an-array' }]
    envelope.payload.tables.generatedPlans = [{ id: 'plan-bad', createdAt: '2026-09-12T10:00:00Z', input: null, plan: {} }]
    envelope.checksum = await checksum(envelope.payload)

    const validation = await validateBackup(new Blob([JSON.stringify(envelope)]))
    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('templates[0] is malformed.')
    expect(validation.errors).toContain('generatedPlans[0] is malformed.')
  })

  it('rejects oversized backups before attempting to read them', async () => {
    const oversized = { size: MAX_BACKUP_BYTES + 1 } as Blob
    await expect(validateBackup(oversized)).resolves.toMatchObject({ valid: false, recordCount: 0 })
  })

  it('exports only completed set facts to CSV', async () => {
    await source.workouts.bulkPut([
      { id: 'w1', date: '2026-09-12', startTime: '2026-09-12T10:00:00Z', name: '  =HYPERLINK("bad")', notes: '', status: 'completed' },
      { id: 'w2', date: '2026-09-12', startTime: '2026-09-12T10:00:00Z', name: 'Discarded', notes: '', status: 'discarded' },
    ])
    await source.workoutExercises.bulkPut([
      { id: 'we1', workoutId: 'w1', exerciseId: 'bench', order: 0, notes: '', restSeconds: 90, snapshot: { name: '@Bench', equipment: [], movementPattern: 'push', muscles: [], catalogVersion: 'v1' } },
      { id: 'we2', workoutId: 'w2', exerciseId: 'bench', order: 0, notes: '', restSeconds: 90, snapshot: { name: 'Discarded Bench', equipment: [], movementPattern: 'push', muscles: [], catalogVersion: 'v1' } },
    ])
    await source.sets.bulkPut([
      { id: 'done', workoutExerciseId: 'we1', setNumber: 1, type: 'working', loadKg: 50, reps: 8, completed: true },
      { id: 'open', workoutExerciseId: 'we1', setNumber: 2, type: 'working', completed: false },
      { id: 'discarded', workoutExerciseId: 'we2', setNumber: 1, type: 'working', loadKg: 999, reps: 1, completed: true },
    ])
    const csv = await blobText(await exportWorkoutCsv(source))
    expect(csv).toContain('"\'  =HYPERLINK(""bad"")"')
    expect(csv).toContain('"\'@Bench"')
    expect(csv).toContain('"50","8"')
    expect(csv).not.toContain('Discarded')
    expect(csv).not.toContain('999')
  })
})
