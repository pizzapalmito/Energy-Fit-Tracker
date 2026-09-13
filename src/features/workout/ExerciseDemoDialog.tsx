import { useEffect, useRef, useState } from 'react'
import { CatalogImage } from '../../catalog/CatalogImage'
import type { Exercise } from '../../domain/models'
import { useI18n } from '../../i18n/I18nContext'
import styles from './ExerciseDemoDialog.module.css'

export function ExerciseDemoDialog({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { t } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [frame, setFrame] = useState<0 | 1>(0)
  const hasBothFrames = Boolean(exercise.media[0] && exercise.media[1])

  useEffect(() => closeRef.current?.focus(), [])
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className={styles.backdrop} role="presentation" onClick={onClose}>
    <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="workout-demo-title" onClick={(event) => event.stopPropagation()}>
      <header><h2 id="workout-demo-title">{exercise.name}</h2><button ref={closeRef} type="button" onClick={onClose} aria-label={t('exerciseDemoDialog.closeAriaLabel')}>×</button></header>
      <CatalogImage relativePath={exercise.media[frame] ?? exercise.media[0]} alt={`${exercise.name} — ${frame === 0 ? t('exerciseDemoDialog.startingPosition') : t('exerciseDemoDialog.endingPosition')}`} fallbackClassName={styles.fallback} />
      {hasBothFrames && <div className={styles.toggle} role="group" aria-label={t('exerciseDemoDialog.frameGroupAriaLabel')}>
        <button type="button" aria-pressed={frame === 0} onClick={() => setFrame(0)}>{t('exerciseDemoDialog.start')}</button>
        <button type="button" aria-pressed={frame === 1} onClick={() => setFrame(1)}>{t('exerciseDemoDialog.end')}</button>
      </div>}
    </section>
  </div>
}
