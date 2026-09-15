// Exploratory diagnostic only. Does not replace or satisfy npm run validate / npm run test:e2e.
import { webkit, devices } from '@playwright/test'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { mkdir } from 'node:fs/promises'

const HOST = '127.0.0.1'
const PORT = 4180
const BASE_URL = `http://${HOST}:${PORT}/Energy-Fit-Tracker/`
const SERVER_READY_TIMEOUT_MS = 15_000

function disableDecorativeCompositing() {
  const inject = () => {
    const style = document.createElement('style')
    style.textContent = `
      body::before { display: none !important; }
      header::after { display: none !important; }
      header > div:first-of-type { background: none !important; -webkit-mask-image: none !important; mask-image: none !important; }
      nav { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
      * { text-shadow: none !important; filter: none !important; }
    `
    document.head.appendChild(style)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject)
  else inject()
}

const variants = [
  { name: 'original', setup: async () => {} },
  ...[
    ['text-shadow-disabled', '* { text-shadow: none !important; }'],
    ['filter-disabled', '* { filter: none !important; }'],
    ['hero-disabled', 'header > div:first-of-type { background: none !important; -webkit-mask-image: none !important; mask-image: none !important; }'],
    ['nav-blur-disabled', 'nav { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }'],
  ].map(([name, css]) => ({
    name,
    setup: async (context) => context.addInitScript((rules) => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = rules
        document.head.appendChild(style)
      })
    }, css),
  })),
  { name: 'fonts-aborted', setup: async (context) => { await context.route('**/fonts/**', (route) => route.abort()) } },
  { name: 'decorative-disabled', setup: async (context) => { await context.addInitScript(disableDecorativeCompositing) } },
  {
    name: 'fonts-aborted-decorative-disabled',
    setup: async (context) => {
      await context.route('**/fonts/**', (route) => route.abort())
      await context.addInitScript(disableDecorativeCompositing)
    },
  },
]

async function waitForServerReady(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // server not accepting connections yet
    }
    await delay(300)
  }
  return false
}

async function runVariant(browser, variant) {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
  const pageErrors = []
  let crashed = false
  let page
  try {
    await variant.setup(context)
    page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('crash', () => { crashed = true })

    await page.goto(`${BASE_URL}#/settings`, { timeout: 10_000 })
    await page.getByRole('heading', { name: 'Settings' }).waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByRole('button', { name: 'Français' }).click({ timeout: 10_000 })
    await page.locator('nav a[href="#/today"]').click({ timeout: 10_000 })
    await page.getByRole('heading', { name: 'Aujourd’hui' }).waitFor({ state: 'visible', timeout: 10_000 })
    await page.reload({ timeout: 10_000 })
    await page.getByRole('heading', { name: 'Aujourd’hui' }).waitFor({ state: 'visible', timeout: 10_000 })

    await Promise.race([
      page.evaluate(() => document.fonts.ready.then(() => undefined)),
      delay(10_000).then(() => { throw new Error('Font readiness timed out') }),
    ])
    if (crashed) throw new Error('Page crashed')
    return { variant: variant.name, status: 'PASS', error: null, crashed, pageErrors }
  } catch (error) {
    return { variant: variant.name, status: 'FAIL', error: error?.message ?? String(error), crashed, pageErrors }
  } finally {
    if (page) {
      try {
        await page.screenshot({ path: `test-results/webkit-diagnostic-${variant.name}.png`, timeout: 3_000 })
      } catch {
        // best effort only
      }
    }
    try {
      await context.close()
    } catch {
      // best effort only
    }
  }
}

async function main() {
  await mkdir('test-results', { recursive: true }).catch(() => {})

  const previewProcess = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'],
    { shell: false, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let serverOutput = ''
  previewProcess.stdout?.on('data', (chunk) => { serverOutput += chunk.toString() })
  previewProcess.stderr?.on('data', (chunk) => { serverOutput += chunk.toString() })

  let browser
  const results = []
  try {
    const ready = await waitForServerReady(BASE_URL, SERVER_READY_TIMEOUT_MS)
    if (!ready) {
      console.log('DIAGNOSIS: BLOCKED — preview server did not become ready within 15s')
      console.log(serverOutput)
      return
    }

    browser = await webkit.launch({ headless: true })
    for (const variant of variants) {
      results.push(await runVariant(browser, variant))
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (!previewProcess.killed) previewProcess.kill()
  }

  console.log('\nWebKit diagnostic results:')
  for (const result of results) {
    const crashNote = result.crashed ? ' (page crash detected)' : ''
    const errorNote = result.error ? ` — ${result.error}` : ''
    console.log(`- ${result.variant}: ${result.status}${crashNote}${errorNote}`)
    if (result.pageErrors.length > 0) console.log(`  pageerror events: ${result.pageErrors.join(' | ')}`)
  }
  console.log('\nThis diagnostic is exploratory only. It does not replace or satisfy the mandatory validation suite (npm run validate, npm run test:e2e). Do not treat an expected failure here as a pass.')
}

await main()
