import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSelectionPolicy, validateSelectionPolicy } from './selection-policy.mjs'
import { sha256Hex, stableStringify } from './hash.mjs'

export async function checkSelectionPolicy(repoRoot = process.cwd()) {
  const policy = await loadSelectionPolicy(repoRoot)
  const readJson = async path => JSON.parse(await readFile(resolve(repoRoot, path), 'utf8'))
  const manifest = await readJson('docs/catalog/muscle-images/manifest.json')
  const catalog = await readJson('public/catalog/catalog.json')
  const selectable = validateSelectionPolicy(policy, manifest, catalog)
  if (catalog.selectionPolicyVersion !== policy.version) throw new Error('Catalog selection policy is stale; regenerate the catalog')
  const payload = Object.fromEntries(Object.entries(catalog).filter(([key]) => key !== 'version'))
  if (catalog.version !== `catalog-${sha256Hex(stableStringify(payload)).slice(0, 16)}`) throw new Error('Catalog content hash changed')
  for (const exercise of catalog.exercises) {
    if (exercise.excluded !== !selectable.has(exercise.id)) throw new Error(`Exercise retirement changed: ${exercise.id}`)
  }
  for (const entry of manifest.exercises) {
    if (entry.review?.status !== 'approved' || entry.review.appVerified !== true) throw new Error(`Missing approval: ${entry.id}`)
    const paths = [`docs/catalog/muscle-images/${entry.asset}`, ...['start', 'end'].map(frame => `public/catalog/media/${entry.id}/${frame}.webp`)]
    for (const path of paths) {
      if (sha256Hex(await readFile(resolve(repoRoot, path))) !== entry.outputSha256) throw new Error(`Selected image bytes changed: ${path}`)
    }
  }
  return { selectable: selectable.size, retired: policy.retiredCatalog.length, selectedImageSlots: selectable.size * 2 }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkSelectionPolicy().then(result => console.log('Selection policy PASS', result)).catch(error => { console.error(error.message); process.exitCode = 1 })
}
