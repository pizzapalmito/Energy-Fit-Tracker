import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import styles from './AppShell.module.css'
import { PwaStatus } from './PwaStatus'

const routes = ['today', 'workout', 'exercises', 'progress', 'settings'] as const

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.mark} aria-hidden="true">R</span>
        <div><strong>Repwise</strong><small>Train with intent</small></div>
      </header>
      <main className={styles.main}><Suspense fallback={<p role="status">Loading Repwise…</p>}><Outlet /></Suspense></main>
      <nav className={styles.nav} aria-label="Primary">
        {routes.map((route) => (
          <NavLink key={route} to={`/${route}`} className={({ isActive }) => isActive ? styles.active : undefined}>
            {route}
          </NavLink>
        ))}
      </nav>
      <PwaStatus />
    </div>
  )
}
