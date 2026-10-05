import { useI18n } from '../i18n/I18nContext'
import styles from './ImageDevelopmentNotice.module.css'

export function ImageDevelopmentNotice() {
  const { t } = useI18n()
  return <p className={styles.notice}>{t('app.imageDevelopmentNotice')}</p>
}
