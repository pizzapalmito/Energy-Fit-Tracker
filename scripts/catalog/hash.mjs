import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex')
}

export function sha256OfFile(path) {
  return sha256Hex(readFileSync(path))
}

/** Deterministic JSON stringification: object keys are sorted recursively so hashing never depends on insertion order. */
export function stableStringify(value) {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    const sorted = {}
    for (const key of Object.keys(value).sort()) sorted[key] = sortKeysDeep(value[key])
    return sorted
  }
  return value
}
