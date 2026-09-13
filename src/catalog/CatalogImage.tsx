import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { catalogAssetUrl } from './mediaUrl'

interface CatalogImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  relativePath?: string
  fallbackClassName?: string
}

/** Canonical catalog image renderer with eager loading for opened demos and an intentional failure state. */
export function CatalogImage({ relativePath, alt = '', fallbackClassName, loading = 'eager', onError, ...props }: CatalogImageProps) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(!relativePath)

  useEffect(() => setFailed(!relativePath), [relativePath])

  if (!relativePath || failed) {
    return <span className={fallbackClassName} role="img" aria-label={t('catalogImage.unavailable', { alt: alt || t('catalogImage.fallbackAlt') })}>{t('catalogImage.noImage')}</span>
  }

  return <img
    {...props}
    src={catalogAssetUrl(relativePath)}
    alt={alt}
    loading={loading}
    onError={(event) => {
      setFailed(true)
      onError?.(event)
    }}
  />
}
