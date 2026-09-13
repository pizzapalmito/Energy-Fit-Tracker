import { describe, expect, it } from 'vitest'
import { formatBackupValidationError } from './backupValidationPresentation'
import { MESSAGES_BY_LOCALE } from './messages'
import { translate } from './translate'
import type { SupportedLocale } from './locale'
import type { MessageKey } from './messages'

function translatorFor(locale: SupportedLocale) {
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(MESSAGES_BY_LOCALE[locale], key, vars)
}

describe('formatBackupValidationError', () => {
  it('localizes the three static messages', () => {
    expect(formatBackupValidationError(translatorFor('en'), 'The file is not valid JSON.')).toBe('The file is not valid JSON.')
    expect(formatBackupValidationError(translatorFor('fr'), 'The file is not valid JSON.')).toBe('Le fichier n’est pas un JSON valide.')
    expect(formatBackupValidationError(translatorFor('es'), 'The backup envelope or version is invalid.')).toBe('El sobre o la versión de la copia de seguridad no es válida.')
    expect(formatBackupValidationError(translatorFor('pt-BR'), 'The backup checksum does not match.')).toBe('A soma de verificação do backup não corresponde.')
  })

  it('localizes the schema-version message while keeping the version number verbatim', () => {
    expect(formatBackupValidationError(translatorFor('fr'), 'Unsupported database schema version: 99.')).toBe('Version du schéma de base de données non prise en charge : 99.')
  })

  it('localizes table-level messages while keeping the technical table name verbatim', () => {
    expect(formatBackupValidationError(translatorFor('en'), 'Missing table: templates.')).toBe('Missing table: templates.')
    expect(formatBackupValidationError(translatorFor('es'), 'Missing table: templates.')).toBe('Falta la tabla: templates.')
    expect(formatBackupValidationError(translatorFor('fr'), 'Table workouts is not an array.')).toBe('La table workouts n’est pas un tableau.')
    expect(formatBackupValidationError(translatorFor('pt-BR'), 'Duplicate IDs in table: sets.')).toBe('IDs duplicados na tabela: sets.')
  })

  it('localizes record-level messages while keeping the table name and index verbatim', () => {
    expect(formatBackupValidationError(translatorFor('es'), 'workouts[3] is not an object.')).toBe('workouts[3] no es un objeto.')
    expect(formatBackupValidationError(translatorFor('fr'), 'sets[0] has no valid primary key.')).toBe('sets[0] n’a pas de clé primaire valide.')
    expect(formatBackupValidationError(translatorFor('pt-BR'), 'workoutExercises[12] is malformed.')).toBe('workoutExercises[12] está malformado.')
    expect(formatBackupValidationError(translatorFor('en'), 'settings[0] has an invalid unit.')).toBe('settings[0] has an invalid unit.')
  })

  it('returns an unrecognized technical detail unchanged (safe fallback)', () => {
    expect(formatBackupValidationError(translatorFor('fr'), 'A completely new validation failure.')).toBe('A completely new validation failure.')
  })
})
