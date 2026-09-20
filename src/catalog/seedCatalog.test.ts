import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, type RepwiseDatabase } from '../data/db'
import { seedCatalog, CatalogSeedError, CATALOG_VERSION_METADATA_KEY } from './seedCatalog'
import type { GeneratedCatalog } from './generatedCatalog'
import { DexieExerciseRepository } from '../data/repositories/exerciseRepository'
import { DexieMetadataRepository } from '../data/repositories/metadataRepository'
import type { Exercise } from '../domain/models'

let db: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDatabase(`seed-test-${counter}`)
  await db.open()
})

function squat(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'squat',
    name: 'Squat',
    aliases: [],
    category: 'strength',
    movementPattern: 'push',
    difficulty: 'intermediate',
    mechanic: 'compound',
    equipment: ['barbell'],
    instructions: [],
    muscles: [{ muscleId: 'quadriceps', weight: 1 }],
    defaultRestSeconds: 90,
    media: [],
    source: 'catalog',
    excluded: false,
    ...overrides,
  }
}

function customExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'my-custom-move',
    name: 'My Move',
    aliases: [],
    category: 'custom',
    movementPattern: 'unknown',
    difficulty: 'beginner',
    mechanic: 'unknown',
    equipment: ['bodyweight'],
    instructions: [],
    muscles: [{ muscleId: 'quadriceps', weight: 1 }],
    defaultRestSeconds: 60,
    media: [],
    source: 'custom',
    excluded: false,
    ...overrides,
  }
}

function catalog(overrides: Partial<GeneratedCatalog> = {}): GeneratedCatalog {
  return {
    version: 'catalog-aaaa',
    sourceCommit: 'deadbeef',
    importerVersion: 'catalog-importer-v2',
    exercises: [squat()],
    muscles: [{ id: 'quadriceps', name: 'Quadriceps', group: 'legs', aliases: [] }],
    ...overrides,
  }
}

describe('seedCatalog', () => {
  it('seeds exercises and muscles and records the catalog version', async () => {
    const outcome = await seedCatalog(db, () => Promise.resolve(catalog()))
    expect(outcome).toEqual({ status: 'seeded', version: 'catalog-aaaa', exerciseCount: 1, muscleCount: 1 })
    expect(await new DexieExerciseRepository(db).get('squat')).toBeDefined()
    expect(await new DexieMetadataRepository(db).get(CATALOG_VERSION_METADATA_KEY)).toBe('catalog-aaaa')
  })

  it('is idempotent: re-seeding an unchanged version skips the write and reports up-to-date', async () => {
    await seedCatalog(db, () => Promise.resolve(catalog()))
    const bulkUpsertSpy = vi.spyOn(DexieExerciseRepository.prototype, 'bulkUpsert')
    const outcome = await seedCatalog(db, () => Promise.resolve(catalog()))
    expect(outcome).toEqual({ status: 'up-to-date', version: 'catalog-aaaa' })
    expect(bulkUpsertSpy).not.toHaveBeenCalled()
    bulkUpsertSpy.mockRestore()
  })

  it('never deletes existing custom exercises when seeding the catalog', async () => {
    await new DexieExerciseRepository(db).bulkUpsert([customExercise()])
    await seedCatalog(db, () => Promise.resolve(catalog()))
    const custom = await new DexieExerciseRepository(db).get('my-custom-move')
    expect(custom?.source).toBe('custom')
    expect(await new DexieExerciseRepository(db).get('squat')).toBeDefined()
  })

  it('upgrades to a new catalog version and upserts changed rows', async () => {
    await seedCatalog(db, () => Promise.resolve(catalog()))
    const outcome = await seedCatalog(db, () => Promise.resolve(catalog({ version: 'catalog-bbbb', exercises: [squat({ name: 'Back Squat' })] })))
    expect(outcome.status).toBe('seeded')
    expect((await new DexieExerciseRepository(db).get('squat'))?.name).toBe('Back Squat')
    expect(await new DexieMetadataRepository(db).get(CATALOG_VERSION_METADATA_KEY)).toBe('catalog-bbbb')
  })

  it('marks catalog rows removed by a later focused catalog as excluded without touching custom exercises', async () => {
    await seedCatalog(db, () => Promise.resolve(catalog({ exercises: [squat(), squat({ id: 'legacy-stretch', name: 'Legacy Stretch' })] })))
    await new DexieExerciseRepository(db).bulkUpsert([customExercise()])
    await seedCatalog(db, () => Promise.resolve(catalog({ version: 'catalog-focused', exercises: [squat()] })))
    expect((await new DexieExerciseRepository(db).get('legacy-stretch'))?.excluded).toBe(true)
    expect((await new DexieExerciseRepository(db).get('my-custom-move'))?.excluded).toBe(false)
  })

  it('exposes seeding failure clearly when the catalog fails to load, and does not touch the database', async () => {
    await expect(seedCatalog(db, () => Promise.reject(new Error('network down')))).rejects.toBeInstanceOf(CatalogSeedError)
    expect(await new DexieMetadataRepository(db).get(CATALOG_VERSION_METADATA_KEY)).toBeUndefined()
    expect(await new DexieExerciseRepository(db).list()).toHaveLength(0)
  })

  it('rejects a malformed catalog payload clearly instead of writing partial data', async () => {
    await expect(seedCatalog(db, () => Promise.resolve({ version: 'x' } as unknown as GeneratedCatalog))).rejects.toBeInstanceOf(CatalogSeedError)
    expect(await new DexieExerciseRepository(db).list()).toHaveLength(0)
  })
})
