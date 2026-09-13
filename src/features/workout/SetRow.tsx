import { useEffect, useId, useRef, useState } from 'react'
import type { WorkoutSet } from '../../domain/models'
import type { WeightUnit } from './units'
import { kgToDisplayWeight, displayWeightToKg } from './units'
import type { SetFieldErrors, SetFieldInput } from './validation'
import styles from './SetRow.module.css'

interface NumberFieldProps {
  id: string
  label: string
  value: number | undefined
  error?: string
  min?: number
  max?: number
  inputMode?: 'decimal' | 'numeric'
  onCommit: (value: number | undefined) => void
}

function NumberField({ id, label, value, error, min, max, inputMode = 'decimal', onCommit }: NumberFieldProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(value === undefined ? '' : String(value))
  }, [value])

  function commit(rawValue: string) {
    const trimmed = rawValue.trim()
    onCommit(trimmed === '' ? undefined : Number(trimmed))
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
        onChange={(e) => setText(e.target.value)}
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
}

/** One-handed gym logging row. Extended set facts remain preserved in the model but out of the primary UI. */
export function SetRow({ set, index, unit, previous, onCommitField, onToggleComplete }: SetRowProps) {
  const baseId = useId()
  const [errors, setErrors] = useState<SetFieldErrors>({})
  const [saveError, setSaveError] = useState<string>()
  const pendingWrites = useRef(new Set<Promise<boolean>>())

  function trackWrite(write: Promise<boolean>) {
    pendingWrites.current.add(write)
    void write.finally(() => pendingWrites.current.delete(write))
  }

  function commitAndTrack(field: keyof SetFieldInput, value: number | undefined) {
    setSaveError(undefined)
    const write = onCommitField(field, value).then((fieldErrors) => {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }))
      return !fieldErrors[field]
    }).catch(() => {
      setSaveError('Could not save this set. Try again before completing it.')
      return false
    })
    trackWrite(write)
  }

  async function toggleComplete() {
    const writesSucceeded = await Promise.all([...pendingWrites.current])
    if (writesSucceeded.some((succeeded) => !succeeded) || saveError || Object.values(errors).some(Boolean)) return
    try {
      await onToggleComplete()
    } catch {
      setSaveError('Could not update this set. Please try again.')
    }
  }

  return (
    <li className={styles.row} data-completed={set.completed}>
      <span className={styles.setNumber} aria-label={`Set ${index + 1}`}>{index + 1}</span>
      <span className={styles.previous}>{previous}</span>
      <div className={styles.weightField}>
        <NumberField
          id={`${baseId}-load`}
          label={`Load (${unit})`}
          value={set.loadKg === undefined ? undefined : kgToDisplayWeight(set.loadKg, unit)}
          error={errors.loadKg}
          min={0}
          onCommit={(value) => commitAndTrack('loadKg', value === undefined ? undefined : displayWeightToKg(value, unit))}
        />
      </div>
      <div className={styles.repsField}>
        <NumberField id={`${baseId}-reps`} label="Reps" value={set.reps} error={errors.reps} min={0} inputMode="numeric" onCommit={(value) => commitAndTrack('reps', value)} />
      </div>
      <button type="button" className={styles.completeButton} aria-label={set.completed ? 'Completed' : 'Mark complete'} aria-pressed={set.completed} onClick={() => void toggleComplete()}>{set.completed ? '✓' : '○'}</button>
      {saveError && <p className={styles.fieldError} role="alert">{saveError}</p>}
    </li>
  )
}
