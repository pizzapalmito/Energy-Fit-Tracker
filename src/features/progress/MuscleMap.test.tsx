import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RecoveryResult } from '../../domain/contracts'
import { MuscleMap } from './MuscleMap'
import type { MuscleMapRecovery } from './readinessPresentation'

function recovery(muscleId: string, recommendationReadiness: number, side?: MuscleMapRecovery['side']): MuscleMapRecovery {
  const entry: RecoveryResult = {
    muscleId,
    calculatedRecovery: recommendationReadiness,
    recommendationReadiness,
    explanation: [],
    algorithmVersion: 'recovery-v1',
  }
  return side ? { ...entry, side } : entry
}

function regionsFor(container: HTMLElement, muscleId: string) {
  return [...container.querySelectorAll(`[data-muscle-id="${muscleId}"]`)]
}

describe('MuscleMap', () => {
  it.each([
    ['chest', 28],
    ['biceps', 55],
    ['quadriceps', 84],
    ['lats', 36],
  ])('renders bilateral %s readiness symmetrically', (muscleId, value) => {
    const { container } = render(<MuscleMap recovery={[recovery(muscleId, value)]} onSelect={vi.fn()} />)
    const regions = regionsFor(container, muscleId)

    expect(regions).toHaveLength(2)
    expect(regions.map((region) => region.getAttribute('data-body-side')).sort()).toEqual(['left', 'right'])
    expect(regions.every((region) => region.getAttribute('data-readiness') === String(value))).toBe(true)
  })

  it('maps recovery percentages to the three visible readiness states', () => {
    const { container } = render(<MuscleMap recovery={[recovery('chest', 25), recovery('biceps', 26), recovery('quadriceps', 76)]} onSelect={vi.fn()} />)

    expect(regionsFor(container, 'chest').every((region) => region.getAttribute('data-status') === 'fatigued')).toBe(true)
    expect(regionsFor(container, 'biceps').every((region) => region.getAttribute('data-status') === 'recovering')).toBe(true)
    expect(regionsFor(container, 'quadriceps').every((region) => region.getAttribute('data-status') === 'ready')).toBe(true)
    expect(screen.getByLabelText('Readiness legend')).toHaveTextContent('Fatigued0–25%Recovering26–75%Ready76–100%')
  })

  it('uses explicit side metadata for unilateral readiness without changing the opposite side', () => {
    const { container } = render(<MuscleMap recovery={[recovery('biceps', 20, 'left')]} onSelect={vi.fn()} />)
    const left = container.querySelector('[data-muscle-id="biceps"][data-body-side="left"]')
    const right = container.querySelector('[data-muscle-id="biceps"][data-body-side="right"]')

    expect(left).toHaveAttribute('data-readiness', '20')
    expect(left).toHaveAttribute('data-status', 'fatigued')
    expect(right).toHaveAttribute('data-readiness', '100')
    expect(right).toHaveAttribute('data-status', 'ready')
  })
})
