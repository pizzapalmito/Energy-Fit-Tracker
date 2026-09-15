import { useNavigate, useParams } from 'react-router-dom'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useI18n } from '../../i18n/I18nContext'
import { formatDuration } from './useElapsedSeconds'
import { kgToDisplayWeight } from './units'
import { useUnit } from './useUnit'
import { useWorkoutSummary } from './useWorkoutSummary'
import type { ExerciseSummaryStatus } from './workoutSummary'
import styles from './WorkoutSummaryPage.module.css'

function statusLabelKey(status: ExerciseSummaryStatus): 'workoutSummary.statusComplete' | 'workoutSummary.statusPartial' | 'workoutSummary.statusSkipped' {
  if (status === 'complete') return 'workoutSummary.statusComplete'
  if (status === 'partial') return 'workoutSummary.statusPartial'
  return 'workoutSummary.statusSkipped'
}

export function WorkoutSummaryPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const { t, formatNumber, formatDate } = useI18n()
  const unit = useUnit(db)
  const summary = useWorkoutSummary(db, workoutId ?? '')

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{t('workoutSummary.eyebrow')}</p>
      <h1>{t('workoutSummary.title')}</h1>

      {summary.status === 'loading' && (
        <p role="status" aria-live="polite" className={styles.status}>{t('workoutSummary.loading')}</p>
      )}

      {summary.status === 'error' && (
        <p role="alert" className={styles.statusError}>{t('workoutSummary.loadError', { message: summary.message })}</p>
      )}

      {summary.status === 'ready' && !summary.value && (
        <p role="alert" className={styles.statusError}>{t('workoutSummary.missing')}</p>
      )}

      {summary.status === 'ready' && summary.value && (
        <>
          <div className={styles.completeCard}>
            <div>
              <p className={styles.completeEyebrow}>{t('workoutSummary.sessionComplete')}</p>
              <h2>{summary.value.workout.name}</h2>
              <p className={styles.completeDate}>{formatDate(summary.value.workout.date)}</p>
            </div>
            <div className={styles.stats}>
              <div><strong>{summary.value.durationSeconds === undefined ? '—' : formatDuration(summary.value.durationSeconds)}</strong><span>{t('workoutSummary.durationLabel')}</span></div>
              <div><strong>{formatNumber(summary.value.completedSetCount)}</strong><span>{t('workoutSummary.setsLabel')}</span></div>
              <div><strong>{formatNumber(kgToDisplayWeight(summary.value.volumeKg, unit))}</strong><span>{t('workoutSummary.volumeLabel', { unit })}</span></div>
            </div>
          </div>

          <div className={styles.logged}>
            <p className={styles.loggedTitle}>{t('workoutSummary.loggedTitle')}</p>
            <ul className={styles.loggedList}>
              {summary.value.exercises.map((exercise) => (
                <li key={exercise.workoutExerciseId}>
                  <div>
                    <strong>{exercise.name}</strong>
                    <span>
                      {t('workoutSummary.setsOfTotal', { completed: exercise.completedSetCount, total: exercise.totalSetCount })}
                      {exercise.bestLoadKg !== undefined && ` · ${t('workoutSummary.bestLoad', { load: formatNumber(kgToDisplayWeight(exercise.bestLoadKg, unit)), unit })}`}
                    </span>
                  </div>
                  <span className={styles[`tag${exercise.status[0]!.toUpperCase()}${exercise.status.slice(1)}`]}>{t(statusLabelKey(exercise.status))}</span>
                </li>
              ))}
            </ul>
          </div>


        </>
      )}
          <button type="button" className={styles.doneButton} onClick={() => void navigate('/today')}>{t('workoutSummary.done')}</button>
    </section>
  )
}
