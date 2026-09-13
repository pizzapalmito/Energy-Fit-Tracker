import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { buildCatalog, writeCatalogOutput } from './buildCatalog.mjs'
import { sha256OfFile, stableStringify } from './hash.mjs'

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

function collectAbsoluteFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectAbsoluteFiles(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

function walkFiles(dir) {
  return collectAbsoluteFiles(dir)
    .map((f) => relative(dir, f).split(sep).join('/'))
    .sort()
}

async function main() {
  const { source } = parseArgs(process.argv.slice(2))
  if (!source) {
    console.error('Usage: node scripts/catalog/cli-check.mjs --source <path-to-pinned-free-exercise-db-checkout>')
    process.exitCode = 1
    return
  }

  const committedCatalogDir = join(repoRoot, 'public', 'catalog')
  const committedAuditPath = join(repoRoot, 'docs', 'catalog', 'audit-report.json')
  if (!existsSync(join(committedCatalogDir, 'catalog.json')) || !existsSync(committedAuditPath)) {
    console.error('No committed catalog/audit report found. Run `npm run catalog:build -- --source <path>` first.')
    process.exitCode = 1
    return
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), 'repwise-catalog-check-'))
  const failures = []
  try {
    const fresh = await buildCatalog({ sourceDir: source, repoRoot })
    const freshCatalogDir = join(tmpRoot, 'public-catalog')
    const freshAuditPath = join(tmpRoot, 'audit-report.json')
    writeCatalogOutput(fresh, { publicCatalogDir: freshCatalogDir, auditReportPath: freshAuditPath })

    const committedCatalogJson = readFileSync(join(committedCatalogDir, 'catalog.json'), 'utf8')
    if (committedCatalogJson !== fresh.catalogJsonText) {
      failures.push('catalog.json content differs from a fresh regeneration of the pinned source.')
    }

    const committedAudit = JSON.parse(readFileSync(committedAuditPath, 'utf8'))
    if (stableStringify(committedAudit) !== stableStringify(fresh.audit)) {
      failures.push('audit-report.json differs from a fresh regeneration of the pinned source.')
    }

    const committedMediaFiles = walkFiles(committedCatalogDir).filter((f) => f !== 'catalog.json')
    const freshMediaFiles = walkFiles(freshCatalogDir).filter((f) => f !== 'catalog.json')
    const committedSet = new Set(committedMediaFiles)
    const freshSet = new Set(freshMediaFiles)

    const missingFromCommitted = freshMediaFiles.filter((f) => !committedSet.has(f))
    const extraInCommitted = committedMediaFiles.filter((f) => !freshSet.has(f))
    if (missingFromCommitted.length > 0) failures.push(`${missingFromCommitted.length} media file(s) are missing from the committed bundle, e.g. ${missingFromCommitted[0]}`)
    if (extraInCommitted.length > 0) failures.push(`${extraInCommitted.length} media file(s) in the committed bundle are not produced by a fresh build, e.g. ${extraInCommitted[0]}`)

    let mismatchedCount = 0
    let firstMismatch
    for (const relPath of committedMediaFiles) {
      if (!freshSet.has(relPath)) continue
      const committedHash = sha256OfFile(join(committedCatalogDir, relPath))
      const freshHash = sha256OfFile(join(freshCatalogDir, relPath))
      if (committedHash !== freshHash) {
        mismatchedCount += 1
        firstMismatch ??= relPath
      }
    }
    if (mismatchedCount > 0) failures.push(`${mismatchedCount} media file(s) differ in content from a fresh regeneration, e.g. ${firstMismatch}`)

    if (failures.length === 0) {
      console.log('PASS: committed catalog.json, audit-report.json, and all media files match a fresh regeneration of the pinned source.')
      console.log(`Catalog version: ${fresh.audit.catalogVersion}`)
    } else {
      console.error('FAIL: committed generated catalog data does not match the pinned source.')
      for (const f of failures) console.error(`  - ${f}`)
      process.exitCode = 1
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exitCode = 1
})
