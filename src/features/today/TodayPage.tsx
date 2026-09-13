import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import type { WorkoutTemplate } from '../../data/types'
import { useCatalogReadiness } from '../../catalog/useCatalogReadiness'
import { ActiveWorkoutConflictError } from '../../data/repositories/workoutRepository'
import { useI18n } from '../../i18n/I18nContext'
import { formatProgramFocus, formatProgramTemplateName } from '../../i18n/builtInProgramPresentation'
import { startWorkout, startWorkoutTemplate } from '../workout/workoutActions'
import { useTodayData } from './useTodayData'
import { useOnlineStatus } from './useOnlineStatus'
import { GeneratorPanel } from '../generator/GeneratorPanel'
import { BUILT_IN_PROGRAM } from './builtInProgram'
import styles from './TodayPage.module.css'

export function TodayPage({ db = appDb }: { db?: RepwiseDatabase }) {
  const navigate = useNavigate()
  const { t, tn, formatDate } = useI18n()
  const data = useTodayData(db)
  const catalog = useCatalogReadiness()
  const online = useOnlineStatus()
  const [workoutName, setWorkoutName] = useState(() => t('common.defaultWorkoutName'))
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
      setStartError(error instanceof ActiveWorkoutConflictError ? t('today.startErrorManual') : error instanceof Error ? error.message : t('today.startErrorManual'))
    } finally {
      setStarting(undefined)
    }
  }

  async function handleStartTemplate(template: WorkoutTemplate) {
    setStarting(template.id)
    setStartError(undefined)
    try {
      await startWorkoutTemplate(db, { ...template, name: formatProgramTemplateName(t, template.name) })
      void navigate('/workout')
    } catch (error) {
      setStartError(error instanceof ActiveWorkoutConflictError ? t('today.startErrorTemplate') : error instanceof Error ? error.message : t('today.startErrorTemplate'))
    } finally {
      setStarting(undefined)
    }
  }

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{t('today.eyebrow')}</p>
      <h1>{t('today.title')}</h1>

      {data.status === 'loading' && (
        <p role="status" aria-live="polite" className={styles.status}>
          {t('today.loadingSummary')}
        </p>
      )}

      {data.status === 'error' && (
        <p role="alert" className={styles.statusError}>
          {t('today.loadError', { message: data.message })}
        </p>
      )}

      {data.status === 'ready' && (
        <>
          {data.value.activeWorkout ? (
            <div className={styles.resumeCard}>
              <div>
                <h2>{data.value.activeWorkout.name}</h2>
                <p>{t('today.workoutInProgress')}</p>
              </div>
              <button type="button" className={styles.resumeButton} onClick={() => void navigate('/workout')}>
                {t('today.resumeWorkout')}
              </button>
            </div>
          ) : (
            <div className={styles.startCard}>
              <label htmlFor="workout-name">{t('today.workoutNameLabel')}</label>
              <div className={styles.startRow}>
                <input id="workout-name" className={styles.nameInput} value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
                <button type="button" className={styles.startButton} onClick={() => void handleStart()} disabled={Boolean(starting)}>
                  {t('today.startWorkout')}
                </button>
              </div>
            </div>
          )}

          {startError && <p role="alert" className={styles.statusError}>{startError}</p>}

          {!data.value.activeWorkout && <section className={styles.program} aria-labelledby="program-title">
            <div className={styles.programHeading}>
              <div><p className={styles.programEyebrow}>{t('today.rotationEyebrow')}</p><h2 id="program-title">{t('today.myProgram')}</h2></div>
              <label>{t('today.weekLabel')}
                <select aria-label={t('today.programWeekAriaLabel')} value={programWeek} onChange={(event) => setProgramWeek(Number(event.target.value))}>
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </label>
            </div>
            <div className={styles.programGrid}>
              {BUILT_IN_PROGRAM.slice((programWeek - 1) * 4, programWeek * 4).map((template, index) => <article key={template.id}>
                <div><strong>{t('today.dayLabel', { letter: String.fromCharCode(65 + index) })}</strong><span>{formatProgramFocus(t, template.name.replace(/^Week \d+ Day [A-D] — /, ''))}</span></div>
                <button type="button" onClick={() => void handleStartTemplate(template)} disabled={Boolean(starting)}>{starting === template.id ? t('common.starting') : t('today.startAction')}</button>
              </article>)}
            </div>
          </section>}

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <h2>{t('today.lastWorkout')}</h2>
              {data.value.lastCompletedWorkout ? (
                <>
                  <div className={styles.summaryValue}>{data.value.lastCompletedWorkout.name}</div>
                  <p className={styles.summaryDetail}>{formatDate(data.value.lastCompletedWorkout.date)}</p>
                </>
              ) : (
                <p className={styles.summaryDetail}>{t('today.noCompletedWorkouts')}</p>
              )}
            </div>

            <div className={styles.summaryCard}>
              <h2>{t('today.thisWeek')}</h2>
              <div className={styles.summaryValue}>{tn('today.workoutsCount', data.value.weekCompletedWorkoutCount)}</div>
              <p className={styles.summaryDetail}>{tn('today.workingSetsCompleted', data.value.weekCompletedWorkingSetCount)}</p>
            </div>
          </div>

          <p className={styles.statusLine} role="status" aria-live="polite">
            <span>
              {t('today.catalogLabel')} <strong>{catalog.status === 'ready' ? t('today.catalogUpToDate', { version: catalog.version }) : catalog.status === 'loading' ? t('today.catalogLoading') : t('today.catalogError', { message: catalog.message })}</strong>
            </span>
            <span>
              {t('today.networkLabel')} <strong>{online ? t('today.online') : t('today.offline')}</strong>
            </span>
          </p>
          {!data.value.activeWorkout && <GeneratorPanel db={db} />}
        </>
      )}
    </section>
  )
}
