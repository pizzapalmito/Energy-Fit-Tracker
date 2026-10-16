import { expect, test } from '@playwright/test'

test('defaults to dark and saves an accessible appearance choice across routes and reloads', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const checkContrast = async () => {
    const ratios = await page.evaluate(() => {
      const probe = document.createElement('span')
      document.body.append(probe)
      const luminance = (token: string) => {
        probe.style.color = `var(${token})`
        const [r, g, b] = getComputedStyle(probe).color.match(/[\d.]+/g)!.slice(0, 3).map((channel) => {
          const value = Number(channel) / 255
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
        })
        return .2126 * r! + .7152 * g! + .0722 * b!
      }
      const bg = luminance('--bg')
      const ratios = ['--text', '--muted', '--green', '--caution'].map((token) => {
        const fg = luminance(token)
        return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05)
      })
      probe.remove()
      return ratios
    })
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
  }
  await page.emulateMedia({ colorScheme: 'light' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/settings')
  const appearance = page.getByRole('group', { name: 'Appearance', exact: true })
  const dark = appearance.getByRole('button', { name: 'Dark', exact: true })
  const light = appearance.getByRole('button', { name: 'Light', exact: true })
  await expect(dark).toBeEnabled()
  await expect(dark).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('dark')
  await checkContrast()
  await page.screenshot({ path: testInfo.outputPath('settings-dark.png'), fullPage: true })

  await light.focus()
  await light.press('Enter')
  await expect(light).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#ece7db')
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('light')
  await checkContrast()
  await page.screenshot({ path: testInfo.outputPath('settings-light.png'), fullPage: true })
  await page.reload()
  await expect(light).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Pounds', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pounds', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await dark.click()
  await expect(dark).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#181a19')
  for (const name of ['Today', 'Workout', 'Exercises', 'Progress', 'Settings']) {
    await page.getByRole('link', { name, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    if (name === 'Today' || name === 'Progress') {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({ path: testInfo.outputPath(`${name.toLowerCase()}-dark.png`), fullPage: true })
    }
  }
  await page.reload()
  await expect(dark).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Pounds', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('changes and restores appearance with the installed offline cache', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Windows WebKit offline emulation is unreliable; Chromium verifies cached operation.')
  await page.goto('./#/settings')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  const light = page.getByRole('button', { name: 'Light', exact: true })
  await light.click()
  await expect(light).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(light).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
