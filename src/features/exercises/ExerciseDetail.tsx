import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../../domain/models'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { DexieWorkoutExerciseRepository } from '../../data/repositories/workoutExerciseRepository'
import { DexieWorkoutRepository } from '../../data/repositories/workoutRepository'
import { CatalogImage } from '../../catalog/CatalogImage'
import { PRIMARY_WEIGHT_THRESHOLD } from '../../engines/shared/muscleContribution'
import { useI18n } from '../../i18n/I18nContext'
import { difficultyLabel, equipmentLabel, movementPatternLabel, muscleLabel } from '../../i18n/enumLabels'
import { usePreviousPerformance } from '../workout/usePreviousPerformance'
import { useUnit } from '../workout/useUnit'
import { formatWeight } from '../workout/units'
import { ConfirmDialog } from '../workout/ConfirmDialog'
import { addCatalogExerciseToActiveWorkout, DuplicateCatalogExerciseError, NoActiveWorkoutError, StaleActiveWorkoutError } from './catalogWorkoutActions'
import styles from './ExerciseDetail.module.css'

interface ActiveWorkoutSummary {
  workoutId: string
  exerciseIds: Set<string>
}

async function loadActiveWorkoutSummary(db: RepwiseDatabase): Promise<ActiveWorkoutSummary | undefined> {
  const workout = await new DexieWorkoutRepository(db).getActive()
  if (!workout) return undefined
  const exercises = await new DexieWorkoutExerciseRepository(db).listByWorkout(workout.id)
  return { workoutId: workout.id, exerciseIds: new Set(exercises.map((entry) => entry.exerciseId)) }
}

export function ExerciseDetail({ db = appDb, exercise, onClose }: { db?: RepwiseDatabase; exercise: Exercise; onClose: () => void }) {
  const { t, formatDate } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const addingRef = useRef(false)
  const [duplicateWorkoutId, setDuplicateWorkoutId] = useState<string>()
  const [addedTarget, setAddedTarget] = useState<{ exerciseId: string; workoutId: string }>()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [frame, setFrame] = useState<'start' | 'end'>('start')
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false)
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle')
  const [addErrorMessage, setAddErrorMessage] = useState<string>()

  const active = useLiveQuery(() => loadActiveWorkoutSummary(db), [db])
  const unit = useUnit(db)
  const previous = usePreviousPerformance(db, exercise.id, '')
  const previousWorkingSets = previous.status === 'ready' && previous.value
    ? previous.value.sets.filter((set) => set.type === 'working' && set.completed).sort((a, b) => a.setNumber - b.setNumber)
    : []

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus() }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !duplicateConfirmOpen) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, duplicateConfirmOpen])

  useEffect(() => {
    setAddedTarget(undefined)
    setDuplicateWorkoutId(undefined)
    setFrame('start')
    setAddState('idle')
    setAddErrorMessage(undefined)
    setDuplicateConfirmOpen(false)
  }, [exercise.id])

  async function performAdd(allowDuplicate: boolean, expectedWorkoutId: string) {
    if (addingRef.current) return
    addingRef.current = true
    setAddState('adding')
    setAddErrorMessage(undefined)
    try {
      await addCatalogExerciseToActiveWorkout(db, expectedWorkoutId, exercise, { allowDuplicate })
      setAddedTarget({ exerciseId: exercise.id, workoutId: expectedWorkoutId })
      setAddState('added')
    } catch (error) {
      setAddState('error')
      setAddErrorMessage(
        error instanceof DuplicateCatalogExerciseError ? t('exerciseDetail.addDuplicateError')
          : error instanceof NoActiveWorkoutError || error instanceof StaleActiveWorkoutError ? t('exerciseDetail.addStaleWorkoutError')
            : t('exerciseDetail.addError'),
      )
    } finally { addingRef.current = false }
  }

  function handleAddClick() {
    if (active.status !== 'ready' || !active.value) return
    if (active.value.exerciseIds.has(exercise.id)) {
      setDuplicateWorkoutId(active.value.workoutId)
      setDuplicateConfirmOpen(true)
      return
    }
    void performAdd(false, active.value.workoutId)
  }

  const addedForCurrent = active.status === 'ready' && active.value?.workoutId === addedTarget?.workoutId && exercise.id === addedTarget?.exerciseId

  const startMedia = exercise.media[0]
  const endMedia = exercise.media[1]
  const hasBothFrames = Boolean(startMedia && endMedia)
  const activeMedia = frame === 'end' ? (endMedia ?? startMedia) : startMedia

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div ref={dialogRef} onKeyDown={(event) => {
        if (event.key !== 'Tab' || duplicateConfirmOpen) return
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')
        if (!controls?.length) return
        const first = controls[0]; const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="exercise-detail-title">{exercise.name}</h2>
          <button type="button" ref={closeButtonRef} className={styles.closeButton} onClick={onClose} aria-label={t('exerciseDetail.closeAriaLabel')}>
            ×
          </button>
        </div>

        <figure className={styles.media}>
            <CatalogImage relativePath={activeMedia} alt={`${exercise.name} — ${frame === 'end' ? t('exerciseDetail.endingPosition') : t('exerciseDetail.startingPosition')}`} fallbackClassName={styles.mediaFallback} />
            {hasBothFrames && (
              <figcaption className={styles.mediaToggle} role="group" aria-label={t('exerciseDetail.frameGroupAriaLabel')}>
                <button type="button" aria-pressed={frame === 'start'} onClick={() => setFrame('start')}>
                  {t('exerciseDetail.start')}
                </button>
                <button type="button" aria-pressed={frame === 'end'} onClick={() => setFrame('end')}>
                  {t('exerciseDetail.end')}
                </button>
              </figcaption>
            )}
          </figure>

        <div className={styles.addSection}>
          {active.status === 'loading' && <p role="status" className={styles.addStatus}>{t('exerciseDetail.addChecking')}</p>}
          {active.status === 'error' && <p role="alert" className={styles.addStatus}>{t('exerciseDetail.addError')}</p>}
          {active.status === 'ready' && !active.value && <p className={styles.addStatus}>{t('exerciseDetail.noActiveWorkout')} <a className={styles.openWorkoutButton} href="#/today" onClick={onClose}>{t('workout.startFromToday')}</a></p>}
          {active.status === 'ready' && active.value && !addedForCurrent && (
            <button type="button" className={styles.addButton} onClick={handleAddClick} disabled={addState === 'adding'}>
              {addState === 'adding' ? t('exerciseDetail.adding') : t('exerciseDetail.addToWorkout')}
            </button>
          )}
          {addedForCurrent && (
            <div className={styles.addedRow}>
              <span className={styles.addedBadge}>{t('exerciseDetail.added')}</span>
              <a className={styles.openWorkoutButton} href="#/workout" onClick={onClose}>{t('exerciseDetail.openWorkout')}</a>
            </div>
          )}
          {addState === 'error' && addErrorMessage && <p role="alert" className={styles.addStatus}>{addErrorMessage}</p>}
        </div>

        <dl className={styles.factList}>
          <div>
            <dt>{t('exerciseDetail.difficulty')}</dt>
            <dd>{difficultyLabel(t, exercise.difficulty)}</dd>
          </div>
          <div>
            <dt>{t('exerciseDetail.movement')}</dt>
            <dd>{movementPatternLabel(t, exercise.movementPattern)}</dd>
          </div>
          <div>
            <dt>{t('exerciseDetail.equipment')}</dt>
            <dd>{exercise.equipment.map((item) => equipmentLabel(t, item)).join(', ')}</dd>
          </div>
          <div>
            <dt>{t('exerciseDetail.defaultRest')}</dt>
            <dd>{t('exerciseDetail.seconds', { count: exercise.defaultRestSeconds })}</dd>
          </div>
        </dl>

        <h3>{t('exerciseDetail.recentPerformanceTitle')}</h3>
        {previous.status === 'loading' && <p role="status" className={styles.recentStatus}>{t('exerciseDetail.recentLoading')}</p>}
        {previous.status === 'error' && <p role="alert" className={styles.recentStatus}>{t('exerciseDetail.recentLoadError', { message: previous.message })}</p>}
        {previous.status === 'ready' && !previous.value && <p className={styles.recentStatus}>{t('exerciseDetail.recentEmpty')}</p>}
        {previous.status === 'ready' && previous.value && (
          <p className={styles.recentSummary}>
            {previousWorkingSets.length === 0
              ? t('exerciseDetail.recentNoWorkingSets')
              : t('exerciseDetail.recentSummary', {
                  date: formatDate(previous.value.workout.date),
                  sets: previousWorkingSets.map((set) => t('exerciseDetail.setSummaryItem', { load: formatWeight(set.loadKg, unit), reps: set.reps ?? '—' })).join(', '),
                })}
          </p>
        )}

        <h3>{t('exerciseDetail.muscles')}</h3>
        <ul className={styles.muscleList}>
          {exercise.muscles.map((m) => (
            <li key={m.muscleId}>
              {muscleLabel(t, m.muscleId)}
              {' '}{m.weight >= PRIMARY_WEIGHT_THRESHOLD ? t('exerciseDetail.primary') : t('exerciseDetail.secondary')}
            </li>
          ))}
        </ul>

        {exercise.instructions.length > 0 && (
          <>
            <h3>{t('exerciseDetail.instructions')}</h3>
            <ol className={styles.instructions}>
              {exercise.instructions.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </>
        )}

        {duplicateConfirmOpen && (
          <ConfirmDialog
            title={t('exerciseDetail.addDuplicateTitle')}
            description={t('exerciseDetail.addDuplicateDescription', { name: exercise.name })}
            confirmLabel={t('exerciseDetail.addDuplicateConfirm')}
            onConfirm={() => { setDuplicateConfirmOpen(false); if (duplicateWorkoutId) void performAdd(true, duplicateWorkoutId) }}
            onCancel={() => setDuplicateConfirmOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
