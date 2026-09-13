import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { DeterministicRecoveryEngine } from '../../engines/recovery/recoveryEngine'
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
  const data = useLiveQuery(() => readProgress(db), [db])
  const [selectedMuscle, setSelectedMuscle] = useState<string>()
  const selectedRecovery = data.status === 'ready' ? data.value.recovery.find((entry) => entry.muscleId === selectedMuscle) : undefined
  const chartData = useMemo(() => {
    if (data.status !== 'ready') return []
    return data.value.entries.slice(0, 10).reverse().map((entry) => ({ date: entry.workout.date.slice(5), volume: Math.round(entry.volumeKg) }))
  }, [data])
  const exerciseProgress = useMemo(() => data.status === 'ready' ? buildExerciseProgress(data.value.exercises, data.value.sets) : [], [data])

  async function saveFeedback(subjectiveState: 'very_sore' | 'sore' | 'normal' | 'fresh') {
    if (!selectedMuscle) return
    const date = localDate()
    await db.recoveryFeedback.put({ id: `${selectedMuscle}-${date}`, muscleId: selectedMuscle, date, subjectiveState })
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Training record</p>
      <h1>Progress</h1>
      {data.status === 'loading' && <p role="status">Loading progress…</p>}
      {data.status === 'error' && <p role="alert">Could not load progress: {data.message}</p>}
      {data.status === 'ready' && (
        <>
          <div className={styles.metrics}>
            <article><strong>{data.value.entries.length}</strong><span>workouts</span></article>
            <article><strong>{data.value.sets.filter((set) => set.completed && set.type === 'working').length}</strong><span>working sets</span></article>
            <article><strong>{Math.round(data.value.entries.reduce((sum, entry) => sum + entry.volumeKg, 0)).toLocaleString()}</strong><span>kg volume</span></article>
            <article><strong>{trainingConsistency(data.value.entries.map((entry) => entry.workout))}%</strong><span>8-week consistency</span></article>
            <article><strong>{data.value.entries.length === 0 ? 0 : Math.round(data.value.entries.reduce((sum, entry) => sum + workoutDurationMinutes(entry.workout), 0) / data.value.entries.length)}</strong><span>avg minutes</span></article>
            <article><strong>{exerciseProgress.length}</strong><span>tracked exercises</span></article>
          </div>
          <section className={styles.card}>
            <h2>Volume trend</h2>
            {chartData.length === 0 ? <p>No completed workouts yet.</p> : (
              <div className={styles.chart} aria-label="Workout volume chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}><CartesianGrid stroke="#2b323b" vertical={false} /><XAxis dataKey="date" stroke="#9ba4ae" /><YAxis stroke="#9ba4ae" /><Tooltip /><Bar dataKey="volume" fill="#ffb05c" radius={[6, 6, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
          <section className={styles.card}>
            <h2>Exercise records</h2>
            {exerciseProgress.length === 0 ? <p>Complete weighted working sets to see records.</p> : <div className={styles.records}>{exerciseProgress.slice(0, 8).map((metric) => <article key={metric.exerciseId}><div><strong>{metric.name}</strong><span>{metric.sessions} sessions</span></div><p>Best {metric.bestLoadKg.toLocaleString()} kg · estimated 1RM {metric.estimatedOneRepMaxKg.toLocaleString()} kg · {Math.round(metric.totalVolumeKg).toLocaleString()} kg volume</p></article>)}</div>}
          </section>
          <div className={styles.columns}>
            <section>
              <h2>Muscle readiness</h2>
              <MuscleMap recovery={data.value.recovery} selected={selectedMuscle} onSelect={setSelectedMuscle} />
              {selectedMuscle && (
                <div className={styles.feedback}>
                  <h3>{selectedMuscle.replaceAll('-', ' ')}</h3>
                  <p className={styles.readinessSummary}><strong>{Math.round(selectedRecovery?.recommendationReadiness ?? 100)}%</strong> training readiness · {readinessStatus(selectedRecovery?.recommendationReadiness ?? 100)}</p>
                  {selectedRecovery && selectedRecovery.recommendationReadiness !== selectedRecovery.calculatedRecovery && <p>{Math.round(selectedRecovery.calculatedRecovery)}% estimated recovery before your soreness feedback.</p>}
                  <div>{(['very_sore', 'sore', 'normal', 'fresh'] as const).map((state) => <button key={state} onClick={() => void saveFeedback(state)}>{state.replace('_', ' ')}</button>)}</div>
                </div>
              )}
            </section>
            <section className={styles.history}>
              <h2>History</h2>
              {data.value.entries.length === 0 ? <p>No workout history yet.</p> : data.value.entries.map((entry) => (
                <article key={entry.workout.id}><div><strong>{entry.workout.name}</strong><span>{entry.workout.date}</span></div><p>{entry.exercises.length} exercises · {entry.sets.length} completed sets · {Math.round(entry.volumeKg).toLocaleString()} kg</p></article>
              ))}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
