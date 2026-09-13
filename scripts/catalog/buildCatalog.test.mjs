import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { measureTree } from './buildCatalog.mjs'

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function inventoryWithJson(contents) {
  const root = mkdtempSync(join(tmpdir(), 'repwise-inventory-'))
  temporaryDirectories.push(root)
  const exercise = join(root, 'exercise')
  mkdirSync(exercise)
  writeFileSync(join(exercise, 'exercise.json'), contents, 'utf8')
  writeFileSync(join(exercise, 'image.jpg'), Buffer.from([0, 1, 2, 3]))
  return measureTree(root)
}

describe('catalog source inventory', () => {
  it('is invariant to Git LF versus CRLF text checkouts', () => {
    const lf = inventoryWithJson('{\n  "name": "Press"\n}\n')
    const crlf = inventoryWithJson('{\r\n  "name": "Press"\r\n}\r\n')

    expect(crlf).toEqual(lf)
    expect(lf.directDirCount).toBe(1)
  })
})
