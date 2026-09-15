import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Exercise } from '../../domain/models'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useI18n } from '../../i18n/I18nContext'
import { useActiveWorkoutData } from './useActiveWorkoutData'
import { useRestTimer } from './useRestTimer'
import { useUnit } from './useUnit'
import { useElapsedSeconds, formatDuration } from './useElapsedSeconds'
import { addExerciseToWorkout, discardWorkout, finishWorkout, hasAnyCompletedSet, isDuplicateExercise, renameWorkout } from './workoutActions'
import { WorkoutExerciseCard } from './WorkoutExerciseCard'
import { RestTimerBar } from './RestTimerBar'
import { ExercisePicker } from './ExercisePicker'
import { ConfirmDialog } from './ConfirmDialog'
import styles from './WorkoutPage.module.css'

export function WorkoutPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const navigate = useNavigate()
  const { t, tn } = useI18n()
  const data = useActiveWorkoutData(db)
  const timer = useRestTimer(db)
  const unit = useUnit(db)

  const workout = data.status === 'ready' ? data.value.workout : undefined
  const exercises = data.status === 'ready' ? data.value.exercises : []
  const completedSetCount = exercises.reduce((count, entry) => count + entry.sets.filter((set) => set.completed).length, 0)

  const [nameText, setNameText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [duplicatePick, setDuplicatePick] = useState<Exercise | undefined>()
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [lifecycleError, setLifecycleError] = useState<string>()

  const elapsedSeconds = useElapsedSeconds(workout?.startTime)

  useEffect(() => {
    if (workout) {
      setNameText(workout.name)
    }
  }, [workout?.id, workout?.name])

  /** Exercise ids present the first time this workout's data was seen; anything added afterward is "new" and defaults to expanded. Resets when a different workout loads. */
  const initialExerciseIds = useRef<{ workoutId: string; ids: Set<string> } | undefined>(undefined)
  if (workout && initialExerciseIds.current?.workoutId !== workout.id) {
    initialExerciseIds.current = { workoutId: workout.id, ids: new Set(exercises.map((entry) => entry.workoutExercise.id)) }
  }

  function commitName() {
    if (workout) void renameWorkout(db, workout, nameText)
  }

  function requestFinish() {
    if (lifecycleBusy) return
    setLifecycleError(undefined)
    if (!hasAnyCompletedSet(exercises)) {
      setFinishConfirmOpen(true)
      return
    }
    void doFinish()
  }

  async function doFinish() {
    if (!workout || lifecycleBusy) return
    setLifecycleBusy(true)
    setLifecycleError(undefined)
    try {
      const completed = await finishWorkout(db, workout)
      timer.skip()
      void navigate(`/workout/summary/${completed.id}`)
    } catch {
      setLifecycleError(t('workout.finishError'))
      setLifecycleBusy(false)
    }
  }

  async function doDiscard() {
    if (!workout || lifecycleBusy) return
    setLifecycleBusy(true)
    setLifecycleError(undefined)
    try {
      await discardWorkout(db, workout)
      timer.skip()
      void navigate('/today')
    } catch {
      setLifecycleError(t('workout.discardError'))
      setLifecycleBusy(false)
    }
  }

  function handlePick(exercise: Exercise) {
    if (!workout) return
    if (isDuplicateExercise(exercises.map((e) => e.workoutExercise), exercise.id)) {
      setPickerOpen(false)
      setDuplicatePick(exercise)
      return
    }
    void addExerciseToWorkout(db, workout.id, exercise)
    setPickerOpen(false)
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{t('workout.eyebrow')}</p>
      <h1>{t('workout.title')}</h1>

      {data.status === 'loading' && (
        <p role="status" aria-live="polite" className={styles.status}>
          {t('workout.loading')}
        </p>
      )}

      {data.status === 'error' && (
        <p role="alert" className={styles.statusError}>
          {t('workout.loadError', { message: data.message })}
        </p>
      )}

      {data.status === 'ready' && !workout && (
        <div className={styles.empty}>
          <p className={styles.status}>{t('workout.noActiveWorkout')}</p>
          <Link className={styles.primaryLink} to="/today">
            {t('workout.startFromToday')}
          </Link>
        </div>
      )}

      {data.status === 'ready' && workout && (
        <>
          <div className={styles.header}>
            <div className={styles.nameRow}>
              <input aria-label={t('workout.workoutNameAriaLabel')} className={styles.nameInput} value={nameText} onChange={(e) => setNameText(e.target.value)} onBlur={commitName} />
              <span className={styles.workoutStats}>
                <span className={styles.elapsed}>{formatDuration(elapsedSeconds)}</span>
                <span>{tn('workout.setsCount', completedSetCount)}</span>
              </span>
            </div>

          </div>

          {lifecycleError && <p role="alert" className={styles.statusError}>{lifecycleError}</p>}

          <RestTimerBar timer={timer} />

          {exercises.length === 0 ? (
            <p className={styles.status}>{t('workout.noExercisesYet')}</p>
          ) : (
            <ul className={styles.exerciseList}>
              {exercises.map(({ workoutExercise, sets }, index) => (
                <li key={workoutExercise.id}>
                  <WorkoutExerciseCard
                    db={db}
                    workoutExercise={workoutExercise}
                    sets={sets}
                    unit={unit}
                    position={index + 1}
                    total={exercises.length}
                    defaultExpanded={index === 0 || !initialExerciseIds.current?.ids.has(workoutExercise.id)}
                    onSetCompleted={(restSeconds, workoutExerciseId) => {
                      if (restSeconds > 0) timer.start(workoutExerciseId, restSeconds)
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          <button type="button" className={styles.addExerciseButton} onClick={() => setPickerOpen(true)}>
            {t('workout.addExercise')}
          </button>

            <div className={styles.headerActions}>
              <button type="button" className={styles.finishButton} onClick={requestFinish} disabled={lifecycleBusy}>
                {t('workout.finishWorkout')}
              </button>
              <button type="button" className={styles.discardButton} onClick={() => setDiscardConfirmOpen(true)} disabled={lifecycleBusy}>
                {t('workout.discard')}
              </button>
            </div>

          {pickerOpen && (
            <ExercisePicker db={db} existingExerciseIds={new Set(exercises.map((e) => e.workoutExercise.exerciseId))} onPick={handlePick} onClose={() => setPickerOpen(false)} />
          )}

          {duplicatePick && (
            <ConfirmDialog
              title={t('workout.duplicateTitle')}
              description={t('workout.duplicateDescription', { name: duplicatePick.name })}
              confirmLabel={t('workout.duplicateConfirm')}
              onConfirm={() => {
                void addExerciseToWorkout(db, workout.id, duplicatePick)
                setDuplicatePick(undefined)
              }}
              onCancel={() => setDuplicatePick(undefined)}
            />
          )}

          {finishConfirmOpen && (
            <ConfirmDialog
              title={t('workout.finishConfirmTitle')}
              description={t('workout.finishConfirmDescription')}
              confirmLabel={t('workout.finishConfirmConfirm')}
              destructive
              onConfirm={() => {
                setFinishConfirmOpen(false)
                void doFinish()
              }}
              onCancel={() => setFinishConfirmOpen(false)}
            />
          )}

          {discardConfirmOpen && (
            <ConfirmDialog
              title={t('workout.discardConfirmTitle')}
              description={t('workout.discardConfirmDescription')}
              confirmLabel={t('workout.discardConfirmConfirm')}
              destructive
              onConfirm={() => {
                setDiscardConfirmOpen(false)
                void doDiscard()
              }}
              onCancel={() => setDiscardConfirmOpen(false)}
            />
          )}
        </>
      )}
    </section>
  )
}
