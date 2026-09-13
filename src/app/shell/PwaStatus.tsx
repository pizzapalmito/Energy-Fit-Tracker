import { useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { db } from '../../data/appDatabase'
import { useLiveQuery } from '../../data/useLiveQuery'
import styles from './PwaStatus.module.css'

export function PwaStatus() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateServiceWorker] = useState(() => registerSW({ immediate: true, onNeedRefresh: () => setNeedsRefresh(true), onOfflineReady: () => setOfflineReady(true) }))
  const activeWorkout = useLiveQuery(() => db.workouts.where('status').equals('active').first(), [])
  if (!needsRefresh && !offlineReady) return null
  const mustDefer = needsRefresh && activeWorkout.status === 'ready' && Boolean(activeWorkout.value)
  return <aside className={styles.notice} role="status" aria-live="polite">
    <div><strong>{needsRefresh ? 'Repwise update ready' : 'Repwise is ready offline'}</strong>{mustDefer && <span>Finish the active workout before reloading.</span>}</div>
    {needsRefresh && <button type="button" disabled={mustDefer} onClick={() => void updateServiceWorker(true)}>Reload update</button>}
    <button type="button" className={styles.dismiss} onClick={() => { setNeedsRefresh(false); setOfflineReady(false) }}>Later</button>
  </aside>
}
