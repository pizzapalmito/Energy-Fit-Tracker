import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  }))
  return nested.flat()
}

async function convertPngToWebp(path) {
  if (extname(path).toLowerCase() !== '.png') return path
  const target = path.replace(/\.png$/i, '.webp')
  const temporary = `${target}.tmp.webp`
  await sharp(path).webp({ quality: 90, effort: 6 }).toFile(temporary)
  await rename(temporary, target)
  await rm(path)
  return target
}

async function copyIfChanged(source, destination) {
  try {
    const [sourceBytes, destinationBytes] = await Promise.all([readFile(source), readFile(destination)])
    if (sourceBytes.equals(destinationBytes)) return
  } catch {
    // A missing destination must be created below.
  }
  await cp(source, destination)
}

export async function integrateGreekInkMedia({
  repoRoot = process.cwd(),
  publicCatalogDir = resolve(repoRoot, 'public/catalog'),
  auditReportPath = resolve(repoRoot, 'docs/catalog/audit-report.json'),
} = {}) {
  const libraryRoot = resolve(repoRoot, 'public/catalog/greek-ink-sheets-v1')
  const exercisesRoot = resolve(libraryRoot, 'exercises')
  const mediaRoot = resolve(publicCatalogDir, 'media')
  const plan = JSON.parse(await readFile(resolve(libraryRoot, 'plan.json'), 'utf8'))
  const acceptedPath = resolve(libraryRoot, 'accepted.json')
  const accepted = JSON.parse(await readFile(acceptedPath, 'utf8'))
  const catalogPath = resolve(publicCatalogDir, 'catalog.json')
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const audit = JSON.parse(await readFile(auditReportPath, 'utf8'))

  const pngFiles = (await filesUnder(libraryRoot)).filter((path) => extname(path).toLowerCase() === '.png')
  await Promise.all(pngFiles.map(convertPngToWebp))
  accepted.sources = Object.fromEntries(Object.entries(accepted.sources ?? {}).map(([sheetId, source]) => [sheetId, source.replace(/\.png$/i, '.webp')]))
  await writeFile(acceptedPath, `${JSON.stringify(accepted, null, 2)}\n`)

  const acceptedSheets = plan.sheets.filter((sheet) => accepted.acceptedSheetIds.includes(sheet.id))
  const exerciseIds = acceptedSheets.flatMap((sheet) => sheet.exerciseIds)
  const catalogById = new Map(catalog.exercises.map((exercise) => [exercise.id, exercise]))
  for (const exerciseId of exerciseIds) {
    const tile = join(exercisesRoot, `${exerciseId}.webp`)
    await stat(tile)
    const exercise = catalogById.get(exerciseId)
    if (!exercise) throw new Error(`Accepted Greek-ink exercise is absent from the catalog: ${exerciseId}`)
    const destination = join(mediaRoot, exerciseId)
    await mkdir(destination, { recursive: true })
    await copyIfChanged(tile, join(destination, 'start.webp'))
    await copyIfChanged(tile, join(destination, 'end.webp'))
    exercise.media = [`media/${exerciseId}/start.webp`, `media/${exerciseId}/end.webp`]
  }
  const catalogJsonText = `${JSON.stringify(catalog, null, 2)}\n`
  await writeFile(catalogPath, catalogJsonText)

  const bundledMedia = catalog.exercises.flatMap((exercise) => exercise.media.map((relativePath) => ({ exerciseId: exercise.id, frame: relativePath.split('/').at(-1)?.replace(/\.webp$/, ''), path: resolve(publicCatalogDir, relativePath) })))
  const mediaEntries = await Promise.all(bundledMedia.map(async (media) => ({ ...media, bytes: (await stat(media.path)).size, hash: createHash('sha256').update(await readFile(media.path)).digest('hex') })))
  audit.media.referencedImagePaths = mediaEntries.length
  audit.media.convertedImages = mediaEntries.length
  audit.media.outputBytesWebp = mediaEntries.reduce((total, media) => total + media.bytes, 0)
  audit.media.generatedGreekInk = { acceptedSheets: acceptedSheets.length, exerciseTiles: exerciseIds.length, sourceFormat: 'webp', tileFormat: 'webp', exportQuality: 90, exportEffort: 6 }
  audit.catalogJsonSha256 = createHash('sha256').update(catalogJsonText).digest('hex')
  audit.catalogJsonBytes = Buffer.byteLength(catalogJsonText, 'utf8')
  audit.perExerciseMediaHashes = Object.fromEntries(catalog.exercises.filter((exercise) => exercise.media.length > 0).map((exercise) => [exercise.id, Object.fromEntries(mediaEntries.filter((media) => media.exerciseId === exercise.id).map((media) => [media.frame, media.hash]))]))
  await writeFile(auditReportPath, `${JSON.stringify(audit, null, 2)}\n`)
  return { convertedPngFiles: pngFiles.length, integratedExerciseTiles: exerciseIds.length, mediaFiles: mediaEntries.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await integrateGreekInkMedia()
  console.log(`Converted ${result.convertedPngFiles} generated PNG files and integrated ${result.integratedExerciseTiles} Greek-ink exercise tiles.`)
}
