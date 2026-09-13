import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type RepwiseDatabase } from '../data/db'
import { exportBackup, exportWorkoutCsv, restoreBackup, validateBackup, type BackupEnvelope } from './backupService'

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
    await source.settings.put({ id: 'default', unit: 'lb' })
    await source.workouts.put({ id: 'w1', date: '2026-09-12', startTime: '2026-09-12T10:00:00Z', name: 'Test', notes: '', status: 'completed' })
    const blob = await exportBackup(source)
    expect((await validateBackup(blob)).valid).toBe(true)
    await target.settings.put({ id: 'default', unit: 'kg' })
    await restoreBackup(target, blob)
    expect((await target.settings.get('default'))?.unit).toBe('lb')
    expect((await target.settings.get('default'))?.trainingGoal).toBe('hypertrophy')
    expect(await target.workouts.get('w1')).toBeDefined()
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

  it('exports only completed set facts to CSV', async () => {
    await source.workouts.put({ id: 'w1', date: '2026-09-12', startTime: '2026-09-12T10:00:00Z', name: 'A, B', notes: '', status: 'completed' })
    await source.workoutExercises.put({ id: 'we1', workoutId: 'w1', exerciseId: 'bench', order: 0, notes: '', restSeconds: 90, snapshot: { name: 'Bench', equipment: [], movementPattern: 'push', muscles: [], catalogVersion: 'v1' } })
    await source.sets.bulkPut([{ id: 'done', workoutExerciseId: 'we1', setNumber: 1, type: 'working', loadKg: 50, reps: 8, completed: true }, { id: 'open', workoutExerciseId: 'we1', setNumber: 2, type: 'working', completed: false }])
    const csv = await blobText(await exportWorkoutCsv(source))
    expect(csv).toContain('"A, B"')
    expect(csv).toContain('"50","8"')
    expect(csv).not.toContain('open')
  })
})
