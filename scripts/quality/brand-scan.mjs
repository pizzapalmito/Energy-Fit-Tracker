import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const root = resolve('.')
const excluded = new Set(['.git', 'node_modules', 'dist', 'playwright-report', 'test-results'])
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.txt', '.yml', '.yaml'])
const joined = ['fit', 'bod'].join('')
const forbidden = [joined, `${joined}.com`, ['fit', ' bod'].join('')]
const failures = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue
    const path = resolve(directory, entry.name)
    const name = relative(root, path).replaceAll('\\', '/')
    if (forbidden.some((term) => name.toLowerCase().includes(term))) failures.push(`${name}: forbidden filename`)
    if (entry.isDirectory()) await walk(path)
    else if (textExtensions.has(extname(entry.name).toLowerCase())) {
      const lines = (await readFile(path, 'utf8')).split(/\r?\n/)
      lines.forEach((line, index) => { if (forbidden.some((term) => line.toLowerCase().includes(term))) failures.push(`${name}:${index + 1}`) })
    }
  }
}

await walk(root)
if (failures.length > 0) {
  console.error(`Forbidden brand scan failed:\n${failures.join('\n')}`)
  process.exitCode = 1
} else console.log('Forbidden brand scan PASS')
