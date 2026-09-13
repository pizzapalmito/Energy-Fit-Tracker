import { useState } from 'react'
import type { WorkoutSplit } from '../../domain/contracts'
import type { TrainingGoal } from '../../domain/models'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { SETTINGS_SINGLETON_ID } from '../../data/repositories/settingsRepository'
import { exportBackup, exportWorkoutCsv, restoreBackup, validateBackup, type BackupValidation } from '../../services/backupService'
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
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_SINGLETON_ID), [db])
  const profiles = useLiveQuery(() => db.equipmentProfiles.toArray(), [db])
  const [profileName, setProfileName] = useState('')
  const [equipment, setEquipment] = useState('barbell,dumbbell,bench')
  const [restoreFile, setRestoreFile] = useState<File>()
  const [validation, setValidation] = useState<BackupValidation>()
  const [message, setMessage] = useState('')
  const current = settings.status === 'ready' ? settings.value : undefined

  async function saveSettings(changes: Partial<NonNullable<typeof current>>) {
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'kg', ...current, ...changes })
  }

  async function setUnit(unit: 'kg' | 'lb') {
    await saveSettings({ unit })
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
    download(await exportBackup(db), `repwise-backup-${dateStamp()}.json`)
    await saveSettings({ lastBackupAt: new Date().toISOString() })
    setMessage('Backup created.')
  }

  async function inspectFile(file: File) {
    setRestoreFile(file)
    setValidation(await validateBackup(file))
  }

  async function restore() {
    if (!restoreFile || !validation?.valid) return
    const count = await restoreBackup(db, restoreFile)
    setMessage(`Restored ${count} records.`)
    setRestoreFile(undefined)
    setValidation(undefined)
  }

  const daysSinceBackup = current?.lastBackupAt ? Math.floor((Date.now() - Date.parse(current.lastBackupAt)) / 86400000) : undefined
  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Local and private</p><h1>Settings</h1>
      {daysSinceBackup === undefined || daysSinceBackup >= 21 ? <p className={styles.reminder}>Your workout history is stored in this browser. Create a backup now.</p> : null}
      <section className={styles.card}><h2>Units</h2><div className={styles.segment}><button aria-pressed={(current?.unit ?? 'kg') === 'kg'} onClick={() => void setUnit('kg')}>Kilograms</button><button aria-pressed={current?.unit === 'lb'} onClick={() => void setUnit('lb')}>Pounds</button></div></section>
      <section className={styles.card}><h2>Workout preferences</h2><label>Training goal<select value={current?.trainingGoal ?? 'hypertrophy'} onChange={(event) => void saveSettings({ trainingGoal: event.target.value as TrainingGoal })}>{['strength', 'hypertrophy', 'general', 'endurance', 'maintenance'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Preferred split<select value={current?.preferredSplit ?? 'full_body'} onChange={(event) => void saveSettings({ preferredSplit: event.target.value as WorkoutSplit })}>{['full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'recovery_adaptive', 'custom'].map((value) => <option key={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label>Default workout duration<input type="number" min="15" max="180" step="5" value={current?.defaultDurationMinutes ?? 60} onChange={(event) => void saveSettings({ defaultDurationMinutes: Math.max(15, Number(event.target.value) || 60) })} /></label></section>
      <section className={styles.card}><h2>Equipment profiles</h2>{profiles.status === 'ready' && profiles.value.map((profile) => <button className={styles.profile} key={profile.id} onClick={() => void saveSettings({ activeEquipmentProfileId: profile.id })} aria-pressed={current?.activeEquipmentProfileId === profile.id}>{profile.name} · {profile.availableEquipment.join(', ')}</button>)}<label>Profile name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><label>Equipment, comma separated<input value={equipment} onChange={(event) => setEquipment(event.target.value)} /></label><button onClick={() => void createProfile()}>Add profile</button></section>
      <section className={styles.card}><h2>Backup and export</h2><div className={styles.actions}><button onClick={() => void makeBackup()}>Download complete JSON backup</button><button onClick={() => void exportWorkoutCsv(db).then((blob) => download(blob, `repwise-history-${dateStamp()}.csv`))}>Export workout CSV</button></div><label>Restore JSON backup<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectFile(file) }} /></label>{validation && <div role={validation.valid ? 'status' : 'alert'}>{validation.valid ? `${validation.recordCount} records validated. Existing local data will be replaced.` : validation.errors.join(' ')}</div>}{validation?.valid && <button className={styles.danger} onClick={() => void restore()}>Confirm restore</button>}</section>
      <section className={styles.card}><h2>Privacy</h2><p>No account, cloud service, analytics, or remote AI is used. Recovery is a transparent training-readiness estimate, not medical advice.</p></section>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
