import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../../domain/models'
import type { Muscle } from '../../data/types'
import { CatalogImage } from '../../catalog/CatalogImage'
import { PRIMARY_WEIGHT_THRESHOLD } from '../../engines/shared/muscleContribution'
import styles from './ExerciseDetail.module.css'

export function ExerciseDetail({ exercise, muscles, onClose }: { exercise: Exercise; muscles: Map<string, Muscle>; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [frame, setFrame] = useState<'start' | 'end'>('start')

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => setFrame('start'), [exercise.id])

  const startMedia = exercise.media[0]
  const endMedia = exercise.media[1]
  const hasBothFrames = Boolean(startMedia && endMedia)
  const activeMedia = frame === 'end' ? (endMedia ?? startMedia) : startMedia

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="exercise-detail-title">{exercise.name}</h2>
          <button type="button" ref={closeButtonRef} className={styles.closeButton} onClick={onClose} aria-label="Close exercise details">
            ×
          </button>
        </div>

        <figure className={styles.media}>
            <CatalogImage relativePath={activeMedia} alt={`${exercise.name} — ${frame === 'end' ? 'ending' : 'starting'} position`} fallbackClassName={styles.mediaFallback} />
            {hasBothFrames && (
              <figcaption className={styles.mediaToggle} role="group" aria-label="Demonstration frame">
                <button type="button" aria-pressed={frame === 'start'} onClick={() => setFrame('start')}>
                  Start
                </button>
                <button type="button" aria-pressed={frame === 'end'} onClick={() => setFrame('end')}>
                  End
                </button>
              </figcaption>
            )}
          </figure>

        <dl className={styles.factList}>
          <div>
            <dt>Difficulty</dt>
            <dd>{exercise.difficulty}</dd>
          </div>
          <div>
            <dt>Movement</dt>
            <dd>{exercise.movementPattern}</dd>
          </div>
          <div>
            <dt>Equipment</dt>
            <dd>{exercise.equipment.join(', ')}</dd>
          </div>
          <div>
            <dt>Default rest</dt>
            <dd>{exercise.defaultRestSeconds}s</dd>
          </div>
        </dl>

        <h3>Muscles</h3>
        <ul className={styles.muscleList}>
          {exercise.muscles.map((m) => (
            <li key={m.muscleId}>
              {muscles.get(m.muscleId)?.name ?? m.muscleId}
              {m.weight >= PRIMARY_WEIGHT_THRESHOLD ? ' (primary)' : ' (secondary)'}
            </li>
          ))}
        </ul>

        {exercise.instructions.length > 0 && (
          <>
            <h3>Instructions</h3>
            <ol className={styles.instructions}>
              {exercise.instructions.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
