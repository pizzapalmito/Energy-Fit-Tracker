import { CatalogImage } from '../../catalog/CatalogImage'
import { useId, useMemo, useState } from 'react'
import type { Exercise } from '../../domain/models'
import type { Muscle } from '../../data/types'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useI18n } from '../../i18n/I18nContext'
import { equipmentLabel, difficultyLabel, movementPatternLabel, muscleLabel, type Translator } from '../../i18n/enumLabels'
import { useExerciseCatalog } from './useExerciseCatalog'
import { DEFAULT_FILTERS, collectFilterOptions, filterExercises, hasActiveFilters, type ExerciseFilters } from './filterExercises'
import { ExerciseDetail } from './ExerciseDetail'
import styles from './ExercisesPage.module.css'

export function ExercisesPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const { t } = useI18n()
  const catalog = useExerciseCatalog(db)
  const [descending, setDescending] = useState(false)
  const [filters, setFilters] = useState<ExerciseFilters>(DEFAULT_FILTERS)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | undefined>()

  const searchId = useId()
  const muscleId = useId()
  const equipmentId = useId()
  const difficultyId = useId()
  const movementId = useId()

  const exercises = catalog.status === 'ready' ? catalog.exercises : []
  const muscles: Muscle[] = catalog.status === 'ready' ? catalog.muscles : []
  const filterOptions = useMemo(() => collectFilterOptions(exercises), [exercises])
  const results = useMemo(() => { const matches = filterExercises(exercises, filters); return descending ? matches.reverse() : matches }, [exercises, filters, descending])
  const selectedExercise = useMemo(() => exercises.find((e) => e.id === selectedExerciseId), [exercises, selectedExerciseId])

  function update<K extends keyof ExerciseFilters>(key: K, value: ExerciseFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{t('exercises.eyebrow')}</p>
      <h1>{t('exercises.title')}</h1>

      {catalog.status === 'loading' && (
        <p role="status" aria-live="polite" className={styles.status}>
          {t('exercises.loading')}
        </p>
      )}

      {catalog.status === 'blocked-error' && (
        <p role="alert" className={styles.statusError}>
          {t('exercises.loadError', { message: catalog.message })}
        </p>
      )}

      {catalog.status === 'ready' && (
        <>
          {catalog.catalogNotice && (
            <p role="status" aria-live="polite" className={styles.notice}>
              {catalog.catalogNotice}
            </p>
          )}

          <div className={styles.controls}>
            <div className={styles.field}>
              <label htmlFor={searchId}>{t('exercises.searchLabel')}</label>
              <input
                id={searchId}
                type="search"
                placeholder={t('exercises.searchPlaceholder')}
                value={filters.query}
                onChange={(e) => update('query', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor={muscleId}>{t('exercises.muscleLabel')}</label>
              <select id={muscleId} value={filters.muscleId} onChange={(e) => update('muscleId', e.target.value)}>
                <option value="all">{t('exercises.allMuscles')}</option>
                {muscles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {muscleLabel(t, m.id)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor={equipmentId}>{t('exercises.equipmentLabel')}</label>
              <select id={equipmentId} value={filters.equipment} onChange={(e) => update('equipment', e.target.value)}>
                <option value="all">{t('exercises.allEquipment')}</option>
                {filterOptions.equipment.map((e) => (
                  <option key={e} value={e}>
                    {equipmentLabel(t, e)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor={difficultyId}>{t('exercises.difficultyLabel')}</label>
              <select id={difficultyId} value={filters.difficulty} onChange={(e) => update('difficulty', e.target.value as ExerciseFilters['difficulty'])}>
                <option value="all">{t('exercises.allDifficulties')}</option>
                <option value="beginner">{t('difficulty.beginner')}</option>
                <option value="intermediate">{t('difficulty.intermediate')}</option>
                <option value="advanced">{t('difficulty.advanced')}</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor={movementId}>{t('exercises.movementLabel')}</label>
              <select id={movementId} value={filters.movementPattern} onChange={(e) => update('movementPattern', e.target.value)}>
                <option value="all">{t('exercises.allMovements')}</option>
                {filterOptions.movementPatterns.map((m) => (
                  <option key={m} value={m}>
                    {movementPatternLabel(t, m)}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters(filters) && (
              <button type="button" className={styles.clearButton} onClick={() => setFilters(DEFAULT_FILTERS)}>
                {t('exercises.clearFilters')}
              </button>
            )}
          </div>

          <div className={styles.resultsBar}>
          <p role="status" aria-live="polite" className={styles.resultCount}>
            {t('exercises.resultCount', { shown: results.length, total: exercises.length })}
          </p>
          <button type="button" className={styles.clearButton} aria-pressed={descending} onClick={() => setDescending((value) => !value)}>{descending ? 'Z–A ↓' : 'A–Z ↑'}</button>
          </div>

          {results.length === 0 ? (
            <p className={styles.status}>{t('exercises.noResults')}</p>
          ) : (
            <ul className={styles.list}>
              {results.map((exercise) => (
                <li key={exercise.id}>
                  <button type="button" className={styles.card} onClick={() => setSelectedExerciseId(exercise.id)}>
                    <CatalogImage loading="lazy" relativePath={exercise.media[0]} alt="" fallbackClassName={styles.cardImageFallback} />
                    <span className={styles.cardContent}><span className={styles.cardName}>{exercise.name}</span>
                    <span className={styles.cardMeta}>
                      {primaryMuscleNames(t, exercise)} · {equipmentLabel(t, exercise.equipment[0] ?? 'bodyweight')} · {difficultyLabel(t, exercise.difficulty)}
                    </span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedExercise && <ExerciseDetail db={db} exercise={selectedExercise} onClose={() => setSelectedExerciseId(undefined)} />}
        </>
      )}
    </section>
  )
}

function primaryMuscleNames(t: Translator, exercise: Exercise): string {
  const primary = exercise.muscles.filter((m) => m.weight >= 1).map((m) => muscleLabel(t, m.muscleId))
  if (primary.length > 0) return primary.join(', ')
  const first = exercise.muscles[0]
  return first ? muscleLabel(t, first.muscleId) : t('exercises.unspecifiedMuscle')
}
