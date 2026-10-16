import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export async function loadSelectionPolicy(repoRoot) {
  return JSON.parse(await readFile(resolve(repoRoot, 'src/catalog/selection-policy.json'), 'utf8'))
}

/** Approval alone is insufficient: the exact owner-selected version/hash must match. */
export function validateSelectionPolicy(policy, manifest, catalog) {
  if (policy.schemaVersion !== 1 || !policy.version) throw new Error('Invalid selection policy')
  const pinned = new Map(policy.selectable.map(entry => [entry.id, entry]))
  const retired = new Set(policy.retiredCatalog.map(entry => entry.id))
  const catalogIds = new Set(catalog.exercises.map(entry => entry.id))
  if (pinned.size !== policy.selectable.length || pinned.size !== manifest.exercises.length ||
      retired.size !== policy.retiredCatalog.length || [...retired].some(id => pinned.has(id)) ||
      catalogIds.size !== catalog.exercises.length || catalogIds.size !== pinned.size + retired.size ||
      [...pinned.keys(), ...retired].some(id => !catalogIds.has(id))) throw new Error('Selection policy membership changed')
  for (const entry of manifest.exercises) {
    const expected = pinned.get(entry.id)
    if (!expected || expected.candidateId !== entry.candidateId || expected.outputSha256 !== entry.outputSha256) {
      throw new Error(`Selected candidate or image checksum changed: ${entry.id}`)
    }
  }
  return pinned
}
