import type { RepwiseDatabase } from '../data/db'
import { seedCatalog, CatalogSeedError } from './seedCatalog'
import type { GeneratedCatalog } from './generatedCatalog'
import { catalogJsonUrl } from './mediaUrl'

export type CatalogReadinessState = { status: 'loading' } | { status: 'ready'; version: string } | { status: 'error'; message: string }

let state: CatalogReadinessState = { status: 'loading' }
const listeners = new Set<() => void>()

function setState(next: CatalogReadinessState): void {
  state = next
  listeners.forEach((listener) => listener())
}

export function subscribeCatalogReadiness(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCatalogReadinessSnapshot(): CatalogReadinessState {
  return state
}

async function fetchGeneratedCatalog(): Promise<GeneratedCatalog> {
  const response = await fetch(catalogJsonUrl())
  if (!response.ok) throw new Error(`catalog fetch failed with HTTP ${response.status}`)
  return (await response.json()) as GeneratedCatalog
}

/**
 * Kicks off catalog seeding once at app startup. The Exercises feature must
 * not consider itself offline-ready until this settles to "ready" (or a
 * previous session already left usable catalog data in Dexie).
 */
export function initCatalogSeeding(db: RepwiseDatabase, loadCatalog: () => Promise<GeneratedCatalog> = fetchGeneratedCatalog): void {
  setState({ status: 'loading' })
  seedCatalog(db, loadCatalog)
    .then((outcome) => setState({ status: 'ready', version: outcome.version }))
    .catch((error: unknown) => {
      const message = error instanceof CatalogSeedError ? error.message : error instanceof Error ? error.message : 'Unknown catalog seeding failure.'
      setState({ status: 'error', message })
    })
}
