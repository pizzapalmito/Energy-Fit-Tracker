import { describe, expect, it } from 'vitest'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, resolve, basename, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { integrateGreekInkMedia } from './integrate-greek-ink-media.mjs'
import { loadSelectionPolicy, validateSelectionPolicy } from './selection-policy.mjs'
import { checkSelectionPolicy } from './check-selection-policy.mjs'

describe('production catalog policy build gate', () => {
  it('a standalone legacy image overlay cannot replace selected modern artwork or unretire an entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'eft-policy-overlay-'))
    const json = async (path, value) => { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), JSON.stringify(value)) }
    try {
      await json('src/catalog/selection-policy.json', { selectable: [{ id: 'modern' }] })
      const library = 'public/catalog/greek-ink-sheets-v1'
      await json(`${library}/plan.json`, { sheets: [{ id: 'old-sheet', exerciseIds: ['modern', 'ab-roller'] }] })
      await json(`${library}/accepted.json`, { acceptedSheetIds: ['old-sheet'], sources: {} })
      await json('public/catalog/catalog.json', { exercises: ['modern', 'ab-roller'].map(id => ({ id, excluded: false, media: [`media/${id}/start.webp`, `media/${id}/end.webp`] })) })
      await json('docs/catalog/audit-report.json', { media: {} })
      for (const id of ['modern', 'ab-roller']) {
        await mkdir(join(root, library, 'exercises'), { recursive: true })
        await writeFile(join(root, library, `exercises/${id}.webp`), 'old-sheet-tile')
        await mkdir(join(root, 'public/catalog/media', id), { recursive: true })
        for (const slot of ['start', 'end']) await writeFile(join(root, `public/catalog/media/${id}/${slot}.webp`), 'modern-checked-artwork')
      }
      await integrateGreekInkMedia({ repoRoot: root })
      expect((await readFile(join(root, 'public/catalog/media/modern/start.webp'))).toString()).toBe('modern-checked-artwork')
      const catalog = JSON.parse(await readFile(join(root, 'public/catalog/catalog.json'), 'utf8'))
      expect(catalog.exercises.find(e => e.id === 'ab-roller').excluded).toBe(true)
    } finally {
      if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !basename(root).startsWith('eft-policy-overlay-')) throw new Error('Unexpected test cleanup target')
      await rm(root, { recursive: true, force: true })
    }
  })

  it('checks every selected original and both display slots against the pinned hashes', async () => {
    expect(await checkSelectionPolicy()).toEqual({ selectable: 374, retired: 91, selectedImageSlots: 748 })
  })

  it.each(['candidate', 'hash', 'extra-approved', 'missing', 'retired-membership'])('rejects %s drift even when the replacement is labelled approved', async defect => {
    const policy = await loadSelectionPolicy(process.cwd())
    const manifest = JSON.parse(await readFile('docs/catalog/muscle-images/manifest.json', 'utf8'))
    const catalog = JSON.parse(await readFile('public/catalog/catalog.json', 'utf8'))
    if (defect === 'candidate') manifest.exercises[0].candidateId += '-older-approved'
    if (defect === 'hash') manifest.exercises[0].outputSha256 = '0'.repeat(64)
    if (defect === 'extra-approved') manifest.exercises.push({ ...manifest.exercises[0], id: 'ab-roller' })
    if (defect === 'missing') manifest.exercises.pop()
    if (defect === 'retired-membership') catalog.exercises.find(e => e.id === 'ab-roller').id = 'new-upstream-fallback'
    expect(() => validateSelectionPolicy(policy, manifest, catalog)).toThrow()
  })
})
