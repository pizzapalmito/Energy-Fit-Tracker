import type { Exercise } from '../domain/models'
import type { Muscle } from '../data/types'

/** Shape of the deterministic, pre-generated catalog bundle emitted by `npm run catalog:build` into public/catalog/catalog.json. */
export interface GeneratedCatalog {
  version: string
  sourceCommit: string
  importerVersion: string
  exercises: Exercise[]
  muscles: Muscle[]
}
