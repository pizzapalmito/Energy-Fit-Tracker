import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import type { WorkoutTemplate } from '../../data/types'
import { useCatalogReadiness } from '../../catalog/useCatalogReadiness'
import { startWorkout, startWorkoutTemplate } from '../workout/workoutActions'
import { useTodayData } from './useTodayData'
import { useOnlineStatus } from './useOnlineStatus'
import { GeneratorPanel } from '../generator/GeneratorPanel'
import { BUILT_IN_PROGRAM } from './builtInProgram'
import styles from './TodayPage.module.css'

export function TodayPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const navigate = useNavigate()
  const data = useTodayData(db)
  const catalog = useCatalogReadiness()
  const online = useOnlineStatus()
  const [workoutName, setWorkoutName] = useState('Workout')
  const [starting, setStarting] = useState<string>()
  const [programWeek, setProgramWeek] = useState(1)
  const [startError, setStartError] = useState<string>()

  async function handleStart() {
    setStarting('manual')
    setStartError(undefined)
    try {
      await startWorkout(db, workoutName)
      void navigate('/workout')
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Could not start this workout.')
    } finally {
      setStarting(undefined)
    }
  }

  async function handleStartTemplate(template: WorkoutTemplate) {
    setStarting(template.id)
    setStartError(undefined)
    try {
      await startWorkoutTemplate(db, template)
      void navigate('/workout')
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Could not start this program workout.')
    } finally {
      setStarting(undefined)
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
                <button type="button" className={styles.startButton} onClick={() => void handleStart()} disabled={Boolean(starting)}>
                  Start workout
                </button>
              </div>
            </div>
          )}

          {startError && <p role="alert" className={styles.statusError}>{startError}</p>}

          {!data.value.activeWorkout && <section className={styles.program} aria-labelledby="program-title">
            <div className={styles.programHeading}>
              <div><p className={styles.programEyebrow}>3-week rotation</p><h2 id="program-title">My Program</h2></div>
              <label>Week
                <select aria-label="Program week" value={programWeek} onChange={(event) => setProgramWeek(Number(event.target.value))}>
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </label>
            </div>
            <div className={styles.programGrid}>
              {BUILT_IN_PROGRAM.slice((programWeek - 1) * 4, programWeek * 4).map((template, index) => <article key={template.id}>
                <div><strong>Day {String.fromCharCode(65 + index)}</strong><span>{template.name.replace(/^Week \d+ Day [A-D] — /, '')}</span></div>
                <button type="button" onClick={() => void handleStartTemplate(template)} disabled={Boolean(starting)}>{starting === template.id ? 'Starting…' : 'Start'}</button>
              </article>)}
            </div>
          </section>}

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
