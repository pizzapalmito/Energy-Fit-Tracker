import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { buildCatalog, writeCatalogOutput } from './buildCatalog.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function parseArgs(argv) {
  const args = { source: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    if ((argv[i] === '--source' || argv[i] === '-s') && argv[i + 1]) {
      args.source = argv[i + 1]
      i += 1
    }
  }
  return args
}

async function main() {
  const { source } = parseArgs(process.argv.slice(2))
  if (!source) {
    console.error('Usage: node scripts/catalog/cli-build.mjs --source <path-to-pinned-free-exercise-db-checkout>')
    process.exitCode = 1
    return
  }

  const result = await buildCatalog({ sourceDir: source, repoRoot })
  const publicCatalogDir = join(repoRoot, 'public', 'catalog')
  const auditReportPath = join(repoRoot, 'docs', 'catalog', 'audit-report.json')
  writeCatalogOutput(result, { publicCatalogDir, auditReportPath })

  const licenseSrc = join(source, 'LICENSE.md')
  if (existsSync(licenseSrc)) {
    const licenseOutDir = join(repoRoot, 'docs', 'licenses')
    mkdirSync(licenseOutDir, { recursive: true })
    writeFileSync(join(licenseOutDir, 'free-exercise-db-LICENSE.txt'), readFileSync(licenseSrc, 'utf8'), 'utf8')
  }

  const { audit } = result
  console.log(`Catalog version: ${audit.catalogVersion}`)
  console.log(`Source commit:   ${audit.sourceCommit}`)
  console.log(`Input records:   ${audit.counts.inputRecords}`)
  console.log(`Accepted:        ${audit.counts.acceptedExercises}`)
  console.log(`Rejected:        ${audit.counts.rejectedRecords}`)
  console.log(`Muscles:         ${audit.counts.musclesDiscovered}`)
  console.log(`Media converted: ${audit.media.convertedImages} / ${audit.media.referencedImagePaths} referenced`)
  console.log(`Missing media:   ${audit.media.missingImages.length}`)
  console.log(`JPG bytes in:    ${audit.media.inputBytesJpg}`)
  console.log(`WebP bytes out:  ${audit.media.outputBytesWebp}`)
  console.log(`catalog.json:    ${audit.catalogJsonBytes} bytes`)
  console.log(`Wrote catalog + media to ${publicCatalogDir}`)
  console.log(`Wrote audit report to ${auditReportPath}`)
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exitCode = 1
})
