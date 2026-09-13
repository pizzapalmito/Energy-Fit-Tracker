import { useI18n } from '../../i18n/I18nContext'
import type { RestTimerControls } from './useRestTimer'
import styles from './RestTimerBar.module.css'

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function RestTimerBar({ timer }: { timer: RestTimerControls }) {
  const { t } = useI18n()
  if (!timer.workoutExerciseId) return null

  return (
    <div className={styles.bar} role="group" aria-label={t('restTimer.groupAriaLabel')}>
      <div>
        <div className={styles.label}>{timer.remainingSeconds === 0 ? t('restTimer.restComplete') : timer.running ? t('restTimer.resting') : t('restTimer.restPaused')}</div>
        <div className={styles.time} aria-live="off">
          {formatClock(timer.remainingSeconds)}
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => timer.adjust(-15)} aria-label={t('restTimer.subtract15')}>
          {t('restTimer.subtract15Label')}
        </button>
        <button type="button" onClick={() => timer.adjust(15)} aria-label={t('restTimer.add15')}>
          {t('restTimer.add15Label')}
        </button>
        {timer.running ? (
          <button type="button" onClick={timer.pause}>
            {t('restTimer.pause')}
          </button>
        ) : (
          <button type="button" onClick={timer.resume} disabled={timer.remainingSeconds === 0}>
            {t('restTimer.resume')}
          </button>
        )}
        <button type="button" onClick={timer.skip}>
          {t('restTimer.skip')}
        </button>
      </div>
    </div>
  )
}
