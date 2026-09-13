import { describe, expect, it } from 'vitest'
import { catalogAssetUrlForBase } from './mediaUrl'

describe('catalog media URLs', () => {
  it('keeps catalog JSON and media under the configured GitHub Pages base path', () => {
    expect(catalogAssetUrlForBase('catalog.json', '/Repwise/')).toBe('/Repwise/catalog/catalog.json')
    expect(catalogAssetUrlForBase('media/barbell-bench-press-medium-grip/start.webp', '/Repwise/')).toBe(
      '/Repwise/catalog/media/barbell-bench-press-medium-grip/start.webp',
    )
  })
})
