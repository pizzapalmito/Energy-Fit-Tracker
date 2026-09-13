import { useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { db } from '../../data/appDatabase'
import { useLiveQuery } from '../../data/useLiveQuery'
import { useI18n } from '../../i18n/I18nContext'
import styles from './PwaStatus.module.css'

export function PwaStatus() {
  const { t } = useI18n()
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateServiceWorker] = useState(() => registerSW({ immediate: true, onNeedRefresh: () => setNeedsRefresh(true), onOfflineReady: () => setOfflineReady(true) }))
  const activeWorkout = useLiveQuery(() => db.workouts.where('status').equals('active').first(), [])
  if (!needsRefresh && !offlineReady) return null
  const mustDefer = needsRefresh && (activeWorkout.status !== 'ready' || Boolean(activeWorkout.value))
  const deferMessage = activeWorkout.status === 'loading'
    ? t('pwa.checking')
    : activeWorkout.status === 'error'
      ? t('pwa.unverified')
      : activeWorkout.value
        ? t('pwa.finishFirst')
        : undefined
  return <aside className={styles.notice} role="status" aria-live="polite">
    <div><strong>{needsRefresh ? t('pwa.updateReady') : t('pwa.offlineReady')}</strong>{needsRefresh && deferMessage && <span>{deferMessage}</span>}</div>
    {needsRefresh && <button type="button" disabled={mustDefer} onClick={() => void updateServiceWorker(true)}>{t('pwa.reload')}</button>}
    <button type="button" className={styles.dismiss} onClick={() => { setNeedsRefresh(false); setOfflineReady(false) }}>{t('pwa.later')}</button>
  </aside>
}
