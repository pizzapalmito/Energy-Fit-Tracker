import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useCatalogReadiness } from '../../catalog/useCatalogReadiness'
import { startWorkout } from '../workout/workoutActions'
import { useTodayData } from './useTodayData'
import { useOnlineStatus } from './useOnlineStatus'
import { GeneratorPanel } from '../generator/GeneratorPanel'
import styles from './TodayPage.module.css'

export function TodayPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const navigate = useNavigate()
  const data = useTodayData(db)
  const catalog = useCatalogReadiness()
  const online = useOnlineStatus()
  const [workoutName, setWorkoutName] = useState('Workout')
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    try {
      await startWorkout(db, workoutName)
      void navigate('/workout')
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Repwise</p>
      <h1>Today</h1>

      {data.status === 'loading' && (
        <p role="status" aria-live="polite" className={styles.status}>
          Loading your training summary…
        </p>
      )}

      {data.status === 'error' && (
        <p role="alert" className={styles.statusError}>
          Couldn't load your training summary ({data.message}).
        </p>
      )}

      {data.status === 'ready' && (
        <>
          {data.value.activeWorkout ? (
            <div className={styles.resumeCard}>
              <div>
                <h2>{data.value.activeWorkout.name}</h2>
                <p>Workout in progress</p>
              </div>
              <button type="button" className={styles.resumeButton} onClick={() => void navigate('/workout')}>
                Resume workout
              </button>
            </div>
          ) : (
            <div className={styles.startCard}>
              <label htmlFor="workout-name">Workout name</label>
              <div className={styles.startRow}>
                <input id="workout-name" className={styles.nameInput} value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
                <button type="button" className={styles.startButton} onClick={() => void handleStart()} disabled={starting}>
                  Start workout
                </button>
              </div>
            </div>
          )}

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <h2>Last workout</h2>
              {data.value.lastCompletedWorkout ? (
                <>
                  <div className={styles.summaryValue}>{data.value.lastCompletedWorkout.name}</div>
                  <p className={styles.summaryDetail}>{data.value.lastCompletedWorkout.date}</p>
                </>
              ) : (
                <p className={styles.summaryDetail}>No completed workouts yet.</p>
              )}
            </div>

            <div className={styles.summaryCard}>
              <h2>This week</h2>
              <div className={styles.summaryValue}>{data.value.weekCompletedWorkoutCount} workouts</div>
              <p className={styles.summaryDetail}>{data.value.weekCompletedWorkingSetCount} working sets completed</p>
            </div>
          </div>

          <p className={styles.statusLine} role="status" aria-live="polite">
            <span>
              Catalog: <strong>{catalog.status === 'ready' ? `up to date (${catalog.version})` : catalog.status === 'loading' ? 'loading…' : `error (${catalog.message})`}</strong>
            </span>
            <span>
              Network: <strong>{online ? 'online' : 'offline — using local data'}</strong>
            </span>
          </p>
          {!data.value.activeWorkout && <GeneratorPanel db={db} />}
        </>
      )}
    </section>
  )
}
