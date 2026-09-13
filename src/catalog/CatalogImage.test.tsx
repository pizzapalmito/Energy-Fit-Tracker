import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CatalogImage } from './CatalogImage'

describe('CatalogImage', () => {
  it('uses the canonical base-aware URL and eagerly requests visible demonstrations', () => {
    render(<CatalogImage relativePath="media/barbell-bench-press-medium-grip/start.webp" alt="Bench press start" />)
    expect(screen.getByRole('img', { name: 'Bench press start' })).toHaveAttribute(
      'src',
      `${import.meta.env.BASE_URL}catalog/media/barbell-bench-press-medium-grip/start.webp`,
    )
    expect(screen.getByRole('img', { name: 'Bench press start' })).toHaveAttribute('loading', 'eager')
  })

  it('replaces a failed request with an intentional fallback', () => {
    render(<CatalogImage relativePath="media/missing/start.webp" alt="Missing exercise" />)
    fireEvent.error(screen.getByRole('img', { name: 'Missing exercise' }))
    expect(screen.getByRole('img', { name: 'Missing exercise unavailable' })).toHaveTextContent('No image')
  })

  it('uses the same fallback when no media is available', () => {
    render(<CatalogImage alt="No-media exercise" />)
    expect(screen.getByRole('img', { name: 'No-media exercise unavailable' })).toBeVisible()
  })
})
