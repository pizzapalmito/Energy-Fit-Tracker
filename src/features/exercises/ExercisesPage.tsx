import { useId, useMemo, useState } from 'react'
import type { Exercise } from '../../domain/models'
import type { Muscle } from '../../data/types'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useExerciseCatalog } from './useExerciseCatalog'
import { DEFAULT_FILTERS, collectFilterOptions, filterExercises, hasActiveFilters, type ExerciseFilters } from './filterExercises'
import { ExerciseDetail } from './ExerciseDetail'
import styles from './ExercisesPage.module.css'

function titleCase(value: string): string {
  return value.length === 0 ? value : value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ExercisesPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const catalog = useExerciseCatalog(db)
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
  const results = useMemo(() => filterExercises(exercises, filters), [exercises, filters])
  const selectedExercise = useMemo(() => exercises.find((e) => e.id === selectedExerciseId), [exercises, selectedExerciseId])
  const musclesById = useMemo(() => new Map(muscles.map((m) => [m.id, m])), [muscles])

  function update<K extends keyof ExerciseFilters>(key: K, value: ExerciseFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Repwise</p>
      <h1>Exercises</h1>

      {catalog.status === 'loading' && (
        <p role="status" aria-live="polite" className={styles.status}>
          Loading exercise library…
        </p>
      )}

      {catalog.status === 'blocked-error' && (
        <p role="alert" className={styles.statusError}>
          Couldn't load the exercise library ({catalog.message}). Try again once you're back online.
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
              <label htmlFor={searchId}>Search</label>
              <input
                id={searchId}
                type="search"
                placeholder="Name, alias, or instruction…"
                value={filters.query}
                onChange={(e) => update('query', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor={muscleId}>Muscle</label>
              <select id={muscleId} value={filters.muscleId} onChange={(e) => update('muscleId', e.target.value)}>
                <option value="all">All muscles</option>
                {muscles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor={equipmentId}>Equipment</label>
              <select id={equipmentId} value={filters.equipment} onChange={(e) => update('equipment', e.target.value)}>
                <option value="all">All equipment</option>
                {filterOptions.equipment.map((e) => (
                  <option key={e} value={e}>
                    {titleCase(e)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor={difficultyId}>Difficulty</label>
              <select id={difficultyId} value={filters.difficulty} onChange={(e) => update('difficulty', e.target.value as ExerciseFilters['difficulty'])}>
                <option value="all">All difficulties</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor={movementId}>Movement</label>
              <select id={movementId} value={filters.movementPattern} onChange={(e) => update('movementPattern', e.target.value)}>
                <option value="all">All movements</option>
                {filterOptions.movementPatterns.map((m) => (
                  <option key={m} value={m}>
                    {titleCase(m)}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters(filters) && (
              <button type="button" className={styles.clearButton} onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </button>
            )}
          </div>

          <p role="status" aria-live="polite" className={styles.resultCount}>
            {results.length} of {exercises.length} exercises
          </p>

          {results.length === 0 ? (
            <p className={styles.status}>No exercises match your filters.</p>
          ) : (
            <ul className={styles.list}>
              {results.map((exercise) => (
                <li key={exercise.id}>
                  <button type="button" className={styles.card} onClick={() => setSelectedExerciseId(exercise.id)}>
                    <span className={styles.cardName}>{exercise.name}</span>
                    <span className={styles.cardMeta}>
                      {primaryMuscleNames(exercise, musclesById)} · {titleCase(exercise.equipment[0] ?? 'bodyweight')} · {titleCase(exercise.difficulty)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedExercise && <ExerciseDetail exercise={selectedExercise} muscles={musclesById} onClose={() => setSelectedExerciseId(undefined)} />}
        </>
      )}
    </section>
  )
}

function primaryMuscleNames(exercise: Exercise, musclesById: Map<string, Muscle>): string {
  const primary = exercise.muscles.filter((m) => m.weight >= 1).map((m) => musclesById.get(m.muscleId)?.name ?? m.muscleId)
  if (primary.length > 0) return primary.join(', ')
  const first = exercise.muscles[0]
  return first ? (musclesById.get(first.muscleId)?.name ?? first.muscleId) : 'Unspecified'
}
