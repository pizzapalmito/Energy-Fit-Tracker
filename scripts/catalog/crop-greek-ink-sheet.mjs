import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import sharp from 'sharp'

const [sheetId, sourceImage] = process.argv.slice(2)
if (!sheetId || !sourceImage) {
  throw new Error('Usage: node scripts/catalog/crop-greek-ink-sheet.mjs <sheet-id> <source-image>')
}

const root = process.cwd()
const libraryRoot = resolve(root, 'public/catalog/greek-ink-sheets-v1')
const planPath = resolve(libraryRoot, 'plan.json')
const acceptedPath = resolve(libraryRoot, 'accepted.json')
const sourcePath = resolve(root, sourceImage)
const plan = JSON.parse(await readFile(planPath, 'utf8'))
const accepted = JSON.parse(await readFile(acceptedPath, 'utf8'))
const sheet = plan.sheets.find((candidate) => candidate.id === sheetId)
if (!sheet) throw new Error(`Unknown sheet: ${sheetId}`)
if (!accepted.acceptedSheetIds.includes(sheetId)) {
  throw new Error(`${sheetId} is not accepted; review it before cropping.`)
}
await stat(sourcePath)

const metadata = await sharp(sourcePath).metadata()
if (!metadata.width || !metadata.height) throw new Error('Source image has no dimensions.')
const tileWidth = Math.floor(metadata.width / 3)
const tileHeight = Math.floor(metadata.height / 3)
const inset = 2
const outputDir = resolve(libraryRoot, 'exercises')
await mkdir(outputDir, { recursive: true })

for (const [index, exerciseId] of sheet.exerciseIds.entries()) {
  const column = index % 3
  const row = Math.floor(index / 3)
  const left = column * tileWidth + inset
  const top = row * tileHeight + inset
  const width = Math.min(tileWidth - inset * 2, metadata.width - left - inset)
  const height = Math.min(tileHeight - inset * 2, metadata.height - top - inset)
  await sharp(sourcePath)
    .extract({ left, top, width, height })
    .webp({ quality: 90, effort: 6 })
    .toFile(resolve(outputDir, `${exerciseId}.webp`))
}

accepted.sources ??= {}
accepted.sources[sheetId] = basename(sourcePath)
await writeFile(acceptedPath, `${JSON.stringify(accepted, null, 2)}\n`)
console.log(`Cropped ${sheet.exerciseIds.length} named tiles from ${sheetId}`)
