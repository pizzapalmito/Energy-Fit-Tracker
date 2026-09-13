/** Builds a same-origin URL for a bundled catalog asset, honoring the configured PWA base path. */
export function catalogAssetUrl(relativePath: string): string {
  return catalogAssetUrlForBase(relativePath, import.meta.env.BASE_URL)
}

/** Pure form used to verify non-root deployments such as GitHub Pages. */
export function catalogAssetUrlForBase(relativePath: string, baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}catalog/${relativePath.replace(/^\/+/, '')}`
}

export function catalogJsonUrl(): string {
  return catalogAssetUrl('catalog.json')
}
