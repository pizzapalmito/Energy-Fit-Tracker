import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const release = JSON.parse(readFileSync('docs/catalog/muscle-images/manifest.json', 'utf8')) as { exercises: Array<{ id: string; candidateId: string; outputSha256: string }> }
const catalog = JSON.parse(readFileSync('public/catalog/catalog.json', 'utf8')) as { version: string; exercises: Array<{ id: string; name: string }> }
const selectedIds = new Set(['lying-close-grip-barbell-triceps-press-to-chin', 'lying-triceps-press', 'zottman-preacher-curl', 'upright-cable-row', 'wide-stance-barbell-squat', 'kettlebell-halo-with-overhead-extension'])
const selected = release.exercises.filter(e => selectedIds.has(e.id)).map(e => ({ ...e, output: { sha256: e.outputSha256 } }))
const target = { exercises: selected }

test(`shows the ${target.exercises.length} approved composites without cropping or obsolete frame controls`, async ({ page, context, browserName }, testInfo) => {
  expect(selected).toHaveLength(target.exercises.length)
  expect(selected.length).toBeGreaterThan(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/exercises')
  await expect(page.getByText(`${catalog.exercises.length} of ${catalog.exercises.length} exercises`)).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(page.getByText(`${catalog.exercises.length} of ${catalog.exercises.length} exercises`)).toBeVisible()
  // Windows WebKit offline emulation is unreliable; Chromium proves cached bytes.
  if (browserName === 'chromium') await context.setOffline(true)
  // Verify both displayed slots for the entire 347-image release, offline in Chromium.
  const mismatches = await page.evaluate(async entries => {
    const failures: string[] = []
    const jobs = entries.flatMap(entry => ['start', 'end'].map(frame => ({ ...entry, frame })))
    let next = 0
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (next < jobs.length) {
        const entry = jobs[next++]
        if (!entry) break
        const response = await fetch(new URL('catalog/media/' + entry.id + '/' + entry.frame + '.webp', document.baseURI))
        if (!response.ok) { failures.push(entry.id + '/' + entry.frame); continue }
        const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer())
        const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
        if (hash !== entry.outputSha256) failures.push(entry.id + '/' + entry.frame)
      }
    }))
    return failures
  }, release.exercises)
  expect(release.exercises).toHaveLength(347)
  expect(mismatches).toEqual([])

  for (const candidate of selected) {
    const exercise = catalog.exercises.find((entry) => entry.id === candidate.id)!
    await page.getByLabel('Search', { exact: true }).fill(exercise.name)
    await page.getByRole('button').filter({ has: page.getByText(exercise.name, { exact: true }) }).click()
    const dialog = page.getByRole('dialog', { name: exercise.name, exact: true })
    const image = dialog.getByRole('img', { name: exercise.name, exact: true })
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth === 768)).toBe(true)
    await expect(dialog.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'End', exact: true })).toHaveCount(0)
    expect(await image.evaluate((element) => getComputedStyle(element).objectFit)).toBe('contain')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const bounds = await image.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
    const bytes = await image.evaluate(async (element: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(element.currentSrc)).arrayBuffer())))
    expect(createHash('sha256').update(Buffer.from(bytes)).digest('hex')).toBe(candidate.output.sha256)
    await page.screenshot({ path: testInfo.outputPath(`${candidate.id}-390.png`) })
    await dialog.getByRole('button', { name: 'Close exercise details' }).click()
  }
  await context.setOffline(false)
})

if (selected.some((entry) => entry.id === 'kettlebell-halo-with-overhead-extension')) {
  test('updates a previously seeded missing-image entry while retaining custom and historical records', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./#/exercises')
    await expect(page.getByText(`${catalog.exercises.length} of ${catalog.exercises.length} exercises`)).toBeVisible({ timeout: 30_000 })
    const previousVersion = 'catalog-ce2b95aa0679ef1c'
    const retained = await page.evaluate(async (version) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('repwise')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB request failed'))
      })
      const exercise = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = db.transaction('exercises').objectStore('exercises').get('kettlebell-halo-with-overhead-extension')
        request.onsuccess = () => resolve(request.result as Record<string, unknown>)
        request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB request failed'))
      })
      const custom = { ...exercise, id: 'media-upgrade-custom', name: 'Media upgrade custom', source: 'custom', category: 'custom', instructions: ['Keep my custom instructions.'], media: ['custom-local-image'] }
      const workout = { id: 'media-upgrade-workout', date: '2026-10-01', startTime: '2026-10-01T12:00:00Z', endTime: '2026-10-01T12:01:00Z', name: 'Retained history', notes: 'Keep this history.', status: 'completed' }
      const historical = { id: 'media-upgrade-workout-exercise', workoutId: workout.id, exerciseId: exercise.id, order: 0, notes: 'Retain snapshot.', restSeconds: 60, snapshot: { name: exercise.name, equipment: exercise.equipment, movementPattern: exercise.movementPattern, muscles: exercise.muscles, catalogVersion: version } }
      const tx = db.transaction(['exercises', 'metadata', 'workouts', 'workoutExercises'], 'readwrite')
      const complete = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error(tx.error?.message ?? 'IndexedDB transaction failed')); tx.onabort = () => reject(new Error(tx.error?.message ?? 'IndexedDB transaction failed')) })
      tx.objectStore('exercises').put({ ...exercise, media: [] })
      tx.objectStore('exercises').put(custom)
      tx.objectStore('metadata').put({ key: 'catalogVersion', value: version })
      tx.objectStore('workouts').put(workout)
      tx.objectStore('workoutExercises').put(historical)
      await complete
      db.close()
      return { custom, workout, historical }
    }, previousVersion)
    await page.reload()
    await expect(page.getByText(`${catalog.exercises.length + 1} of ${catalog.exercises.length + 1} exercises`)).toBeVisible({ timeout: 30_000 })
    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('repwise')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB request failed'))
      })
      const get = (table: string, key: string) => new Promise<unknown>((resolve, reject) => {
        const request = db.transaction(table).objectStore(table).get(key)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB request failed'))
      })
      const [halo, custom, workout, historical, version] = await Promise.all([get('exercises', 'kettlebell-halo-with-overhead-extension'), get('exercises', 'media-upgrade-custom'), get('workouts', 'media-upgrade-workout'), get('workoutExercises', 'media-upgrade-workout-exercise'), get('metadata', 'catalogVersion')])
      db.close()
      return { halo: halo as { media: string[] }, custom, workout, historical, version }
    })
    expect(stored.version).toEqual({ key: 'catalogVersion', value: catalog.version })
    expect(stored.halo.media).toEqual(['media/kettlebell-halo-with-overhead-extension/start.webp', 'media/kettlebell-halo-with-overhead-extension/end.webp'])
    expect(stored.custom).toEqual(retained.custom)
    expect(stored.workout).toEqual(retained.workout)
    expect(stored.historical).toEqual(retained.historical)
    const name = catalog.exercises.find((entry) => entry.id === 'kettlebell-halo-with-overhead-extension')!.name
    await page.getByLabel('Search', { exact: true }).fill(name)
    await page.getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).click()
    const image = page.getByRole('dialog', { name, exact: true }).getByRole('img', { name, exact: true })
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth === 768)).toBe(true)
  })
}
