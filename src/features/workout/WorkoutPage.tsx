import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Exercise } from '../../domain/models'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
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

  const elapsedSeconds = useElapsedSeconds(workout?.startTime)

  useEffect(() => {
    if (workout) {
      setNameText(workout.name)
    }
  }, [workout?.id, workout?.name])

  function commitName() {
    if (workout) void renameWorkout(db, workout, nameText)
  }

  function requestFinish() {
    if (!hasAnyCompletedSet(exercises)) {
      setFinishConfirmOpen(true)
      return
    }
    void doFinish()
  }

  async function doFinish() {
    if (!workout) return
    await finishWorkout(db, workout)
    timer.skip()
    void navigate('/today')
  }

  async function doDiscard() {
    if (!workout) return
    await discardWorkout(db, workout)
    timer.skip()
    void navigate('/today')
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
      <p className={styles.eyebrow}>Repwise</p>
      <h1>Workout</h1>

      {data.status === 'loading' && (
        <p role="status" aria-live="polite" className={styles.status}>
          Loading your workout…
        </p>
      )}

      {data.status === 'error' && (
        <p role="alert" className={styles.statusError}>
          Couldn't load your workout ({data.message}).
        </p>
      )}

      {data.status === 'ready' && !workout && (
        <div className={styles.empty}>
          <p className={styles.status}>No active workout right now.</p>
          <Link className={styles.primaryLink} to="/today">
            Start one from Today
          </Link>
        </div>
      )}

      {data.status === 'ready' && workout && (
        <>
          <div className={styles.header}>
            <div className={styles.nameRow}>
              <input aria-label="Workout name" className={styles.nameInput} value={nameText} onChange={(e) => setNameText(e.target.value)} onBlur={commitName} />
              <span className={styles.workoutStats}>
                <span className={styles.elapsed}>{formatDuration(elapsedSeconds)}</span>
                <span>{completedSetCount} sets</span>
              </span>
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.finishButton} onClick={requestFinish}>
                Finish workout
              </button>
              <button type="button" className={styles.discardButton} onClick={() => setDiscardConfirmOpen(true)}>
                Discard
              </button>
            </div>
          </div>

          <RestTimerBar timer={timer} />

          {exercises.length === 0 ? (
            <p className={styles.status}>No exercises yet. Add one to start logging sets.</p>
          ) : (
            <ul className={styles.exerciseList}>
              {exercises.map(({ workoutExercise, sets }) => (
                <li key={workoutExercise.id}>
                  <WorkoutExerciseCard
                    db={db}
                    workoutExercise={workoutExercise}
                    sets={sets}
                    unit={unit}
                    onSetCompleted={(restSeconds, workoutExerciseId) => {
                      if (restSeconds > 0) timer.start(workoutExerciseId, restSeconds)
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          <button type="button" className={styles.addExerciseButton} onClick={() => setPickerOpen(true)}>
            + Add exercise
          </button>

          {pickerOpen && (
            <ExercisePicker db={db} existingExerciseIds={new Set(exercises.map((e) => e.workoutExercise.exerciseId))} onPick={handlePick} onClose={() => setPickerOpen(false)} />
          )}

          {duplicatePick && (
            <ConfirmDialog
              title="Already in this workout"
              description={`${duplicatePick.name} is already in this workout. Add another occurrence?`}
              confirmLabel="Add another"
              onConfirm={() => {
                void addExerciseToWorkout(db, workout.id, duplicatePick)
                setDuplicatePick(undefined)
              }}
              onCancel={() => setDuplicatePick(undefined)}
            />
          )}

          {finishConfirmOpen && (
            <ConfirmDialog
              title="Finish with no completed sets?"
              description="You haven't marked any sets complete. Finish anyway?"
              confirmLabel="Finish anyway"
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
              title="Discard this workout?"
              description="The workout will be kept in your history marked as discarded, but this cannot be resumed."
              confirmLabel="Discard"
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
