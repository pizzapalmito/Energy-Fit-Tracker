import type { RepwiseDatabase } from '../data/db'
import { DexieExerciseRepository } from '../data/repositories/exerciseRepository'
import { DexieMuscleRepository } from '../data/repositories/muscleRepository'
import { DexieMetadataRepository } from '../data/repositories/metadataRepository'
import type { GeneratedCatalog } from './generatedCatalog'

export const CATALOG_VERSION_METADATA_KEY = 'catalogVersion'
export const CATALOG_SOURCE_COMMIT_METADATA_KEY = 'catalogSourceCommit'

export type SeedOutcome =
  | { status: 'up-to-date'; version: string }
  | { status: 'seeded'; version: string; exerciseCount: number; muscleCount: number }

/** Thrown for any seeding failure so callers (e.g. catalog readiness) can surface it clearly instead of failing silently. */
export class CatalogSeedError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'CatalogSeedError'
  }
}

function isWellFormedCatalog(value: unknown): value is GeneratedCatalog {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GeneratedCatalog>
  return typeof candidate.version === 'string' && candidate.version.length > 0 && Array.isArray(candidate.exercises) && Array.isArray(candidate.muscles)
}

/**
 * Idempotently seeds the generated exercise/muscle catalog into Dexie, keyed
 * by the catalog's content-hash version stored in metadata. Re-running with
 * an unchanged version is a cheap no-op past the version check. Only
 * upserts `source: 'catalog'` rows by id; never deletes any row, so custom
 * exercises and all other user data are always preserved.
 */
export async function seedCatalog(db: RepwiseDatabase, loadCatalog: () => Promise<GeneratedCatalog>): Promise<SeedOutcome> {
  let catalog: GeneratedCatalog
  try {
    const loaded: unknown = await loadCatalog()
    if (!isWellFormedCatalog(loaded)) {
      throw new Error('the generated catalog payload is missing required fields (version/exercises/muscles).')
    }
    catalog = loaded
  } catch (error) {
    if (error instanceof CatalogSeedError) throw error
    throw new CatalogSeedError(`Failed to load the generated exercise catalog: ${error instanceof Error ? error.message : String(error)}`, error)
  }

  const metadataRepo = new DexieMetadataRepository(db)
  const currentVersion = await metadataRepo.get(CATALOG_VERSION_METADATA_KEY)
  if (currentVersion === catalog.version) {
    return { status: 'up-to-date', version: catalog.version }
  }

  const exerciseRepo = new DexieExerciseRepository(db)
  const muscleRepo = new DexieMuscleRepository(db)

  try {
    await db.transaction('rw', db.exercises, db.muscles, db.metadata, async () => {
      await exerciseRepo.bulkUpsert(catalog.exercises)
      await muscleRepo.bulkUpsert(catalog.muscles)
      await metadataRepo.set(CATALOG_VERSION_METADATA_KEY, catalog.version)
      await metadataRepo.set(CATALOG_SOURCE_COMMIT_METADATA_KEY, catalog.sourceCommit)
    })
  } catch (error) {
    throw new CatalogSeedError(`Failed to write the exercise catalog to the local database: ${error instanceof Error ? error.message : String(error)}`, error)
  }

  return { status: 'seeded', version: catalog.version, exerciseCount: catalog.exercises.length, muscleCount: catalog.muscles.length }
}
