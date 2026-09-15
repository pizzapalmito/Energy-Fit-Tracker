import { useEffect, useId, useRef, useState } from 'react'
import type { WorkoutSet } from '../../domain/models'
import { useI18n } from '../../i18n/I18nContext'
import type { WeightUnit } from './units'
import { kgToDisplayWeight, displayWeightToKg } from './units'
import type { SetFieldErrors, SetFieldInput } from './validation'
import styles from './SetRow.module.css'

interface NumberFieldProps {
  id: string
  draftKey: string
  label: string
  value: number | undefined
  error?: string
  min?: number
  max?: number
  inputMode?: 'decimal' | 'numeric'
  onCommit: (value: number | undefined) => Promise<boolean>
}

const DRAFT_PREFIX = 'energy-fit-tracker:set-draft:'

function readDraft(key: string): string | undefined {
  try { return localStorage.getItem(`${DRAFT_PREFIX}${key}`) ?? undefined } catch { return undefined }
}

function writeDraft(key: string, value: string) {
  try { localStorage.setItem(`${DRAFT_PREFIX}${key}`, value) } catch { /* IndexedDB remains the primary persistence path. */ }
}

function clearDraft(key: string, expectedValue: string) {
  try {
    const storageKey = `${DRAFT_PREFIX}${key}`
    if (localStorage.getItem(storageKey) === expectedValue) localStorage.removeItem(storageKey)
  } catch { /* Ignore unavailable localStorage. */ }
}

function NumberField({ id, draftKey, label, value, error, min, max, inputMode = 'decimal', onCommit }: NumberFieldProps) {
  const [text, setText] = useState(() => readDraft(draftKey) ?? (value === undefined ? '' : String(value)))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current && readDraft(draftKey) === undefined) setText(value === undefined ? '' : String(value))
  }, [draftKey, value])

  useEffect(() => {
    const pendingDraft = readDraft(draftKey)
    if (pendingDraft !== undefined) commit(pendingDraft)
    // A persisted draft belongs to this stable set/field key. Prop changes do not
    // re-run recovery while the same NumberField remains mounted.
  }, [draftKey])

  /** Commits empty and parseable values immediately; an unparseable in-progress keystroke (e.g. a lone "-") is left uncommitted rather than surfacing a premature error. */
  function commit(rawValue: string) {
    const trimmed = rawValue.trim()
    let write: Promise<boolean> | undefined
    if (trimmed === '') {
      write = onCommit(undefined)
    } else {
      const parsed = Number(trimmed)
      if (!Number.isNaN(parsed)) write = onCommit(parsed)
    }
    if (write) void write.then((saved) => { if (saved) clearDraft(draftKey, rawValue) })
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode={inputMode}
        min={min}
        max={max}
        step="any"
        value={text}
        onChange={(e) => {
          writeDraft(draftKey, e.target.value)
          setText(e.target.value)
          commit(e.target.value)
        }}
        onFocus={() => { focused.current = true }}
        onBlur={(event) => {
          focused.current = false
          commit(event.currentTarget.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export interface SetRowProps {
  set: WorkoutSet
  index: number
  unit: WeightUnit
  previous: string
  onCommitField: (field: keyof SetFieldInput, value: number | undefined) => Promise<SetFieldErrors>
  onToggleComplete: () => Promise<void>
  onDelete: () => Promise<void>
}

/** One-handed gym logging row. Extended set facts remain preserved in the model but out of the primary UI. */
export function SetRow({ set, index, unit, previous, onCommitField, onToggleComplete, onDelete }: SetRowProps) {
  const { t } = useI18n()
  const baseId = useId()
  const [errors, setErrors] = useState<SetFieldErrors>({})
  const [saveError, setSaveError] = useState<string>()
  const [deleteRevealed, setDeleteRevealed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pendingWrites = useRef(new Set<Promise<boolean>>())
  const fieldWrites = useRef<Partial<Record<keyof SetFieldInput, { value: number | undefined; promise: Promise<boolean>; settled: boolean }>>>({})
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined)

  function trackWrite(write: Promise<boolean>) {
    pendingWrites.current.add(write)
    void write.finally(() => pendingWrites.current.delete(write))
  }

  /**
   * Skips re-requesting a value that's already in flight for the same field (e.g. an immediate on-change
   * commit followed by a blur with the same text), and otherwise chains onto any still-pending write for
   * that field so an older write can never start after — and overwrite — a newer one.
   */
  function commitAndTrack(field: keyof SetFieldInput, value: number | undefined): Promise<boolean> {
    const existing = fieldWrites.current[field]
    if (existing && !existing.settled && existing.value === value) return existing.promise
    setSaveError(undefined)
    const runWrite = (): Promise<boolean> => onCommitField(field, value).then((fieldErrors) => {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }))
      return !fieldErrors[field]
    }).catch(() => {
      setSaveError(t('setRow.saveError'))
      return false
    })
    const write = existing && !existing.settled ? existing.promise.then(runWrite) : runWrite()
    const state = { value, promise: write, settled: false }
    fieldWrites.current[field] = state
    trackWrite(write)
    void write.finally(() => { state.settled = true })
    return write
  }

  async function toggleComplete() {
    const writesSucceeded = await Promise.all([...pendingWrites.current])
    if (writesSucceeded.some((succeeded) => !succeeded) || saveError || Object.values(errors).some(Boolean)) return
    try {
      await onToggleComplete()
    } catch {
      setSaveError(t('setRow.updateError'))
    }
  }

  async function deleteSet() {
    setDeleting(true)
    setSaveError(undefined)
    try {
      await onDelete()
    } catch {
      setDeleting(false)
      setSaveError(t('setRow.deleteError'))
    }
  }

  return (
    <li
      className={styles.swipeContainer}
      data-revealed={deleteRevealed}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') pointerStart.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerUp={(event) => {
        const start = pointerStart.current
        pointerStart.current = undefined
        if (!start || event.pointerType !== 'touch') return
        const deltaX = event.clientX - start.x
        const deltaY = event.clientY - start.y
        if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return
        setDeleteRevealed(deltaX < 0)
      }}
    >
      <button
        type="button"
        className={styles.deleteButton}
        aria-label={t('setRow.deleteAriaLabel', { index: index + 1 })}
        disabled={deleting}
        onFocus={() => setDeleteRevealed(true)}
        onClick={() => void deleteSet()}
      >
        {deleting ? '…' : t('setRow.delete')}
      </button>
      <div className={styles.row} data-completed={set.completed}>
        <span className={styles.setNumber} aria-label={t('setRow.setAriaLabel', { index: index + 1 })}>{index + 1}</span>
        <span className={styles.previous}>{previous}</span>
        <div className={styles.weightField}>
          <NumberField
            id={`${baseId}-load`}
            draftKey={`${set.id}:load:${unit}`}
            label={t('setRow.loadLabel', { unit })}
            value={set.loadKg === undefined ? undefined : kgToDisplayWeight(set.loadKg, unit)}
            error={errors.loadKg}
            min={0}
            onCommit={(value) => commitAndTrack('loadKg', value === undefined ? undefined : displayWeightToKg(value, unit))}
          />
        </div>
        <div className={styles.repsField}>
          <NumberField id={`${baseId}-reps`} draftKey={`${set.id}:reps`} label={t('setRow.repsLabel')} value={set.reps} error={errors.reps} min={0} inputMode="numeric" onCommit={(value) => commitAndTrack('reps', value)} />
        </div>
        <button type="button" className={styles.completeButton} aria-label={set.completed ? t('setRow.completed') : t('setRow.markComplete')} aria-pressed={set.completed} onClick={() => void toggleComplete()}>{set.completed ? '✓' : '○'}</button>
        {saveError && <p className={styles.fieldError} role="alert">{saveError}</p>}
      </div>
    </li>
  )
}
