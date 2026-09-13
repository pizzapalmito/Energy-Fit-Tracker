import type { RestTimerControls } from './useRestTimer'
import styles from './RestTimerBar.module.css'

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function RestTimerBar({ timer }: { timer: RestTimerControls }) {
  if (!timer.workoutExerciseId) return null

  return (
    <div className={styles.bar} role="group" aria-label="Rest timer">
      <div>
        <div className={styles.label}>{timer.remainingSeconds === 0 ? 'Rest complete' : timer.running ? 'Resting' : 'Rest paused'}</div>
        <div className={styles.time} aria-live="off">
          {formatClock(timer.remainingSeconds)}
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => timer.adjust(-15)} aria-label="Subtract 15 seconds">
          −15s
        </button>
        <button type="button" onClick={() => timer.adjust(15)} aria-label="Add 15 seconds">
          +15s
        </button>
        {timer.running ? (
          <button type="button" onClick={timer.pause}>
            Pause
          </button>
        ) : (
          <button type="button" onClick={timer.resume} disabled={timer.remainingSeconds === 0}>
            Resume
          </button>
        )}
        <button type="button" onClick={timer.skip}>
          Skip
        </button>
      </div>
    </div>
  )
}
