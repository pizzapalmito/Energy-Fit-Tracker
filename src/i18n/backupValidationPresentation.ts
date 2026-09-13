import type { Translator } from './enumLabels'
import type { MessageKey } from './messages'

/**
 * Localizes `validateBackup` error strings (`services/backupService.ts`) at
 * the UI boundary. The backup service's contract (its shapes, and the exact
 * English text it produces/checks) is untouched. This exactly matches its
 * known message shapes and re-renders the surrounding phrase in the active
 * locale while keeping embedded technical details — table names, record
 * indices, schema version numbers — verbatim, since those are stable
 * identifiers, not prose. Anything that doesn't match a known shape (an
 * unexpected/foreign detail) is returned unchanged (safe fallback).
 */

const STATIC_MESSAGES: Record<string, MessageKey> = {
  'The file is not valid JSON.': 'backupValidation.invalidJson',
  'The backup envelope or version is invalid.': 'backupValidation.invalidEnvelope',
  'The backup checksum does not match.': 'backupValidation.checksumMismatch',
}

const SCHEMA_VERSION_RE = /^Unsupported database schema version: (-?\d+)\.$/
const MISSING_TABLE_RE = /^Missing table: (.+)\.$/
const NOT_ARRAY_RE = /^Table (.+) is not an array\.$/
const DUPLICATE_IDS_RE = /^Duplicate IDs in table: (.+)\.$/
const RECORD_NOT_OBJECT_RE = /^(.+)\[(\d+)\] is not an object\.$/
const RECORD_NO_KEY_RE = /^(.+)\[(\d+)\] has no valid primary key\.$/
const RECORD_MALFORMED_RE = /^(.+)\[(\d+)\] is malformed\.$/
const RECORD_INVALID_UNIT_RE = /^(.+)\[(\d+)\] has an invalid unit\.$/

export function formatBackupValidationError(t: Translator, message: string): string {
  const staticKey = STATIC_MESSAGES[message]
  if (staticKey) return t(staticKey)

  const schemaVersionMatch = SCHEMA_VERSION_RE.exec(message)
  if (schemaVersionMatch) return t('backupValidation.unsupportedSchemaVersion', { version: schemaVersionMatch[1]! })

  const missingTableMatch = MISSING_TABLE_RE.exec(message)
  if (missingTableMatch) return t('backupValidation.missingTable', { table: missingTableMatch[1]! })

  const notArrayMatch = NOT_ARRAY_RE.exec(message)
  if (notArrayMatch) return t('backupValidation.tableNotArray', { table: notArrayMatch[1]! })

  const duplicateIdsMatch = DUPLICATE_IDS_RE.exec(message)
  if (duplicateIdsMatch) return t('backupValidation.duplicateIds', { table: duplicateIdsMatch[1]! })

  const notObjectMatch = RECORD_NOT_OBJECT_RE.exec(message)
  if (notObjectMatch) return t('backupValidation.recordNotObject', { table: notObjectMatch[1]!, index: notObjectMatch[2]! })

  const noKeyMatch = RECORD_NO_KEY_RE.exec(message)
  if (noKeyMatch) return t('backupValidation.recordNoKey', { table: noKeyMatch[1]!, index: noKeyMatch[2]! })

  const malformedMatch = RECORD_MALFORMED_RE.exec(message)
  if (malformedMatch) return t('backupValidation.recordMalformed', { table: malformedMatch[1]!, index: malformedMatch[2]! })

  const invalidUnitMatch = RECORD_INVALID_UNIT_RE.exec(message)
  if (invalidUnitMatch) return t('backupValidation.recordInvalidUnit', { table: invalidUnitMatch[1]!, index: invalidUnitMatch[2]! })

  return message
}
