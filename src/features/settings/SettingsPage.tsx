import { useEffect, useRef, useState } from 'react'
import type { WorkoutSplit } from '../../domain/contracts'
import type { TrainingGoal } from '../../domain/models'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { SETTINGS_SINGLETON_ID } from '../../data/repositories/settingsRepository'
import { exportBackup, exportWorkoutCsv, restoreBackup, validateBackup, type BackupValidation } from '../../services/backupService'
import { useI18n } from '../../i18n/I18nContext'
import { equipmentLabel, equipmentProfileNameLabel, splitLabel, trainingGoalLabel } from '../../i18n/enumLabels'
import { formatBackupValidationError } from '../../i18n/backupValidationPresentation'
import { LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES } from '../../i18n/locale'
import styles from './SettingsPage.module.css'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function dateStamp() { return new Date().toISOString().slice(0, 10) }

export function SettingsPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const { t, tn, locale, setLocale } = useI18n()
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_SINGLETON_ID), [db])
  const profiles = useLiveQuery(() => db.equipmentProfiles.toArray(), [db])
  const [profileName, setProfileName] = useState('')
  const [equipment, setEquipment] = useState('barbell,dumbbell,bench')
  const [restoreFile, setRestoreFile] = useState<File>()
  const [validation, setValidation] = useState<BackupValidation>()
  const [message, setMessage] = useState('')
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>('hypertrophy')
  const [preferredSplit, setPreferredSplit] = useState<WorkoutSplit>('full_body')
  const [durationText, setDurationText] = useState('60')
  const [durationTouched, setDurationTouched] = useState(false)
  const preferenceTouched = useRef({ trainingGoal: false, preferredSplit: false, duration: false })
  const preferencesInitialized = useRef(false)
  const current = settings.status === 'ready' ? settings.value : undefined

  useEffect(() => {
    if (settings.status !== 'ready' || preferencesInitialized.current) return
    preferencesInitialized.current = true
    if (!preferenceTouched.current.trainingGoal) setTrainingGoal(settings.value?.trainingGoal ?? 'hypertrophy')
    if (!preferenceTouched.current.preferredSplit) setPreferredSplit(settings.value?.preferredSplit ?? 'full_body')
    if (!preferenceTouched.current.duration) setDurationText(String(settings.value?.defaultDurationMinutes ?? 60))
  }, [settings])

  async function saveSettings(changes: Partial<NonNullable<typeof current>>) {
    const stored = await db.settings.get(SETTINGS_SINGLETON_ID)
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'kg', ...stored, ...changes })
  }

  async function setUnit(unit: 'kg' | 'lb') {
    await saveSettings({ unit })
  }

  const durationMinutes = Number(durationText)
  const durationValid = durationText.trim() !== '' && Number.isFinite(durationMinutes) && durationMinutes >= 15 && durationMinutes <= 180
  const preferencesDirty = trainingGoal !== (current?.trainingGoal ?? 'hypertrophy')
    || preferredSplit !== (current?.preferredSplit ?? 'full_body')
    || (durationValid && durationMinutes !== (current?.defaultDurationMinutes ?? 60))

  async function saveWorkoutPreferences() {
    setDurationTouched(true)
    if (!durationValid) return
    await saveSettings({ trainingGoal, preferredSplit, defaultDurationMinutes: durationMinutes })
    setMessage(t('settings.settingsSaved'))
  }

  async function createProfile() {
    const name = profileName.trim()
    if (!name) return
    const id = crypto.randomUUID()
    await db.equipmentProfiles.put({ id, name, availableEquipment: equipment.split(',').map((item) => item.trim()).filter(Boolean), isDefault: false })
    await saveSettings({ activeEquipmentProfileId: id })
    setProfileName('')
  }

  async function makeBackup() {
    download(await exportBackup(db), `energy-fit-tracker-backup-${dateStamp()}.json`)
    await saveSettings({ lastBackupAt: new Date().toISOString() })
    setMessage(t('settings.backupCreated'))
  }

  async function inspectFile(file: File) {
    setRestoreFile(file)
    setValidation(await validateBackup(file))
  }

  async function restore() {
    if (!restoreFile || !validation?.valid) return
    const count = await restoreBackup(db, restoreFile)
    setMessage(tn('settings.restoredRecords', count))
    setRestoreFile(undefined)
    setValidation(undefined)
  }

  const daysSinceBackup = current?.lastBackupAt ? Math.floor((Date.now() - Date.parse(current.lastBackupAt)) / 86400000) : undefined
  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{t('settings.eyebrow')}</p><h1>{t('settings.title')}</h1>

      <section className={styles.card}><h2>{t('settings.unitsTitle')}</h2><div className={styles.segment}><button aria-pressed={(current?.unit ?? 'kg') === 'kg'} onClick={() => void setUnit('kg')}>{t('settings.kilograms')}</button><button aria-pressed={current?.unit === 'lb'} onClick={() => void setUnit('lb')}>{t('settings.pounds')}</button></div></section>
      <section className={styles.card}><h2>{t('settings.languageTitle')}</h2><div className={styles.segment} role="group" aria-label={t('settings.languageTitle')}>{SUPPORTED_LOCALES.map((code) => <button key={code} type="button" aria-pressed={locale === code} onClick={() => setLocale(code)}>{LOCALE_NATIVE_NAMES[code]}</button>)}</div></section>
      <section className={`${styles.card} ${styles.preferences}`}>
        <h2>{t('settings.workoutPreferencesTitle')}</h2>
        <label>{t('settings.trainingGoalLabel')}<select value={trainingGoal} onChange={(event) => { preferenceTouched.current.trainingGoal = true; setTrainingGoal(event.target.value as TrainingGoal); setMessage('') }}>{['strength', 'hypertrophy', 'general', 'endurance', 'maintenance'].map((value) => <option key={value} value={value}>{trainingGoalLabel(t, value)}</option>)}</select></label>
        <label>{t('settings.preferredSplitLabel')}<select value={preferredSplit} onChange={(event) => { preferenceTouched.current.preferredSplit = true; setPreferredSplit(event.target.value as WorkoutSplit); setMessage('') }}>{['full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'recovery_adaptive', 'custom'].map((value) => <option key={value} value={value}>{splitLabel(t, value)}</option>)}</select></label>
        <label>{t('settings.defaultDurationLabel')}<input type="number" min="15" max="180" step="5" value={durationText} aria-invalid={durationTouched && !durationValid ? 'true' : undefined} aria-describedby="settings-duration-help" onBlur={() => setDurationTouched(true)} onChange={(event) => { preferenceTouched.current.duration = true; setDurationText(event.target.value); setMessage('') }} /></label>
        <p id="settings-duration-help" className={durationTouched && !durationValid ? styles.fieldError : styles.fieldHint}>{t('settings.durationRange')}</p>
        <button type="button" className={styles.saveButton} disabled={!durationValid || !preferencesDirty} onClick={() => void saveWorkoutPreferences()}>{t('settings.saveSettings')}</button>
      </section>
      <section className={styles.card}><h2>{t('settings.equipmentProfilesTitle')}</h2>{profiles.status === 'ready' && profiles.value.map((profile) => <button className={styles.profile} key={profile.id} onClick={() => void saveSettings({ activeEquipmentProfileId: profile.id })} aria-pressed={current?.activeEquipmentProfileId === profile.id}>{equipmentProfileNameLabel(t, profile)} · {profile.availableEquipment.map((item) => equipmentLabel(t, item)).join(', ')}</button>)}<label>{t('settings.profileNameLabel')}<input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><label>{t('settings.equipmentCommaLabel')}<input value={equipment} onChange={(event) => setEquipment(event.target.value)} /></label><button onClick={() => void createProfile()}>{t('settings.addProfile')}</button></section>
      {daysSinceBackup === undefined || daysSinceBackup >= 21 ? <p className={styles.reminder}>{t('settings.backupReminder')}</p> : null}
      <section className={styles.card}><h2>{t('settings.backupExportTitle')}</h2><div className={styles.actions}><button onClick={() => void makeBackup()}>{t('settings.downloadBackup')}</button><button onClick={() => void exportWorkoutCsv(db).then((blob) => download(blob, `energy-fit-tracker-history-${dateStamp()}.csv`))}>{t('settings.exportCsv')}</button></div><label>{t('settings.restoreLabel')}<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectFile(file) }} /></label>{validation && <div role={validation.valid ? 'status' : 'alert'}>{validation.valid ? tn('settings.restoreValid', validation.recordCount) : validation.errors.map((error) => formatBackupValidationError(t, error)).join(' ')}</div>}{validation?.valid && <button className={styles.danger} onClick={() => void restore()}>{t('settings.confirmRestore')}</button>}</section>
      <section className={styles.card}><h2>{t('settings.privacyTitle')}</h2><p>{t('settings.privacyBody')}</p></section>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
