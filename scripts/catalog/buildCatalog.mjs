import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import sharp from 'sharp'
import { resolveGitHead } from './gitHead.mjs'
import { PINNED_UPSTREAM_COMMIT } from './pinnedSource.mjs'
import { loadRealImporter } from './compileImporter.mjs'
import { sha256Hex, stableStringify } from './hash.mjs'
import { concurrentMap } from './concurrentMap.mjs'
import { MAX_ASSET_BYTES } from './limits.mjs'

export const WEBP_CONVERSION_SETTINGS = { format: 'webp', quality: 78, effort: 4 }
const MEDIA_CONCURRENCY = 16

const SCHEMA_BREAKING_REASONS = ['root value is not an array', 'record is not an object']

function isSchemaBreaking(reason) {
  return SCHEMA_BREAKING_REASONS.some((prefix) => reason.startsWith(prefix))
}
function isDuplicateId(reason) {
  return reason.includes('duplicate id')
}

/** Recursively sums file bytes and directory count under `dir` (used only to corroborate the documented upstream inventory, not for the transformation itself). */
function reproducibleFileSize(path) {
  if (extname(path).toLowerCase() !== '.json') return statSync(path).size

  // Git may check text files out as CRLF on Windows and LF on Linux. The
  // inventory is provenance evidence, so measure JSON's canonical LF form
  // instead of making the committed audit depend on the builder's platform.
  const buffer = readFileSync(path)
  return Buffer.byteLength(buffer.toString('utf8').replaceAll('\r\n', '\n'), 'utf8')
}

export function measureTree(dir) {
  let bytes = 0
  let directDirCount = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      directDirCount += 1
      const sub = measureTree(full)
      bytes += sub.bytes
    } else if (entry.isFile()) {
      bytes += reproducibleFileSize(full)
    }
  }
  return { bytes, directDirCount }
}

function mediaOutputName(index) {
  if (index === 0) return 'start.webp'
  if (index === 1) return 'end.webp'
  return `frame-${index}.webp`
}

function validateSource(sourceDir) {
  if (!existsSync(sourceDir)) {
    throw new Error(`Pinned upstream source directory does not exist: "${sourceDir}"`)
  }
  const head = resolveGitHead(sourceDir)
  if (head !== PINNED_UPSTREAM_COMMIT) {
    throw new Error(
      `Upstream source at "${sourceDir}" is checked out at ${head}, but the pinned commit is ${PINNED_UPSTREAM_COMMIT}. Refusing to build from an unpinned revision.`,
    )
  }
  const combinedJsonPath = join(sourceDir, 'dist', 'exercises.json')
  if (!existsSync(combinedJsonPath)) {
    throw new Error(`Expected combined catalog JSON at "${combinedJsonPath}" but it was not found.`)
  }
  const exercisesDir = join(sourceDir, 'exercises')
  if (!existsSync(exercisesDir)) {
    throw new Error(`Expected per-exercise media directory at "${exercisesDir}" but it was not found.`)
  }
  return { combinedJsonPath, exercisesDir, head }
}

/**
 * Builds the deterministic Energy Fit Tracker exercise catalog + optimized WebP media
 * from a pinned, verified checkout of free-exercise-db. Never touches the
 * network. Writes nothing until validation and normalization succeed for the
 * whole input; schema-breaking errors or duplicate normalized ids abort the
 * build with no partial output.
 */
export async function buildCatalog({ sourceDir, repoRoot }) {
  const { combinedJsonPath, exercisesDir } = validateSource(sourceDir)

  let raw
  try {
    raw = JSON.parse(readFileSync(combinedJsonPath, 'utf8'))
  } catch (error) {
    throw new Error(`Failed to parse combined catalog JSON at "${combinedJsonPath}": ${error.message}`)
  }
  const inputRecordCount = Array.isArray(raw) ? raw.length : 0

  const { importCatalog, CATALOG_IMPORTER_VERSION, CATALOG_CURATION_VERSION } = loadRealImporter(repoRoot)
  const { exercises, muscles, rejected, curatedOutCount } = importCatalog(raw)

  const fatalRejections = rejected.filter((r) => isSchemaBreaking(r.reason) || isDuplicateId(r.reason))
  if (fatalRejections.length > 0) {
    const details = fatalRejections.map((r) => `  [index ${r.index}] ${r.reason}`).join('\n')
    throw new Error(`Catalog build aborted: ${fatalRejections.length} schema-breaking/duplicate-id record(s):\n${details}`)
  }

  exercises.sort((a, b) => a.id.localeCompare(b.id))
  muscles.sort((a, b) => a.id.localeCompare(b.id))

  const missingImages = []
  const perExerciseMediaHashes = {}
  let inputBytesJpg = 0
  let outputBytesWebp = 0
  let convertedImages = 0
  let referencedImagePaths = 0
  const mediaFiles = []
  const oversizedAssets = []

  await concurrentMap(exercises, MEDIA_CONCURRENCY, async (exercise) => {
    const originalMedia = exercise.media
    const rewritten = []
    for (let index = 0; index < originalMedia.length; index += 1) {
      referencedImagePaths += 1
      const relSourcePath = originalMedia[index]
      const absSourcePath = join(exercisesDir, relSourcePath)
      if (!existsSync(absSourcePath)) {
        missingImages.push({ exerciseId: exercise.id, index, path: relSourcePath })
        continue
      }
      const inputBuffer = readFileSync(absSourcePath)
      inputBytesJpg += inputBuffer.byteLength
      const outputBuffer = await sharp(inputBuffer)
        .webp({ quality: WEBP_CONVERSION_SETTINGS.quality, effort: WEBP_CONVERSION_SETTINGS.effort })
        .toBuffer()
      outputBytesWebp += outputBuffer.byteLength
      if (outputBuffer.byteLength > MAX_ASSET_BYTES) {
        oversizedAssets.push({ exerciseId: exercise.id, path: `media/${exercise.id}/${mediaOutputName(index)}`, bytes: outputBuffer.byteLength })
      }

      const outName = mediaOutputName(index)
      const outRelPath = `media/${exercise.id}/${outName}`
      mediaFiles.push({ relPath: outRelPath, buffer: outputBuffer })
      rewritten.push(outRelPath)
      convertedImages += 1

      const slot = index === 0 ? 'start' : index === 1 ? 'end' : `frame-${index}`
      perExerciseMediaHashes[exercise.id] = { ...perExerciseMediaHashes[exercise.id], [slot]: sha256Hex(outputBuffer) }
    }
    exercise.media = rewritten
  })

  if (oversizedAssets.length > 0) {
    const details = oversizedAssets.map((a) => `  ${a.path} (${a.bytes} bytes)`).join('\n')
    throw new Error(`Catalog build aborted: ${oversizedAssets.length} media asset(s) exceed the ${MAX_ASSET_BYTES}-byte precache limit:\n${details}`)
  }

  const catalogPayload = {
    sourceCommit: PINNED_UPSTREAM_COMMIT,
    importerVersion: CATALOG_IMPORTER_VERSION,
    curationVersion: CATALOG_CURATION_VERSION,
    exercises,
    muscles,
  }
  const version = `catalog-${sha256Hex(stableStringify(catalogPayload)).slice(0, 16)}`
  const catalog = { version, ...catalogPayload }
  const catalogJsonText = JSON.stringify(catalog, null, 2) + '\n'
  const catalogJsonBytes = Buffer.byteLength(catalogJsonText, 'utf8')
  if (catalogJsonBytes > MAX_ASSET_BYTES) {
    throw new Error(`Catalog build aborted: catalog.json is ${catalogJsonBytes} bytes, exceeding the ${MAX_ASSET_BYTES}-byte precache limit.`)
  }

  let observedInventory
  try {
    const measured = measureTree(exercisesDir)
    observedInventory = { exerciseDirectories: measured.directDirCount, totalBytes: measured.bytes }
  } catch {
    observedInventory = null
  }

  const audit = {
    buildToolVersion: 'catalog-build-v2',
    sourceCommit: PINNED_UPSTREAM_COMMIT,
    importerVersion: CATALOG_IMPORTER_VERSION,
    license: { name: 'Unlicense', upstreamFile: 'LICENSE.md' },
    observedUpstreamInventory: observedInventory,
    counts: {
      inputRecords: inputRecordCount,
      normalizedExercises: exercises.length + curatedOutCount,
      acceptedExercises: exercises.length,
      curatedOutExercises: curatedOutCount,
      rejectedRecords: rejected.length,
      musclesDiscovered: muscles.length,
    },
    rejected: rejected.map((r) => ({ index: r.index, reason: r.reason })).sort((a, b) => a.index - b.index),
    media: {
      referencedImagePaths,
      convertedImages,
      missingImages: missingImages.sort((a, b) => (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : a.index - b.index)),
      inputBytesJpg,
      outputBytesWebp,
      conversionSettings: WEBP_CONVERSION_SETTINGS,
    },
    perExerciseMediaHashes,
    catalogVersion: version,
    catalogJsonSha256: sha256Hex(catalogJsonText),
    catalogJsonBytes,
    maxAssetBytes: MAX_ASSET_BYTES,
  }

  return { catalog, catalogJsonText, audit, mediaFiles }
}

export function writeCatalogOutput({ catalogJsonText, mediaFiles, audit }, { publicCatalogDir, auditReportPath }) {
  mkdirSync(publicCatalogDir, { recursive: true })
  // The media tree is generated exclusively from this catalog. Replacing it
  // prevents media for removed exercises from remaining in the shipped PWA.
  rmSync(join(publicCatalogDir, 'media'), { recursive: true, force: true })
  writeFileSync(join(publicCatalogDir, 'catalog.json'), catalogJsonText, 'utf8')
  for (const file of mediaFiles) {
    const absPath = join(publicCatalogDir, file.relPath)
    mkdirSync(dirname(absPath), { recursive: true })
    writeFileSync(absPath, file.buffer)
  }
  mkdirSync(dirname(auditReportPath), { recursive: true })
  writeFileSync(auditReportPath, JSON.stringify(audit, null, 2) + '\n', 'utf8')
}
