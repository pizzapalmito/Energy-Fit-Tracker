import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useExerciseCatalog } from '../exercises/useExerciseCatalog'
import { DEFAULT_FILTERS, filterExercises } from '../exercises/filterExercises'
import styles from './ExercisePicker.module.css'

export interface ExercisePickerProps {
  db: RepwiseDatabase
  existingExerciseIds: Set<string>
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

/** Searchable, keyboard-and-screen-reader accessible modal for adding an exercise from the offline catalog. */
export function ExercisePicker({ db, existingExerciseIds, onPick, onClose }: ExercisePickerProps) {
  const catalog = useExerciseCatalog(db)
  const [query, setQuery] = useState('')
  const searchId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const exercises = catalog.status === 'ready' ? catalog.exercises : []
  const results = useMemo(() => filterExercises(exercises, { ...DEFAULT_FILTERS, query }), [exercises, query])

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="exercise-picker-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="exercise-picker-title">Add exercise</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close exercise picker">
            ×
          </button>
        </div>

        {catalog.status === 'loading' && (
          <p role="status" aria-live="polite" className={styles.status}>
            Loading exercise library…
          </p>
        )}
        {catalog.status === 'blocked-error' && (
          <p role="alert" className={styles.statusError}>
            Couldn't load the exercise library ({catalog.message}).
          </p>
        )}

        {catalog.status === 'ready' && (
          <>
            <div className={styles.searchField}>
              <label htmlFor={searchId}>Search exercises</label>
              <input id={searchId} ref={searchInputRef} type="search" placeholder="Name or alias…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {results.length === 0 ? (
              <p className={styles.status}>No exercises match "{query}".</p>
            ) : (
              <ul className={styles.list}>
                {results.map((exercise) => (
                  <li key={exercise.id}>
                    <button type="button" className={styles.item} onClick={() => onPick(exercise)}>
                      <span className={styles.itemName}>{exercise.name}</span>
                      <span className={styles.itemMeta}>
                        {exercise.equipment[0] ?? 'bodyweight'} · {exercise.movementPattern}
                      </span>
                      {existingExerciseIds.has(exercise.id) && <span className={styles.itemBadge}>Already in workout</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
