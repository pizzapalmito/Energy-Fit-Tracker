import { useEffect, useId, useState } from 'react'
import type { SetType, WorkoutSet } from '../../domain/models'
import type { WeightUnit } from './units'
import { kgToDisplayWeight, displayWeightToKg } from './units'
import type { SetFieldErrors, SetFieldInput } from './validation'
import styles from './SetRow.module.css'

const SET_TYPES: SetType[] = ['warmup', 'working', 'backoff', 'dropset', 'failure']

function titleCase(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1)
}

interface NumberFieldProps {
  id: string
  label: string
  value: number | undefined
  error?: string
  min?: number
  max?: number
  onCommit: (value: number | undefined) => void
}

function NumberField({ id, label, value, error, min, max, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value))

  useEffect(() => {
    setText(value === undefined ? '' : String(value))
  }, [value])

  function commit() {
    const trimmed = text.trim()
    onCommit(trimmed === '' ? undefined : Number(trimmed))
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="any"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
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
  onCommitField: (field: keyof SetFieldInput, value: number | undefined) => SetFieldErrors
  onChangeType: (type: SetType) => void
  onToggleComplete: () => void
  onRemove: () => void
}

/** One editable set: type, load/reps/duration/distance/RIR/RPE, complete toggle, and remove. */
export function SetRow({ set, index, unit, onCommitField, onChangeType, onToggleComplete, onRemove }: SetRowProps) {
  const baseId = useId()
  const [errors, setErrors] = useState<SetFieldErrors>({})

  function commitAndTrack(field: keyof SetFieldInput, value: number | undefined) {
    const fieldErrors = onCommitField(field, value)
    setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }))
  }

  return (
    <li className={styles.row} data-completed={set.completed}>
      <div className={styles.topLine}>
        <span className={styles.setLabel}>Set {index + 1}</span>
        <select className={styles.typeSelect} aria-label={`Set ${index + 1} type`} value={set.type} onChange={(e) => onChangeType(e.target.value as SetType)}>
          {SET_TYPES.map((type) => (
            <option key={type} value={type}>
              {titleCase(type)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.fields}>
        <NumberField
          id={`${baseId}-load`}
          label={`Load (${unit})`}
          value={set.loadKg === undefined ? undefined : kgToDisplayWeight(set.loadKg, unit)}
          error={errors.loadKg}
          min={0}
          onCommit={(value) => commitAndTrack('loadKg', value === undefined ? undefined : displayWeightToKg(value, unit))}
        />
        <NumberField id={`${baseId}-reps`} label="Reps" value={set.reps} error={errors.reps} min={0} onCommit={(value) => commitAndTrack('reps', value)} />
        <NumberField
          id={`${baseId}-duration`}
          label="Duration (s)"
          value={set.durationSeconds}
          error={errors.durationSeconds}
          min={0}
          onCommit={(value) => commitAndTrack('durationSeconds', value)}
        />
        <NumberField
          id={`${baseId}-distance`}
          label="Distance (m)"
          value={set.distanceMeters}
          error={errors.distanceMeters}
          min={0}
          onCommit={(value) => commitAndTrack('distanceMeters', value)}
        />
        <NumberField id={`${baseId}-rir`} label="RIR" value={set.rir} error={errors.rir} min={0} max={10} onCommit={(value) => commitAndTrack('rir', value)} />
        <NumberField id={`${baseId}-rpe`} label="RPE" value={set.rpe} error={errors.rpe} min={1} max={10} onCommit={(value) => commitAndTrack('rpe', value)} />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.completeButton} aria-pressed={set.completed} onClick={onToggleComplete}>
          {set.completed ? 'Completed' : 'Mark complete'}
        </button>
        <button type="button" className={styles.removeButton} onClick={onRemove} aria-label={`Remove set ${index + 1}`}>
          ×
        </button>
      </div>
    </li>
  )
}
