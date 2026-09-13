import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveQueryState } from '../../data/useLiveQuery'

const mocks = vi.hoisted(() => ({
  activeWorkout: { status: 'loading' } as LiveQueryState<{ id: string } | undefined>,
  registrationOptions: undefined as { onNeedRefresh: () => void } | undefined,
  updateServiceWorker: vi.fn(),
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: { onNeedRefresh: () => void }) => {
    mocks.registrationOptions = options
    return mocks.updateServiceWorker
  },
}))

vi.mock('../../data/useLiveQuery', () => ({
  useLiveQuery: () => mocks.activeWorkout,
}))

import { PwaStatus } from './PwaStatus'

function renderUpdateNotice() {
  render(<PwaStatus />)
  act(() => mocks.registrationOptions?.onNeedRefresh())
  return screen.getByRole('button', { name: 'Reload update' })
}

describe('PwaStatus update gate', () => {
  beforeEach(() => {
    mocks.activeWorkout = { status: 'loading' }
    mocks.registrationOptions = undefined
    mocks.updateServiceWorker.mockReset()
  })

  it.each([
    [{ status: 'loading' }, 'Checking workout state before reloading.'],
    [{ status: 'error', message: 'IndexedDB unavailable' }, 'Workout state could not be verified.'],
    [{ status: 'ready', value: { id: 'active-workout' } }, 'Finish the active workout before reloading.'],
  ] as const)('fails closed while workout state is unresolved or active', (state, message) => {
    mocks.activeWorkout = state

    expect(renderUpdateNotice()).toBeDisabled()
    expect(screen.getByText(message, { exact: false })).toBeVisible()
  })

  it('allows the update only after confirming no active workout exists', () => {
    mocks.activeWorkout = { status: 'ready', value: undefined }

    const reload = renderUpdateNotice()
    expect(reload).toBeEnabled()

    reload.click()
    expect(mocks.updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
