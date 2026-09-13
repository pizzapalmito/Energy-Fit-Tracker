import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, type RepwiseDatabase } from '../data/db'
import type { GeneratedCatalog } from './generatedCatalog'

let db: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDatabase(`readiness-test-${counter}`)
  await db.open()
  vi.resetModules()
})

function catalog(overrides: Partial<GeneratedCatalog> = {}): GeneratedCatalog {
  return { version: 'catalog-x', sourceCommit: 'c', importerVersion: 'v', exercises: [], muscles: [], ...overrides }
}

describe('catalog readiness', () => {
  it('starts in the loading state', async () => {
    const { getCatalogReadinessSnapshot } = await import('./catalogReadiness')
    expect(getCatalogReadinessSnapshot()).toEqual({ status: 'loading' })
  })

  it('transitions loading -> ready once seeding succeeds', async () => {
    const { initCatalogSeeding, getCatalogReadinessSnapshot } = await import('./catalogReadiness')
    initCatalogSeeding(db, () => Promise.resolve(catalog()))
    await vi.waitFor(() => expect(getCatalogReadinessSnapshot().status).toBe('ready'))
    expect(getCatalogReadinessSnapshot()).toEqual({ status: 'ready', version: 'catalog-x' })
  })

  it('transitions loading -> error with a clear message when seeding fails', async () => {
    const { initCatalogSeeding, getCatalogReadinessSnapshot } = await import('./catalogReadiness')
    initCatalogSeeding(db, () => Promise.reject(new Error('offline and no cache')))
    await vi.waitFor(() => expect(getCatalogReadinessSnapshot().status).toBe('error'))
    const state = getCatalogReadinessSnapshot()
    expect(state.status).toBe('error')
    if (state.status === 'error') expect(state.message).toContain('offline and no cache')
  })

  it('notifies subscribers on every state transition', async () => {
    const { initCatalogSeeding, subscribeCatalogReadiness, getCatalogReadinessSnapshot } = await import('./catalogReadiness')
    const listener = vi.fn()
    const unsubscribe = subscribeCatalogReadiness(listener)
    initCatalogSeeding(db, () => Promise.resolve(catalog()))
    await vi.waitFor(() => expect(getCatalogReadinessSnapshot().status).toBe('ready'))
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })
})
