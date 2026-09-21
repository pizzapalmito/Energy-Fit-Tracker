import { useEffect, useRef } from 'react'
import { CatalogImage } from '../../catalog/CatalogImage'
import type { Exercise } from '../../domain/models'
import { useI18n } from '../../i18n/I18nContext'
import styles from './ExerciseDemoDialog.module.css'

export function ExerciseDemoDialog({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { t } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => closeRef.current?.focus(), [])
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className={styles.backdrop} role="presentation" onClick={onClose}>
    <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="workout-demo-title" onClick={(event) => event.stopPropagation()}>
      <header><h2 id="workout-demo-title">{exercise.name}</h2><button ref={closeRef} type="button" onClick={onClose} aria-label={t('exerciseDemoDialog.closeAriaLabel')}>×</button></header>
      <CatalogImage relativePath={exercise.media[0]} alt={exercise.name} fallbackClassName={styles.fallback} />
    </section>
  </div>
}
