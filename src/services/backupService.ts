import { DB_SCHEMA_VERSION, type RepwiseDatabase } from '../data/db'

export const BACKUP_FORMAT_VERSION = 1

export interface BackupPayload {
  appId: 'repwise'
  formatVersion: number
  dbSchemaVersion: number
  catalogVersion: string
  exportedAt: string
  tables: Record<string, unknown[]>
}

export interface BackupEnvelope {
  payload: BackupPayload
  checksum: string
}

export interface BackupValidation {
  valid: boolean
  errors: string[]
  recordCount: number
  envelope?: BackupEnvelope
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readBlobText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read backup file.'))
    reader.readAsText(file)
  })
}

function isEnvelope(value: unknown): value is BackupEnvelope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BackupEnvelope>
  const payload = candidate.payload as Partial<BackupPayload> | undefined
  return candidate.checksum !== undefined && typeof candidate.checksum === 'string' &&
    payload?.appId === 'repwise' && payload.formatVersion === BACKUP_FORMAT_VERSION &&
    typeof payload.dbSchemaVersion === 'number' && typeof payload.catalogVersion === 'string' &&
    typeof payload.exportedAt === 'string' && !!payload.tables && typeof payload.tables === 'object'
}

const REQUIRED_TABLES = ['exercises', 'muscles', 'workouts', 'workoutExercises', 'sets', 'recoveryFeedback', 'equipmentProfiles', 'settings', 'templates', 'generatedPlans', 'metadata'] as const

function validateRecord(table: string, row: unknown, index: number): string | undefined {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return `${table}[${index}] is not an object.`
  const record = row as Record<string, unknown>
  const key = table === 'metadata' ? record.key : record.id
  if (typeof key !== 'string' || key.length === 0) return `${table}[${index}] has no valid primary key.`
  if (table === 'workouts' && (!['active', 'completed', 'discarded'].includes(String(record.status)) || typeof record.startTime !== 'string')) return `${table}[${index}] is malformed.`
  if (table === 'workoutExercises' && (typeof record.workoutId !== 'string' || typeof record.exerciseId !== 'string' || typeof record.snapshot !== 'object')) return `${table}[${index}] is malformed.`
  if (table === 'sets' && (typeof record.workoutExerciseId !== 'string' || typeof record.completed !== 'boolean' || typeof record.setNumber !== 'number')) return `${table}[${index}] is malformed.`
  if (table === 'settings' && !['kg', 'lb'].includes(String(record.unit))) return `${table}[${index}] has an invalid unit.`
  return undefined
}

async function collectTables(db: RepwiseDatabase): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {}
  for (const table of db.tables) result[table.name] = await table.toArray()
  return result
}

export async function exportBackup(db: RepwiseDatabase): Promise<Blob> {
  const catalogVersion = (await db.metadata.get('catalogVersion'))?.value ?? 'unknown'
  const payload: BackupPayload = {
    appId: 'repwise',
    formatVersion: BACKUP_FORMAT_VERSION,
    dbSchemaVersion: db.verno,
    catalogVersion,
    exportedAt: new Date().toISOString(),
    tables: await collectTables(db),
  }
  const checksum = await sha256(JSON.stringify(payload))
  return new Blob([JSON.stringify({ payload, checksum } satisfies BackupEnvelope, null, 2)], { type: 'application/json' })
}

export async function validateBackup(file: Blob): Promise<BackupValidation> {
  const errors: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(await readBlobText(file))
  } catch {
    return { valid: false, errors: ['The file is not valid JSON.'], recordCount: 0 }
  }
  if (!isEnvelope(parsed)) return { valid: false, errors: ['The backup envelope or version is invalid.'], recordCount: 0 }
  if (await sha256(JSON.stringify(parsed.payload)) !== parsed.checksum) errors.push('The backup checksum does not match.')
  if (parsed.payload.dbSchemaVersion < 1 || parsed.payload.dbSchemaVersion > DB_SCHEMA_VERSION) errors.push(`Unsupported database schema version: ${parsed.payload.dbSchemaVersion}.`)
  for (const name of REQUIRED_TABLES) if (!Array.isArray(parsed.payload.tables[name])) errors.push(`Missing table: ${name}.`)
  let recordCount = 0
  for (const [name, rows] of Object.entries(parsed.payload.tables)) {
    if (!Array.isArray(rows)) { errors.push(`Table ${name} is not an array.`); continue }
    recordCount += rows.length
    const ids = rows.map((row) => {
      if (!row || typeof row !== 'object') return undefined
      const value = row as Record<string, unknown>
      return value.id ?? value.key
    }).filter((id): id is string => typeof id === 'string')
    if (ids.length !== new Set(ids).size) errors.push(`Duplicate IDs in table: ${name}.`)
    rows.forEach((row, index) => {
      const error = validateRecord(name, row, index)
      if (error) errors.push(error)
    })
  }
  return { valid: errors.length === 0, errors, recordCount, envelope: parsed }
}

export async function restoreBackup(db: RepwiseDatabase, file: Blob): Promise<number> {
  const validation = await validateBackup(file)
  if (!validation.valid || !validation.envelope) throw new Error(validation.errors.join(' '))
  const tables = validation.envelope.payload.tables
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const rows = tables[table.name] ?? []
      if (rows.length > 0) await table.bulkPut(rows)
    }
    const settings = await db.settings.get('default')
    if (settings) await db.settings.put({ trainingGoal: 'hypertrophy', preferredSplit: 'full_body', defaultDurationMinutes: 60, ...settings })
  })
  return validation.recordCount
}

export async function exportWorkoutCsv(db: RepwiseDatabase): Promise<Blob> {
  const workouts = new Map((await db.workouts.toArray()).map((row) => [row.id, row]))
  const exercises = new Map((await db.workoutExercises.toArray()).map((row) => [row.id, row]))
  const rows = ['date,workout,exercise,set,type,weight_kg,reps,rir,rpe,duration_seconds,distance_meters']
  const quote = (value: unknown) => {
    let text = ''
    if (typeof value === 'string') text = value
    else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') text = `${value}`
    else if (value !== null && typeof value === 'object') text = JSON.stringify(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  for (const set of await db.sets.toArray()) {
    const exercise = exercises.get(set.workoutExerciseId)
    const workout = exercise ? workouts.get(exercise.workoutId) : undefined
    if (!exercise || !workout || !set.completed) continue
    rows.push([workout.date, workout.name, exercise.snapshot.name, set.setNumber, set.type, set.loadKg, set.reps, set.rir, set.rpe, set.durationSeconds, set.distanceMeters].map(quote).join(','))
  }
  return new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}
