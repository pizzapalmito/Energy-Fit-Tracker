import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { stableStringify, sha256Hex as sha256 } from './hash.mjs'
import { calisthenicsReason } from './muscle-highlight-scope.mjs'

export const MUSCLE_IMAGE_ROOT = 'docs/catalog/muscle-images'
export function exerciseImageSpecification(exercise) {
  return sha256(JSON.stringify({ name: exercise.name, equipment: exercise.equipment, instructions: exercise.instructions, primaryMuscles: exercise.primaryMuscles, secondaryMuscles: exercise.secondaryMuscles, muscles: exercise.muscles }))
}
function assetPath(root, path) {
  const full = resolve(root, path), rel = relative(root, full)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) throw new Error('Image source must stay inside the image library')
  return full
}
async function writeIfChanged(path, bytes) {
  try { if ((await readFile(path)).equals(bytes)) return } catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

/** Apply the reviewed immutable WebP library after pinned-source and Greek-ink generation. */
export async function integrateMuscleImages({ repoRoot = process.cwd(), publicCatalogDir = resolve(repoRoot, 'public/catalog'), auditReportPath = resolve(repoRoot, 'docs/catalog/audit-report.json') } = {}) {
  const library = resolve(repoRoot, MUSCLE_IMAGE_ROOT)
  const manifest = JSON.parse(await readFile(resolve(library, 'manifest.json'), 'utf8'))
  const catalogPath = resolve(publicCatalogDir, 'catalog.json')
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const audit = JSON.parse(await readFile(auditReportPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || manifest.style !== 'matte-3d-muscle-cutaway-v1' || manifest.sourceCommit !== catalog.sourceCommit || !manifest.exercises?.length) throw new Error('Invalid muscle-image manifest or source commit')
  const catalogById = new Map(catalog.exercises.map(e => [e.id, e])), ids = new Set(), ready = []
  // Fail before changing any files if approval, mechanics, mapping or artwork drifted.
  for (const entry of manifest.exercises) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id)) throw new Error('Invalid or duplicate muscle-image exercise ID')
    ids.add(entry.id)
    const exercise = catalogById.get(entry.id)
    if (!exercise || calisthenicsReason(exercise)) throw new Error(`Exercise is missing or excluded from muscle images: ${entry.id}`)
    if (entry.specificationSha256 !== exerciseImageSpecification(exercise) || entry.muscleMappingSha256 !== sha256(JSON.stringify(exercise.muscles))) throw new Error(`Exercise mechanics or muscle mapping changed: ${entry.id}`)
    if (entry.review?.status !== 'approved' || entry.review.primaryMuscleLocalization !== true || entry.review.anatomyMapping !== true || entry.review.appVerified !== true) throw new Error(`Image lacks complete approval: ${entry.id}`)
    const bytes = await readFile(assetPath(library, entry.asset))
    if (sha256(bytes) !== entry.outputSha256) throw new Error(`Reviewed image bytes changed: ${entry.id}`)
    ready.push({ entry, exercise, bytes })
  }
  for (const { entry, exercise, bytes } of ready) {
    for (const frame of ['start', 'end']) await writeIfChanged(resolve(publicCatalogDir, `media/${entry.id}/${frame}.webp`), bytes)
    exercise.media = [`media/${entry.id}/start.webp`, `media/${entry.id}/end.webp`]
  }
  const payload = Object.fromEntries(Object.entries(catalog).filter(([key]) => key !== 'version'))
  catalog.version = `catalog-${sha256(stableStringify(payload)).slice(0, 16)}`
  const catalogText = `${JSON.stringify(catalog, null, 2)}\n`
  const media = await Promise.all(catalog.exercises.flatMap(exercise => exercise.media.map(async path => {
    const bytes = await readFile(resolve(publicCatalogDir, path))
    return { id: exercise.id, frame: path.split('/').at(-1).replace(/\.webp$/, ''), bytes: bytes.length, hash: sha256(bytes) }
  })))
  audit.catalogVersion = catalog.version
  audit.catalogJsonSha256 = sha256(catalogText)
  audit.catalogJsonBytes = Buffer.byteLength(catalogText)
  audit.media.referencedImagePaths = media.length
  audit.media.convertedImages = media.length
  audit.media.outputBytesWebp = media.reduce((sum, entry) => sum + entry.bytes, 0)
  audit.media.generatedMuscleImages = { style: manifest.style, approvedExerciseCount: ready.length, sourceFormat: 'webp', compositeSlots: true, sourceCommit: manifest.sourceCommit, manifestSha256: sha256(await readFile(resolve(library, 'manifest.json'))), candidates: ready.map(({ entry }) => ({ id: entry.id, candidateId: entry.candidateId, sourcePngSha256: entry.sourcePngSha256, outputSha256: entry.outputSha256, specificationSha256: entry.specificationSha256, muscleMappingSha256: entry.muscleMappingSha256 })) }
  audit.perExerciseMediaHashes = Object.fromEntries(catalog.exercises.filter(exercise => exercise.media.length).map(exercise => [exercise.id, Object.fromEntries(media.filter(entry => entry.id === exercise.id).map(entry => [entry.frame, entry.hash]))]))
  await writeIfChanged(catalogPath, Buffer.from(catalogText))
  await writeIfChanged(auditReportPath, Buffer.from(`${JSON.stringify(audit, null, 2)}\n`))
  return { integrated: ready.length }
}
