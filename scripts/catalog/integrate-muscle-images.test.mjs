// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sha256Hex as sha256 } from './hash.mjs'
import { exerciseImageSpecification, integrateMuscleImages } from './integrate-muscle-images.mjs'

const roots = [], json = (path, value) => writeFile(path, JSON.stringify(value) + '\n')
afterEach(async () => { for (const root of roots.splice(0)) { if (!resolve(root).startsWith(resolve(tmpdir(), 'eft-muscle-test-'))) throw new Error('Unexpected test cleanup path'); await rm(root, { recursive: true, force: true }) } })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'eft-muscle-test-')); roots.push(root)
  const library = join(root, 'docs/catalog/muscle-images'), catalogDir = join(root, 'public/catalog'), auditPath = join(root, 'docs/catalog/audit-report.json')
  await mkdir(join(library, 'assets'), { recursive: true })
  await mkdir(join(catalogDir, 'media/curl'), { recursive: true })
  await mkdir(join(catalogDir, 'media/plank'), { recursive: true })
  const exercise = { id: 'curl', name: 'Curl', equipment: ['dumbbell'], instructions: ['Curl while keeping upper arms still.'], muscles: [{ muscleId: 'biceps', weight: 1 }], media: ['media/curl/start.webp', 'media/curl/end.webp'] }
  const excluded = { ...exercise, id: 'plank', name: 'Plank', equipment: ['bodyweight'], media: ['media/plank/start.webp', 'media/plank/end.webp'] }
  const bytes = Buffer.from('approved-original-project-art'), original = Buffer.from('original-curl-art')
  const entry = { id: exercise.id, candidateId: 'curl-v2', asset: 'assets/curl.webp', outputSha256: sha256(bytes), sourcePngSha256: 'native-hash', specificationSha256: exerciseImageSpecification(exercise), muscleMappingSha256: sha256(JSON.stringify(exercise.muscles)), review: { status: 'approved', primaryMuscleLocalization: true, anatomyMapping: true, appVerified: true } }
  const manifest = { schemaVersion: 1, style: 'matte-3d-muscle-cutaway-v1', sourceCommit: 'pinned', exercises: [entry] }
  await writeFile(join(library, entry.asset), bytes)
  await json(join(library, 'manifest.json'), manifest)
  await json(join(catalogDir, 'catalog.json'), { version: 'before', sourceCommit: 'pinned', exercises: [exercise, excluded] })
  await json(auditPath, { counts: { acceptedExercises: 2 }, media: { missingImages: [] } })
  for (const frame of ['start', 'end']) { await writeFile(join(catalogDir, `media/curl/${frame}.webp`), original); await writeFile(join(catalogDir, `media/plank/${frame}.webp`), 'excluded-original') }
  return { root, library, catalogDir, auditPath, exercise, excluded, bytes, original, entry, manifest }
}
describe('reviewed muscle image overlay', () => {
  it('replaces both composite slots while retaining other exercises, excluded artwork and catalog facts', async () => {
    const f = await fixture(); expect(await integrateMuscleImages({ repoRoot: f.root })).toEqual({ integrated: 1 })
    for (const frame of ['start', 'end']) { expect(await readFile(join(f.catalogDir, `media/curl/${frame}.webp`))).toEqual(f.bytes); expect((await readFile(join(f.catalogDir, `media/plank/${frame}.webp`))).toString()).toBe('excluded-original') }
    const catalog = JSON.parse(await readFile(join(f.catalogDir, 'catalog.json'), 'utf8')), audit = JSON.parse(await readFile(f.auditPath, 'utf8'))
    expect(catalog.exercises).toEqual([f.exercise, f.excluded]); expect(audit.counts.acceptedExercises).toBe(2)
    expect(audit.catalogVersion).toBe(catalog.version); expect(audit.perExerciseMediaHashes.curl).toEqual({ start: sha256(f.bytes), end: sha256(f.bytes) })
    expect(audit.media.generatedMuscleImages.approvedExerciseCount).toBe(1)
  })
  it('repeats deterministically without changing immutable source artwork or metadata bytes', async () => {
    const f = await fixture(); await integrateMuscleImages({ repoRoot: f.root })
    const before = await Promise.all([join(f.catalogDir, 'catalog.json'), f.auditPath, join(f.library, f.entry.asset)].map(path => readFile(path)))
    await integrateMuscleImages({ repoRoot: f.root })
    expect(await Promise.all([join(f.catalogDir, 'catalog.json'), f.auditPath, join(f.library, f.entry.asset)].map(path => readFile(path)))).toEqual(before)
  })
  it.each(['changed-image', 'changed-mapping', 'unverified', 'excluded', 'duplicate', 'escaped-path'])('rejects %s before changing any displayed artwork', async defect => {
    const f = await fixture()
    if (defect === 'changed-image') await writeFile(join(f.library, f.entry.asset), 'altered')
    if (defect === 'changed-mapping') f.entry.muscleMappingSha256 = 'wrong'
    if (defect === 'unverified') f.entry.review.appVerified = false
    if (defect === 'excluded') { f.entry.id = 'plank'; f.entry.specificationSha256 = exerciseImageSpecification(f.excluded) }
    if (defect === 'duplicate') f.manifest.exercises.push({ ...f.entry })
    if (defect === 'escaped-path') f.entry.asset = '../outside.webp'
    await json(join(f.library, 'manifest.json'), f.manifest)
    const catalogBefore = await readFile(join(f.catalogDir, 'catalog.json'))
    await expect(integrateMuscleImages({ repoRoot: f.root })).rejects.toThrow()
    expect(await readFile(join(f.catalogDir, 'media/curl/start.webp'))).toEqual(f.original)
    expect(await readFile(join(f.catalogDir, 'catalog.json'))).toEqual(catalogBefore)
  })
})
