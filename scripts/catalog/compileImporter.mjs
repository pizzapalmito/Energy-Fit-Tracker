import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const require = createRequire(import.meta.url)

// The importer's only runtime (non `import type`) dependency. Both files are
// transpiled per-file (matching the project's own `isolatedModules: true`),
// so TypeScript elides every `import type` and only this relative import
// needs to be mirrored on disk for CommonJS `require` resolution to work.
const RUNTIME_SOURCE_FILES = ['src/engines/shared/muscleContribution.ts', 'src/catalog/importer.ts']

function transpileToCommonJs(sourceText, fileName) {
  const { outputText, diagnostics } = ts.transpileModule(sourceText, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      isolatedModules: true,
    },
  })
  const errors = (diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error)
  if (errors.length > 0) {
    const messages = errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')
    throw new Error(`Failed to transpile ${fileName}:\n${messages}`)
  }
  return outputText
}

/**
 * Compiles the real, tested TypeScript catalog importer to CommonJS in a
 * throwaway temp directory and `require`s it, so the build script runs the
 * exact same normalization/validation logic exercised by
 * src/catalog/importer.test.ts rather than a reimplementation that could
 * drift from it.
 */
export function loadRealImporter(repoRoot) {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'repwise-catalog-importer-'))
  try {
    let importerOutPath
    for (const relPath of RUNTIME_SOURCE_FILES) {
      const srcPath = join(repoRoot, relPath)
      const source = readFileSync(srcPath, 'utf8')
      const compiled = transpileToCommonJs(source, srcPath)
      const outPath = join(tmpRoot, relPath.replace(/\.ts$/, '.js'))
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, compiled, 'utf8')
      if (relPath.endsWith('importer.ts')) importerOutPath = outPath
    }
    const mod = require(importerOutPath)
    if (typeof mod.importCatalog !== 'function') {
      throw new Error('Compiled importer module did not export importCatalog as expected.')
    }
    return {
      importCatalog: mod.importCatalog,
      CATALOG_IMPORTER_VERSION: mod.CATALOG_IMPORTER_VERSION,
      CATALOG_CURATION_VERSION: mod.CATALOG_CURATION_VERSION,
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
}
