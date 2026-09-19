import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nContext'
import styles from './AppShell.module.css'
import { PwaStatus } from './PwaStatus'

const routes = ['today', 'workout', 'exercises', 'progress', 'settings'] as const

const NAV_ICON_FILES: Record<(typeof routes)[number], string> = {
  today: 'ui-calendar-days.svg',
  workout: 'ui-bolt.svg',
  exercises: 'ui-squares-2x2.svg',
  progress: 'ui-chart-bar.svg',
  settings: 'ui-adjustments-horizontal.svg',
}

export function AppShell() {
  const { t } = useI18n()
  const base = import.meta.env.BASE_URL
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.heroArt} aria-hidden="true" style={{ backgroundImage: `url(${base}brand/mobile-hero.webp)` }} />
        <img className={styles.mark} src={`${base}brand/eft-logo.webp`} alt="" aria-hidden="true" />
        <div className={styles.identity}><strong>{t('app.name')}</strong><small>{t('app.tagline')}</small></div>
      </header>
      <main className={styles.main}><Suspense fallback={<p role="status">{t('app.loading')}</p>}><Outlet /></Suspense></main>
      <nav className={styles.nav} aria-label={t('nav.primary')}>
        {routes.map((route, index) => (
          <NavLink key={route} to={`/${route}`} className={({ isActive }) => isActive ? styles.active : undefined}>
            <span className={styles.navIndex} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.navIcon} aria-hidden="true" style={{ WebkitMaskImage: `url(${base}icons/${NAV_ICON_FILES[route]})`, maskImage: `url(${base}icons/${NAV_ICON_FILES[route]})` }} />
            <span className={styles.navLabel}>{t(`nav.${route}`)}</span>
          </NavLink>
        ))}
      </nav>
      <PwaStatus />
    </div>
  )
}
