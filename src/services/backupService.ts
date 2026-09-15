import { DB_SCHEMA_VERSION, type RepwiseDatabase } from '../data/db'
import { normalizeLocale, SUPPORTED_LOCALES } from '../i18n/locale'

export const BACKUP_FORMAT_VERSION = 1
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024

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
const REQUIRED_TABLE_SET = new Set<string>(REQUIRED_TABLES)

const SET_TYPES = new Set(['warmup', 'working', 'backoff', 'dropset', 'failure'])
const WORKOUT_STATUSES = new Set(['active', 'completed', 'discarded'])
const SUBJECTIVE_STATES = new Set(['very_sore', 'sore', 'normal', 'fresh'])
const EXERCISE_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced'])
const EXERCISE_MECHANICS = new Set(['compound', 'isolation', 'unknown'])
const EXERCISE_SOURCES = new Set(['catalog', 'custom'])
const TRAINING_GOALS = new Set(['strength', 'hypertrophy', 'general', 'endurance', 'maintenance'])
const WORKOUT_SPLITS = new Set(['full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'recovery_adaptive', 'custom'])
const UNITS = new Set(['kg', 'lb'])
const LOCALES = new Set<string>(SUPPORTED_LOCALES)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isOptionalNonNegativeFiniteNumber(value: unknown): boolean {
  return value === undefined || isNonNegativeFiniteNumber(value)
}

function isOptionalRirRpe(value: unknown): boolean {
  return value === undefined || (isFiniteNumber(value) && value >= 0 && value <= 10)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isValidDateOnly(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isValidIsoDateTime(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function isMuscleContribution(value: unknown): boolean {
  return isPlainObject(value) && isNonEmptyString(value.muscleId) && isNonNegativeFiniteNumber(value.weight)
}

function isExerciseSnapshot(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  return isNonEmptyString(value.name) && isStringArray(value.equipment) && isNonEmptyString(value.movementPattern) &&
    Array.isArray(value.muscles) && value.muscles.every(isMuscleContribution) && isNonEmptyString(value.catalogVersion)
}

function isValidExercise(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.name) && isStringArray(record.aliases) && isNonEmptyString(record.category) &&
    isNonEmptyString(record.movementPattern) && EXERCISE_DIFFICULTIES.has(String(record.difficulty)) &&
    EXERCISE_MECHANICS.has(String(record.mechanic)) && isStringArray(record.equipment) &&
    isStringArray(record.instructions) && Array.isArray(record.muscles) && record.muscles.every(isMuscleContribution) &&
    (record.substitutionGroup === undefined || typeof record.substitutionGroup === 'string') &&
    isNonNegativeFiniteNumber(record.defaultRestSeconds) && isStringArray(record.media) &&
    EXERCISE_SOURCES.has(String(record.source)) && typeof record.excluded === 'boolean'
}

function isValidMuscle(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.name) && isNonEmptyString(record.group) && isStringArray(record.aliases)
}

function isValidWorkout(record: Record<string, unknown>): boolean {
  return isValidDateOnly(record.date) && isValidIsoDateTime(record.startTime) &&
    (record.endTime === undefined || isValidIsoDateTime(record.endTime)) &&
    typeof record.name === 'string' && typeof record.notes === 'string' && WORKOUT_STATUSES.has(String(record.status))
}

function isValidWorkoutExercise(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.workoutId) && isNonEmptyString(record.exerciseId) &&
    isNonNegativeFiniteNumber(record.order) && Number.isInteger(record.order) && typeof record.notes === 'string' &&
    isNonNegativeFiniteNumber(record.restSeconds) && isExerciseSnapshot(record.snapshot)
}

function isValidSet(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.workoutExerciseId) && isNonNegativeFiniteNumber(record.setNumber) && Number.isInteger(record.setNumber) && record.setNumber >= 1 &&
    SET_TYPES.has(String(record.type)) && isOptionalNonNegativeFiniteNumber(record.loadKg) &&
    isOptionalNonNegativeFiniteNumber(record.reps) && isOptionalNonNegativeFiniteNumber(record.durationSeconds) &&
    isOptionalNonNegativeFiniteNumber(record.distanceMeters) && isOptionalRirRpe(record.rir) && isOptionalRirRpe(record.rpe) &&
    typeof record.completed === 'boolean' && (record.completedAt === undefined || isValidIsoDateTime(record.completedAt))
}

function isValidRecoveryFeedback(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.muscleId) && isValidDateOnly(record.date) && SUBJECTIVE_STATES.has(String(record.subjectiveState))
}

function isValidEquipmentProfile(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.name) && isStringArray(record.availableEquipment) && typeof record.isDefault === 'boolean'
}

function isValidSettings(record: Record<string, unknown>): boolean {
  return record.id === 'default' && UNITS.has(String(record.unit)) &&
    (record.activeEquipmentProfileId === undefined || isNonEmptyString(record.activeEquipmentProfileId)) &&
    (record.theme === undefined || typeof record.theme === 'string') &&
    (record.lastBackupAt === undefined || isValidIsoDateTime(record.lastBackupAt)) &&
    (record.trainingGoal === undefined || (typeof record.trainingGoal === 'string' && TRAINING_GOALS.has(record.trainingGoal))) &&
    (record.preferredSplit === undefined || (typeof record.preferredSplit === 'string' && WORKOUT_SPLITS.has(record.preferredSplit))) &&
    (record.defaultDurationMinutes === undefined || (isFiniteNumber(record.defaultDurationMinutes) && record.defaultDurationMinutes >= 15 && record.defaultDurationMinutes <= 180)) &&
    (record.locale === undefined || (typeof record.locale === 'string' && LOCALES.has(record.locale)))
}

function isValidMetadata(record: Record<string, unknown>): boolean {
  return typeof record.value === 'string'
}

function isNumberRange(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 2) return false
  const minimum = value[0] as unknown
  const maximum = value[1] as unknown
  return isNonNegativeFiniteNumber(minimum) && isNonNegativeFiniteNumber(maximum) && minimum <= maximum
}

function isValidTemplateExercise(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  const plannedSetsValid = value.plannedSets === undefined || (Array.isArray(value.plannedSets) && value.plannedSets.every((set) =>
    isPlainObject(set) && isOptionalNonNegativeFiniteNumber(set.loadKg) && isOptionalNonNegativeFiniteNumber(set.reps) && isOptionalNonNegativeFiniteNumber(set.durationSeconds)))
  return isNonEmptyString(value.exerciseId) && (value.displayName === undefined || typeof value.displayName === 'string') &&
    isNonNegativeFiniteNumber(value.sets) && Number.isInteger(value.sets) && value.sets >= 1 &&
    (value.repRange === undefined || isNumberRange(value.repRange)) &&
    (value.durationRangeSeconds === undefined || isNumberRange(value.durationRangeSeconds)) &&
    isNonNegativeFiniteNumber(value.restSeconds) && plannedSetsValid
}

function isValidTemplate(record: Record<string, unknown>): boolean {
  return isNonEmptyString(record.name) && isValidIsoDateTime(record.createdAt) && isValidIsoDateTime(record.updatedAt) &&
    Array.isArray(record.exercises) && record.exercises.every(isValidTemplateExercise) &&
    (record.customExercises === undefined || (Array.isArray(record.customExercises) && record.customExercises.every((exercise) => isPlainObject(exercise) && isNonEmptyString(exercise.id) && isValidExercise(exercise))))
}

function isValidGeneratorInput(value: unknown): boolean {
  return isPlainObject(value) && TRAINING_GOALS.has(String(value.goal)) && WORKOUT_SPLITS.has(String(value.split)) &&
    isFiniteNumber(value.durationMinutes) && value.durationMinutes >= 15 && value.durationMinutes <= 180 &&
    isStringArray(value.availableEquipment) && isStringArray(value.excludedExerciseIds) && isNonEmptyString(value.seed) &&
    (value.customTargetMuscleIds === undefined || isStringArray(value.customTargetMuscleIds)) &&
    (value.recentSuccessfulLoadByExerciseId === undefined || (isPlainObject(value.recentSuccessfulLoadByExerciseId) && Object.values(value.recentSuccessfulLoadByExerciseId).every(isNonNegativeFiniteNumber)))
}

function isValidGeneratedWorkout(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  return isNonEmptyString(value.name) && isNonEmptyString(value.engineVersion) && isNonEmptyString(value.seed) &&
    isNonNegativeFiniteNumber(value.estimatedDurationSeconds) && Array.isArray(value.exercises) && value.exercises.every((exercise) =>
      isPlainObject(exercise) && isNonEmptyString(exercise.exerciseId) && isNonNegativeFiniteNumber(exercise.sets) && Number.isInteger(exercise.sets) && exercise.sets >= 1 &&
      isNumberRange(exercise.repRange) && isNonNegativeFiniteNumber(exercise.restSeconds) && isStringArray(exercise.reasons) && isOptionalNonNegativeFiniteNumber(exercise.recommendedLoadKg))
}

function isValidGeneratedPlan(record: Record<string, unknown>): boolean {
  return isValidIsoDateTime(record.createdAt) && isValidGeneratorInput(record.input) && isValidGeneratedWorkout(record.plan)
}

interface CrossTableContext {
  workoutIds: Set<string>
  workoutExerciseIds: Set<string>
  muscleIds: Set<string>
  equipmentProfileIds: Set<string>
}

function idsOf(rows: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(rows)) return ids
  for (const row of rows) if (isPlainObject(row) && typeof row.id === 'string') ids.add(row.id)
  return ids
}

function buildCrossTableContext(tables: Record<string, unknown>): CrossTableContext {
  return {
    workoutIds: idsOf(tables.workouts),
    workoutExerciseIds: idsOf(tables.workoutExercises),
    muscleIds: idsOf(tables.muscles),
    equipmentProfileIds: idsOf(tables.equipmentProfiles),
  }
}

/**
 * Table-specific shape/enum/reference validation. `workoutExercise.exerciseId` is
 * intentionally never checked against the exercises table: historical snapshots
 * must remain valid restore targets even after the catalog exercise is removed.
 */
function isRowValid(table: string, record: Record<string, unknown>, context: CrossTableContext): boolean {
  switch (table) {
    case 'exercises': return isValidExercise(record)
    case 'muscles': return isValidMuscle(record)
    case 'workouts': return isValidWorkout(record)
    case 'workoutExercises': return isValidWorkoutExercise(record) && context.workoutIds.has(record.workoutId as string)
    case 'sets': return isValidSet(record) && context.workoutExerciseIds.has(record.workoutExerciseId as string)
    case 'recoveryFeedback': return isValidRecoveryFeedback(record) && context.muscleIds.has(record.muscleId as string)
    case 'equipmentProfiles': return isValidEquipmentProfile(record)
    case 'settings': return isValidSettings(record) &&
      (record.activeEquipmentProfileId === undefined || context.equipmentProfileIds.has(record.activeEquipmentProfileId as string))
    case 'templates': return isValidTemplate(record)
    case 'generatedPlans': return isValidGeneratedPlan(record)
    case 'metadata': return isValidMetadata(record)
    default: return false
  }
}

function validateRecord(table: string, row: unknown, index: number, context: CrossTableContext): string | undefined {
  if (!isPlainObject(row)) return `${table}[${index}] is not an object.`
  const key = table === 'metadata' ? row.key : row.id
  if (typeof key !== 'string' || key.length === 0) return `${table}[${index}] has no valid primary key.`
  if (!isRowValid(table, row, context)) return `${table}[${index}] is malformed.`
  return undefined
}

async function collectTables(db: RepwiseDatabase): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {}
  for (const table of db.tables) result[table.name] = await table.toArray()
  return result
}

/** Reads the catalog version and every table inside a single Dexie read transaction for a consistent snapshot. */
export async function exportBackup(db: RepwiseDatabase): Promise<Blob> {
  const { catalogVersion, tables } = await db.transaction('r', db.tables, async () => ({
    catalogVersion: (await db.metadata.get('catalogVersion'))?.value ?? 'unknown',
    tables: await collectTables(db),
  }))
  const payload: BackupPayload = {
    appId: 'repwise',
    formatVersion: BACKUP_FORMAT_VERSION,
    dbSchemaVersion: db.verno,
    catalogVersion,
    exportedAt: new Date().toISOString(),
    tables,
  }
  const checksum = await sha256(JSON.stringify(payload))
  return new Blob([JSON.stringify({ payload, checksum } satisfies BackupEnvelope, null, 2)], { type: 'application/json' })
}

export async function validateBackup(file: Blob): Promise<BackupValidation> {
  if (file.size > MAX_BACKUP_BYTES) return { valid: false, errors: ['The backup file exceeds the maximum allowed size.'], recordCount: 0 }

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
  for (const name of Object.keys(parsed.payload.tables)) if (!REQUIRED_TABLE_SET.has(name)) errors.push(`Unknown table: ${name}.`)

  const context = buildCrossTableContext(parsed.payload.tables)
  const workouts = parsed.payload.tables.workouts
  if (Array.isArray(workouts) && workouts.filter((row) => isPlainObject(row) && row.status === 'active').length > 1) {
    errors.push('More than one active workout.')
  }

  let recordCount = 0
  for (const [name, rows] of Object.entries(parsed.payload.tables)) {
    if (!Array.isArray(rows)) { errors.push(`Table ${name} is not an array.`); continue }
    recordCount += rows.length
    const ids = rows.map((row) => {
      if (!isPlainObject(row)) return undefined
      return name === 'metadata' ? row.key : row.id
    }).filter((id): id is string => typeof id === 'string')
    if (ids.length !== new Set(ids).size) errors.push(`Duplicate IDs in table: ${name}.`)
    rows.forEach((row, index) => {
      const error = validateRecord(name, row, index, context)
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
    if (settings) await db.settings.put({ trainingGoal: 'hypertrophy', preferredSplit: 'full_body', defaultDurationMinutes: 60, ...settings, locale: normalizeLocale(settings.locale) })
  })
  return validation.recordCount
}

const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@'])

/** Prefixes an apostrophe when the first non-whitespace character could be read as a spreadsheet formula by CSV-importing tools. */
function neutralizeFormulaInjection(value: string): string {
  const firstNonWhitespace = /\S/.exec(value)?.[0]
  return firstNonWhitespace && FORMULA_TRIGGER_CHARS.has(firstNonWhitespace) ? `'${value}` : value
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
    if (!exercise || !workout || workout.status !== 'completed' || !set.completed) continue
    rows.push([
      workout.date,
      neutralizeFormulaInjection(workout.name),
      neutralizeFormulaInjection(exercise.snapshot.name),
      set.setNumber, set.type, set.loadKg, set.reps, set.rir, set.rpe, set.durationSeconds, set.distanceMeters,
    ].map(quote).join(','))
  }
  return new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}
