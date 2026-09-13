import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../../domain/models'
import { CatalogImage } from '../../catalog/CatalogImage'
import { PRIMARY_WEIGHT_THRESHOLD } from '../../engines/shared/muscleContribution'
import { useI18n } from '../../i18n/I18nContext'
import { difficultyLabel, equipmentLabel, movementPatternLabel, muscleLabel } from '../../i18n/enumLabels'
import styles from './ExerciseDetail.module.css'

export function ExerciseDetail({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { t } = useI18n()
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
          <button type="button" ref={closeButtonRef} className={styles.closeButton} onClick={onClose} aria-label={t('exerciseDetail.closeAriaLabel')}>
            ×
          </button>
        </div>

        <figure className={styles.media}>
            <CatalogImage relativePath={activeMedia} alt={`${exercise.name} — ${frame === 'end' ? t('exerciseDetail.endingPosition') : t('exerciseDetail.startingPosition')}`} fallbackClassName={styles.mediaFallback} />
            {hasBothFrames && (
              <figcaption className={styles.mediaToggle} role="group" aria-label={t('exerciseDetail.frameGroupAriaLabel')}>
                <button type="button" aria-pressed={frame === 'start'} onClick={() => setFrame('start')}>
                  {t('exerciseDetail.start')}
                </button>
                <button type="button" aria-pressed={frame === 'end'} onClick={() => setFrame('end')}>
                  {t('exerciseDetail.end')}
                </button>
              </figcaption>
            )}
          </figure>

        <dl className={styles.factList}>
          <div>
            <dt>{t('exerciseDetail.difficulty')}</dt>
            <dd>{difficultyLabel(t, exercise.difficulty)}</dd>
          </div>
          <div>
            <dt>{t('exerciseDetail.movement')}</dt>
            <dd>{movementPatternLabel(t, exercise.movementPattern)}</dd>
          </div>
          <div>
            <dt>{t('exerciseDetail.equipment')}</dt>
            <dd>{exercise.equipment.map((item) => equipmentLabel(t, item)).join(', ')}</dd>
          </div>
          <div>
            <dt>{t('exerciseDetail.defaultRest')}</dt>
            <dd>{t('exerciseDetail.seconds', { count: exercise.defaultRestSeconds })}</dd>
          </div>
        </dl>

        <h3>{t('exerciseDetail.muscles')}</h3>
        <ul className={styles.muscleList}>
          {exercise.muscles.map((m) => (
            <li key={m.muscleId}>
              {muscleLabel(t, m.muscleId)}
              {' '}{m.weight >= PRIMARY_WEIGHT_THRESHOLD ? t('exerciseDetail.primary') : t('exerciseDetail.secondary')}
            </li>
          ))}
        </ul>

        {exercise.instructions.length > 0 && (
          <>
            <h3>{t('exerciseDetail.instructions')}</h3>
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
