/** Builds a same-origin URL for a bundled catalog asset, honoring the configured PWA base path. */
export function catalogAssetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}catalog/${relativePath}`
}

export function catalogJsonUrl(): string {
  return catalogAssetUrl('catalog.json')
}
