import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { DeterministicRecoveryEngine } from '../../engines/recovery/recoveryEngine'
import { useI18n } from '../../i18n/I18nContext'
import { muscleLabel, readinessLabel, subjectiveStateLabel } from '../../i18n/enumLabels'
import { MuscleMap } from './MuscleMap'
import { readinessStatus } from './readinessPresentation'
import { buildExerciseProgress, trainingConsistency, workoutDurationMinutes } from './progressMetrics'
import styles from './ProgressPage.module.css'

async function readProgress(db: RepwiseDatabase) {
  const workouts = await db.workouts.toArray()
  const exercises = await db.workoutExercises.toArray()
  const sets = await db.sets.toArray()
  const feedback = await db.recoveryFeedback.toArray()
  const completed = workouts.filter((workout) => workout.status === 'completed').sort((a, b) => b.startTime.localeCompare(a.startTime))
  const entries = completed.map((workout) => {
    const workoutExercises = exercises.filter((exercise) => exercise.workoutId === workout.id)
    const ids = new Set(workoutExercises.map((exercise) => exercise.id))
    const workoutSets = sets.filter((set) => ids.has(set.workoutExerciseId) && set.completed)
    const volumeKg = workoutSets.reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0)
    return { workout, exercises: workoutExercises, sets: workoutSets, volumeKg }
  })
  const recovery = new DeterministicRecoveryEngine().calculate(new Date().toISOString(), workouts, exercises, sets, feedback)
  return { entries, recovery, exercises, sets }
}

function localDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function ProgressPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const { t, tn, formatNumber, formatDate } = useI18n()
  const data = useLiveQuery(() => readProgress(db), [db])
  const [selectedMuscle, setSelectedMuscle] = useState<string>()
  const selectedRecovery = data.status === 'ready' ? data.value.recovery.find((entry) => entry.muscleId === selectedMuscle) : undefined
  const chartData = useMemo(() => {
    if (data.status !== 'ready') return []
    return data.value.entries.slice(0, 10).reverse().map((entry) => ({ date: entry.workout.date, volume: Math.round(entry.volumeKg) }))
  }, [data])
  const chartDateLabel = (value: string) => formatDate(value, { month: 'short', day: 'numeric' })
  const exerciseProgress = useMemo(() => data.status === 'ready' ? buildExerciseProgress(data.value.exercises, data.value.sets) : [], [data])

  async function saveFeedback(subjectiveState: 'very_sore' | 'sore' | 'normal' | 'fresh') {
    if (!selectedMuscle) return
    const date = localDate()
    await db.recoveryFeedback.put({ id: `${selectedMuscle}-${date}`, muscleId: selectedMuscle, date, subjectiveState })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{t('progress.eyebrow')}</p>
      <h1>{t('progress.title')}</h1>
      {data.status === 'loading' && <p role="status">{t('progress.loading')}</p>}
      {data.status === 'error' && <p role="alert">{t('progress.loadError', { message: data.message })}</p>}
      {data.status === 'ready' && (
        <>
          <div className={styles.metrics}>
            <article><strong>{formatNumber(data.value.entries.length)}</strong><span>{t('progress.workoutsMetric')}</span></article>
            <article><strong>{formatNumber(data.value.sets.filter((set) => set.completed && set.type === 'working').length)}</strong><span>{t('progress.workingSetsMetric')}</span></article>
            <article><strong>{formatNumber(Math.round(data.value.entries.reduce((sum, entry) => sum + entry.volumeKg, 0)))}</strong><span>{t('progress.volumeMetric')}</span></article>
            <article><strong>{trainingConsistency(data.value.entries.map((entry) => entry.workout))}%</strong><span>{t('progress.consistencyMetric')}</span></article>
            <article><strong>{data.value.entries.length === 0 ? 0 : Math.round(data.value.entries.reduce((sum, entry) => sum + workoutDurationMinutes(entry.workout), 0) / data.value.entries.length)}</strong><span>{t('progress.avgMinutesMetric')}</span></article>
            <article><strong>{formatNumber(exerciseProgress.length)}</strong><span>{t('progress.trackedExercisesMetric')}</span></article>
          </div>
          <section className={styles.card}>
            <h2>{t('progress.volumeTrend')}</h2>
            {chartData.length === 0 ? <p>{t('progress.noCompletedWorkouts')}</p> : (
              <div className={styles.chart} aria-label={t('progress.volumeChartAriaLabel')}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}><CartesianGrid stroke="#2b323b" vertical={false} /><XAxis dataKey="date" stroke="#9ba4ae" tickFormatter={chartDateLabel} /><YAxis stroke="#9ba4ae" /><Tooltip labelFormatter={(label) => typeof label === 'string' || typeof label === 'number' ? chartDateLabel(String(label)) : ''} /><Bar dataKey="volume" name={t('progress.volumeSeriesLabel')} fill="#ffb05c" radius={[6, 6, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
          <section className={styles.card}>
            <h2>{t('progress.exerciseRecords')}</h2>
            {exerciseProgress.length === 0 ? <p>{t('progress.noRecords')}</p> : <div className={styles.records}>{exerciseProgress.slice(0, 8).map((metric) => <article key={metric.exerciseId}><div><strong>{metric.name}</strong><span>{tn('progress.sessionsCount', metric.sessions)}</span></div><p>{t('progress.recordSummary', { best: formatNumber(metric.bestLoadKg), oneRepMax: formatNumber(metric.estimatedOneRepMaxKg), volume: formatNumber(Math.round(metric.totalVolumeKg)) })}</p></article>)}</div>}
          </section>
          <div className={styles.columns}>
            <section>
              <h2>{t('progress.muscleReadiness')}</h2>
              <MuscleMap recovery={data.value.recovery} selected={selectedMuscle} onSelect={setSelectedMuscle} />
              {selectedMuscle && (
                <div className={styles.feedback}>
                  <h3>{muscleLabel(t, selectedMuscle)}</h3>
                  <p className={styles.readinessSummary}><strong>{Math.round(selectedRecovery?.recommendationReadiness ?? 100)}%</strong> {t('progress.readinessDetail', { status: readinessLabel(t, readinessStatus(selectedRecovery?.recommendationReadiness ?? 100)) })}</p>
                  {selectedRecovery && selectedRecovery.recommendationReadiness !== selectedRecovery.calculatedRecovery && <p>{t('progress.recoveryBeforeFeedback', { percent: Math.round(selectedRecovery.calculatedRecovery) })}</p>}
                  <div>{(['very_sore', 'sore', 'normal', 'fresh'] as const).map((state) => <button key={state} onClick={() => void saveFeedback(state)}>{subjectiveStateLabel(t, state)}</button>)}</div>
                </div>
              )}
            </section>
            <section className={styles.history}>
              <h2>{t('progress.history')}</h2>
              {data.value.entries.length === 0 ? <p>{t('progress.noHistory')}</p> : data.value.entries.map((entry) => (
                <article key={entry.workout.id}><div><strong>{entry.workout.name}</strong><span>{formatDate(entry.workout.date)}</span></div><p>{t('progress.historySummary', { exerciseCount: entry.exercises.length, setCount: entry.sets.length, volume: formatNumber(Math.round(entry.volumeKg)) })}</p></article>
              ))}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
