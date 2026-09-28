import styles from './ScreenTitle.module.css'

/** Screen heading whose decorative index matches the numbered primary navigation. */
export function ScreenTitle({ index, children }: { index: number; children: string }) {
  return (
    <h1 className={styles.title}>
      <span className={styles.index} aria-hidden="true">{String(index).padStart(2, '0')}</span>
      <span className={styles.text}>{children}</span>
    </h1>
  )
}
