import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useI18n } from '../../i18n/I18nContext'
import { equipmentLabel, movementPatternLabel } from '../../i18n/enumLabels'
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
  const { t } = useI18n()
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
          <h2 id="exercise-picker-title">{t('exercisePicker.title')}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('exercisePicker.closeAriaLabel')}>
            ×
          </button>
        </div>

        {catalog.status === 'loading' && (
          <p role="status" aria-live="polite" className={styles.status}>
            {t('exercisePicker.loading')}
          </p>
        )}
        {catalog.status === 'blocked-error' && (
          <p role="alert" className={styles.statusError}>
            {t('exercisePicker.loadError', { message: catalog.message })}
          </p>
        )}

        {catalog.status === 'ready' && (
          <>
            <div className={styles.searchField}>
              <label htmlFor={searchId}>{t('exercisePicker.searchLabel')}</label>
              <input id={searchId} ref={searchInputRef} type="search" placeholder={t('exercisePicker.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {results.length === 0 ? (
              <p className={styles.status}>{t('exercisePicker.noResults', { query })}</p>
            ) : (
              <ul className={styles.list}>
                {results.map((exercise) => (
                  <li key={exercise.id}>
                    <button type="button" className={styles.item} onClick={() => onPick(exercise)}>
                      <span className={styles.itemName}>{exercise.name}</span>
                      <span className={styles.itemMeta}>
                        {equipmentLabel(t, exercise.equipment[0] ?? 'bodyweight')} · {movementPatternLabel(t, exercise.movementPattern)}
                      </span>
                      {existingExerciseIds.has(exercise.id) && <span className={styles.itemBadge}>{t('exercisePicker.alreadyInWorkout')}</span>}
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
