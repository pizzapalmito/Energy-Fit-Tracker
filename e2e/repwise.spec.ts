import { expect, test } from '@playwright/test'

test.describe('Energy Fit Tracker core offline workflow', () => {
  test('browses the complete local exercise catalog', async ({ page }) => {
    await page.goto('./#/exercises')
    await expect(page).toHaveTitle('Energy Fit Tracker')
    await expect(page.getByText('Energy Fit Tracker', { exact: true }).first()).toBeVisible()
    const appMark = page.locator('header img').first()
    await expect(appMark).toBeVisible()
    await expect(appMark).toHaveAttribute('src', '/Energy-Fit-Tracker/brand/eft-logo.webp')
    await expect.poll(() => appMark.evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
    const energyTheme = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--accent)'
      probe.style.border = '1px solid var(--neon-magenta)'
      probe.style.backgroundColor = 'var(--danger)'
      probe.style.outlineColor = 'var(--neon-orange)'
      document.body.append(probe)
      const probeStyles = getComputedStyle(probe)
      const theme = {
        accentMatchesMagenta: probeStyles.color === probeStyles.borderTopColor,
        dangerMatchesOrange: probeStyles.backgroundColor === probeStyles.outlineColor,
        scanlines: getComputedStyle(document.body, '::before').backgroundImage,
        headerTrail: getComputedStyle(document.querySelector('header')!, '::after').backgroundImage,
      }
      probe.remove()
      return theme
    })
    expect(energyTheme.accentMatchesMagenta).toBe(true)
    expect(energyTheme.dangerMatchesOrange).toBe(true)
    expect(energyTheme.scanlines).toContain('repeating-linear-gradient')
    expect(energyTheme.headerTrail).toContain('linear-gradient')
    await expect(page.getByText('876 of 876 exercises')).toBeVisible({ timeout: 30_000 })
    const firstCatalogName = (await page.locator('main ul > li > button').first().textContent())!
    await page.getByRole('button', { name: 'A–Z ↑' }).click()
    await expect(page.locator('main ul > li > button').first()).not.toHaveText(firstCatalogName)
    await page.getByRole('button', { name: 'Z–A ↓' }).click()
    await expect(page.locator('main ul > li > button').first()).toHaveText(firstCatalogName)
    await page.getByLabel('Search').fill('Barbell Bench Press - Medium Grip')
    await expect(page.getByText('1 of 876 exercises')).toBeVisible()
    await page.getByRole('button', { name: /Barbell Bench Press - Medium Grip/ }).click()
    await expect(page.getByRole('dialog', { name: 'Barbell Bench Press - Medium Grip' })).toBeVisible()
    const demonstration = page.getByRole('dialog', { name: 'Barbell Bench Press - Medium Grip' }).getByRole('img')
    await expect(demonstration).toHaveAttribute('src', /\/Energy-Fit-Tracker\/catalog\/media\/barbell-bench-press-medium-grip\/start\.webp$/)
    await expect.poll(() => demonstration.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect(page.getByRole('heading', { name: 'Instructions' })).toBeVisible()
  })

  test('persists an interrupted workout, set facts, and rest timer', async ({ page }) => {
    await page.goto('./#/today')
    await expect(page.getByText(/Catalog:.*up to date/)).toBeVisible({ timeout: 30_000 })
    await page.locator('main details > summary').first().click()
    await page.getByLabel('Workout name').fill('Offline Push')
    await page.getByRole('button', { name: 'Start workout' }).click()
    await expect(page).toHaveURL(/#\/workout$/)
    await expect(page.getByRole('heading', { name: 'Workout', exact: true })).toBeVisible()
    await expect(page.getByText('Energy Fit Tracker is ready offline')).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: '+ Add exercise' }).click()
    await page.getByLabel('Search exercises').fill('Barbell Bench Press - Medium Grip')
    await page.getByRole('button', { name: /Barbell Bench Press - Medium Grip/ }).click()
    await page.getByRole('button', { name: '+ Add Set' }).click()
    await page.getByRole('button', { name: /View Barbell Bench Press - Medium Grip demonstration/ }).click()
    await expect(page.getByRole('dialog', { name: 'Barbell Bench Press - Medium Grip' })).toBeVisible()
    await page.getByRole('button', { name: 'Close demonstration' }).click()
    await page.getByLabel('Load (kg)').fill('70')
    // Reload while the edited field still owns focus. This guards against losing the
    // latest value when the browser closes or reloads before a blur event.
    await page.reload()
    await expect(page.getByLabel('Load (kg)')).toHaveValue('70')
    // Disclosure must preserve unsaved validation state, not remount the editor.
    const disclosure = page.locator('article button[aria-expanded]').first()
    await page.getByLabel('Load (kg)').fill('-2')
    await expect(page.getByLabel('Load (kg)')).toHaveAttribute('aria-invalid', 'true')
    await disclosure.click()
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await disclosure.press('Enter')
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByLabel('Load (kg)')).toHaveValue('-2')
    await expect(page.getByLabel('Load (kg)')).toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('Load (kg)').fill('70')
    await page.getByLabel('Reps').fill('8')
    await page.getByRole('button', { name: '+ Add Set' }).click()
    await expect(page.getByLabel('Load (kg)')).toHaveCount(2)
    await expect(page.getByLabel('Load (kg)').last()).toHaveValue('70')
    await expect(page.getByLabel('Reps').last()).toHaveValue('8')

    const deleteSecondSet = page.getByRole('button', { name: 'Delete set 2' })
    const secondSetRow = deleteSecondSet.locator('..')
    await secondSetRow.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 140, clientY: 20 })
    await secondSetRow.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 40, clientY: 22 })
    await expect(secondSetRow).toHaveAttribute('data-revealed', 'true')
    await deleteSecondSet.click()
    await expect(page.getByLabel('Load (kg)')).toHaveCount(1)

    await page.getByRole('button', { name: 'Mark complete' }).click()
    await expect(page.getByRole('group', { name: 'Rest timer' })).toBeVisible()
    const completedSetDelete = page.getByRole('button', { name: 'Delete set 1' })
    const completedSetRow = completedSetDelete.locator('..')
    await expect(completedSetRow).toHaveAttribute('data-revealed', 'false')
    expect(await completedSetDelete.evaluate((button) => {
      const bounds = button.getBoundingClientRect()
      const topElement = document.elementFromPoint(bounds.right - 8, bounds.top + bounds.height / 2)
      return topElement === button || button.contains(topElement)
    })).toBe(false)
    const neonOrange = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--neon-orange)'
      probe.style.boxShadow = 'var(--danger-glow)'
      document.body.append(probe)
      const style = getComputedStyle(probe)
      const result = { color: style.color, glow: style.boxShadow }
      probe.remove()
      return result
    })
    expect(neonOrange.color).toBe('rgb(255, 172, 0)')
    expect(neonOrange.glow).not.toBe('none')

    await page.reload()
    await expect(page.getByLabel('Workout name')).toHaveValue('Offline Push')
    await expect(page.getByLabel('Load (kg)')).toHaveValue('70')
    await expect(page.getByLabel('Reps')).toHaveValue('8')
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Rest timer' })).toBeVisible()
    await page.getByRole('link', { name: 'Exercises', exact: true }).click()
    await page.getByLabel('Search').fill('Dumbbell Bench Press')
    await page.getByRole('button', { name: /^Dumbbell Bench Press Chest/ }).click()
    const catalogDetail = page.getByRole('dialog', { name: 'Dumbbell Bench Press', exact: true })
    await catalogDetail.getByRole('button', { name: 'Add to workout', exact: true }).click()
    await expect(catalogDetail.getByText('Added to your workout.')).toBeVisible()
    await catalogDetail.getByRole('link', { name: 'Open workout' }).click()
    await expect(page.getByLabel('Workout name')).toHaveValue('Offline Push')
    await expect(page.locator('main article')).toHaveCount(2)
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(page).toHaveURL(/#\/workout\/summary\//)
    await expect(page.getByRole('heading', { name: /summary/i })).toBeVisible()
    await expect(page.getByText('Offline Push', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Offline Push', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page).toHaveURL(/#\/today$/)
    await expect(page.getByText('Offline Push')).toBeVisible()
    await page.getByRole('link', { name: 'Progress', exact: true }).click()
    await page.getByRole('button', { name: /^Barbell Bench Press - Medium Grip 1 session/ }).click()
    const recordDetail = page.getByRole('dialog', { name: 'Barbell Bench Press - Medium Grip' })
    await expect(recordDetail.getByRole('heading', { name: 'Recent performance' })).toBeVisible()
    await expect(recordDetail.getByText(/70kg × 8/)).toBeVisible()
    await recordDetail.getByRole('button', { name: 'Close exercise details' }).click()
  })

  test('starts the selected built-in rotation day as an editable active workout', async ({ page }) => {
    await page.goto('./#/today')
    await expect(page.getByText(/Catalog:.*up to date/)).toBeVisible({ timeout: 30_000 })
    const program = page.getByRole('region', { name: 'My Program' })
    const dayA = program.locator('article').filter({ hasText: 'Day A' })
    await dayA.getByRole('button', { name: 'Start' }).click()

    await expect(page).toHaveURL(/#\/workout$/)
    await expect(page.getByText('Incline Chest Press Machine', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Reps')).toHaveCount(20)
    await expect(page.getByLabel('Reps').first()).toHaveValue('8')
    await expect(page.getByLabel('Load (kg)').first()).toHaveValue('')
    await page.getByRole('button', { name: 'Discard' }).click()
    await page.getByRole('button', { name: 'Discard' }).last().click()
    await expect(page).toHaveURL(/#\/today$/)
  })

  test('generates a deterministic workout and remains usable offline', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit does not expose reliable offline emulation on Windows.')
    await page.goto('./#/today')
    await expect(page.getByText(/Catalog:.*up to date/)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Generate' }).click()
    await expect(page.getByRole('button', { name: 'Start this workout' })).toBeVisible()
    await expect(page.locator('section').filter({ hasText: 'Build a workout' }).locator('ol > li').first()).toBeVisible()
    await page.getByRole('button', { name: 'Start this workout' }).click()
    await expect(page).toHaveURL(/#\/workout$/)
    await expect(page.getByRole('button', { name: '+ Add Set' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Discard' }).click()
    await page.getByRole('button', { name: 'Discard' }).last().click()
    await expect(page).toHaveURL(/#\/today$/)

    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout: 60_000 })
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    const offlineTypography = await page.evaluate(async () => {
      await document.fonts.ready
      const archivo = Array.from(document.fonts).filter((font) => font.family === 'Archivo')
      return {
        family: getComputedStyle(document.body).fontFamily,
        loaded: archivo.length > 0 && archivo.every((font) => font.status === 'loaded'),
      }
    })
    expect(offlineTypography.family).toContain('Archivo')
    expect(offlineTypography.loaded).toBe(true)
    await page.getByRole('link', { name: 'Exercises' }).click()
    await expect(page.getByText('876 of 876 exercises')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/offline — using local data/)).toHaveCount(0)
  })

  test('changes the interface language in Settings, keeps it across navigation and reload, then restores English', async ({ page }) => {
    await page.goto('./#/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 30_000 })

    const defaultDuration = page.getByLabel('Default workout duration')
    const saveSettings = page.getByRole('button', { name: 'Save settings' })
    await defaultDuration.clear()
    await expect(defaultDuration).toHaveValue('')
    await expect(saveSettings).toBeDisabled()
    await defaultDuration.fill('45')
    await saveSettings.click()
    await expect(page.getByText('Settings saved.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Default workout duration')).toHaveValue('45')

    await page.getByRole('button', { name: 'Français' }).click()
    await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('link', { name: 'Aujourd’hui' }).click()
    await expect(page).toHaveURL(/#\/today$/)
    await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible({ timeout: 30_000 })
    await expect(page.evaluate(() => document.documentElement.lang)).resolves.toBe('fr')

    await page.getByRole('link', { name: 'Réglages' }).click()
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('keeps primary screens and localized navigation within a narrow phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('./#/settings')
    for (const [language, locale] of [['English', 'en'], ['Português (Brasil)', 'pt-BR'], ['Français', 'fr'], ['Español', 'es']]) {
      await page.getByRole('button', { name: language, exact: true }).click()
      await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale)
      for (const route of ['settings', 'today', 'exercises', 'progress', 'workout']) {
        await page.locator(`nav a[href="#/${route}"]`).click()
        await expect(page.locator('main h1')).toBeVisible()
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        const tabs = await page.locator('nav a').evaluateAll((links) => links.map((link) => {
          const rect = link.getBoundingClientRect()
          return { width: rect.width, height: rect.height, left: rect.left, right: rect.right }
        }))
        expect(tabs).toHaveLength(5)
        for (const tab of tabs) {
          expect(tab.width).toBeGreaterThanOrEqual(44)
          expect(tab.height).toBeGreaterThanOrEqual(44)
          expect(tab.left).toBeGreaterThanOrEqual(0)
          expect(tab.right).toBeLessThanOrEqual(321)
        }
      }
      await page.locator('nav a[href="#/settings"]').click()
    }
  })
})
