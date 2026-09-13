import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nContext'
import styles from './AppShell.module.css'
import { PwaStatus } from './PwaStatus'

const routes = ['today', 'workout', 'exercises', 'progress', 'settings'] as const

export function AppShell() {
  const { t } = useI18n()
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.mark} aria-hidden="true">R</span>
        <div><strong>{t('app.name')}</strong><small>{t('app.tagline')}</small></div>
      </header>
      <main className={styles.main}><Suspense fallback={<p role="status">{t('app.loading')}</p>}><Outlet /></Suspense></main>
      <nav className={styles.nav} aria-label={t('nav.primary')}>
        {routes.map((route) => (
          <NavLink key={route} to={`/${route}`} className={({ isActive }) => isActive ? styles.active : undefined}>
            {t(`nav.${route}`)}
          </NavLink>
        ))}
      </nav>
      <PwaStatus />
    </div>
  )
}
