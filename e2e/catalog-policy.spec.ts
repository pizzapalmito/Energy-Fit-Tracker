import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Exercise } from '../src/domain/models'

const catalog = JSON.parse(readFileSync('public/catalog/catalog.json', 'utf8')) as { version: string; exercises: Exercise[] }

test('keeps 374 modern exercises and retires Ab Roller after an old backup restore and reload', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/exercises')
  await expect(page.getByText('374 of 374 exercises')).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Search', { exact: true }).fill('Ab Roller')
  await expect(page.getByText('0 of 374 exercises')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ab Roller', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('ab-roller-retired.png') })

  // This is a disposable Playwright database, never the user's browser/profile.
  const old = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('repwise')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB request failed'))
    })
    const tables: Record<string, Array<Record<string, unknown>>> = {}
    await Promise.all(Array.from(db.objectStoreNames).map(async name => {
      tables[name] = await new Promise((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result as Array<Record<string, unknown>>)
        request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB request failed'))
      })
    }))
    const version = db.version / 10
    db.close()
    return { tables, version }
  })
  const roller = { ...catalog.exercises.find(entry => entry.id === 'ab-roller')!, excluded: false }
  const custom = { ...catalog.exercises.find(entry => entry.id === 'barbell-curl')!, id: 'personal-policy-exercise', name: 'Personal policy exercise', source: 'custom', excluded: false, media: [] }
  old.tables.exercises = old.tables.exercises!.filter(e => e.id !== roller.id).concat([roller, custom])
  const workout = { id: 'policy-history', date: '2026-10-01', startTime: '2026-10-01T12:00:00Z', endTime: '2026-10-01T12:10:00Z', name: 'Preserved Ab Roller history', notes: 'Exact history', status: 'completed' }
  const snapshot = { name: roller.name, equipment: roller.equipment, movementPattern: roller.movementPattern, muscles: roller.muscles, catalogVersion: 'pre-policy' }
  const historical = { id: 'policy-history-exercise', workoutId: workout.id, exerciseId: roller.id, order: 0, notes: 'Exact snapshot', restSeconds: 90, snapshot }
  old.tables.workouts!.push(workout)
  old.tables.workoutExercises!.push(historical)
  const payload = { appId: 'repwise', formatVersion: 1, dbSchemaVersion: old.version, catalogVersion: 'pre-policy', exportedAt: '2026-10-15T00:00:00Z', tables: old.tables }
  const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  await page.goto('./#/settings')
  await page.locator('input[type="file"]').setInputFiles({ name: 'pre-policy-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ payload, checksum })) })
  await expect(page.getByRole('button', { name: 'Confirm restore', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click()
  await expect(page.getByText(/^Restored \d+ records\.$/)).toBeVisible()
  await page.goto('./#/exercises')
  await expect(page.getByText('375 of 375 exercises')).toBeVisible()
  await page.getByLabel('Search', { exact: true }).fill('Ab Roller')
  await expect(page.getByText('0 of 375 exercises')).toBeVisible()
  await page.reload()
  await expect(page.getByText('375 of 375 exercises')).toBeVisible()
  const retained = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('repwise'); r.onsuccess = () => resolve(r.result) })
    const get = (table: string, id: string) => new Promise<Record<string, unknown>>(resolve => { const r = db.transaction(table).objectStore(table).get(id); r.onsuccess = () => resolve(r.result as Record<string, unknown>) })
    const result = { roller: await get('exercises', 'ab-roller'), custom: await get('exercises', 'personal-policy-exercise'), history: await get('workoutExercises', 'policy-history-exercise'), workout: await get('workouts', 'policy-history') }
    db.close()
    return result
  })
  expect(retained.roller.excluded).toBe(true)
  expect(retained.custom).toEqual(custom)
  expect(retained.history).toEqual(historical)
  expect(retained.workout).toEqual(workout)
  await page.goto('./#/today')
  await expect(page.getByRole('button', { name: 'Start program', exact: true })).toBeDisabled()
  await expect(page.getByText(/This program includes retired exercises/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('retired-program-safe.png') })
  expect(errors).toEqual([])
})
