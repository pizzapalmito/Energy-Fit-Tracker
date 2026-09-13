import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { GeneratedCatalog } from './generatedCatalog'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

interface AuditReport {
  sourceCommit: string
  catalogVersion: string
  counts: { inputRecords: number; acceptedExercises: number; rejectedRecords: number; musclesDiscovered: number }
  rejected: Array<{ index: number; reason: string }>
  media: { referencedImagePaths: number; convertedImages: number; missingImages: unknown[] }
  maxAssetBytes: number
}

const catalog = JSON.parse(readFileSync(join(repoRoot, 'public', 'catalog', 'catalog.json'), 'utf8')) as GeneratedCatalog
const auditReport = JSON.parse(readFileSync(join(repoRoot, 'docs', 'catalog', 'audit-report.json'), 'utf8')) as AuditReport

function countFilesRecursively(dir: string): number {
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFilesRecursively(join(dir, entry.name))
    else count += 1
  }
  return count
}

// Aggregate invariants over the real, pinned-source-generated catalog — deliberately not a
// per-record snapshot, which would be brittle across hundreds of upstream records.
describe('generated catalog audit invariants', () => {
  it('is pinned to the expected upstream commit', () => {
    expect(catalog.sourceCommit).toBe('a859101d633a01c4a1a920d6a8ce41dabba0705f')
    expect(auditReport.sourceCommit).toBe(catalog.sourceCommit)
  })

  it('has a content-addressed version consistent with the audit report', () => {
    expect(catalog.version).toMatch(/^catalog-[0-9a-f]{16}$/)
    expect(auditReport.catalogVersion).toBe(catalog.version)
  })

  it('accepted-exercise count matches the audit report and every id is unique', () => {
    expect(catalog.exercises.length).toBeGreaterThan(800)
    expect(catalog.exercises.length).toBe(auditReport.counts.acceptedExercises)
    expect(new Set(catalog.exercises.map((e) => e.id)).size).toBe(catalog.exercises.length)
  })

  it('input/accepted/rejected counts are internally consistent', () => {
    expect(auditReport.counts.inputRecords).toBe(auditReport.counts.acceptedExercises + auditReport.counts.rejectedRecords)
    expect(auditReport.rejected.length).toBe(auditReport.counts.rejectedRecords)
  })

  it('has no schema-breaking or duplicate-id rejections (build would have aborted otherwise)', () => {
    for (const rejection of auditReport.rejected) {
      expect(rejection.reason).not.toContain('duplicate id')
      expect(rejection.reason.startsWith('root value is not an array')).toBe(false)
      expect(rejection.reason.startsWith('record is not an object')).toBe(false)
    }
  })

  it('every exercise has a non-empty name and at least one muscle contribution', () => {
    for (const exercise of catalog.exercises) {
      expect(exercise.name.trim().length).toBeGreaterThan(0)
      expect(exercise.muscles.length).toBeGreaterThan(0)
    }
  })

  it('every exercise media path points at a bundled webp under the exercise id', () => {
    for (const exercise of catalog.exercises) {
      for (const mediaPath of exercise.media) {
        expect(mediaPath).toBe(`media/${exercise.id}/${mediaPath.split('/').pop()}`)
        expect(mediaPath).toMatch(/^media\/[a-z0-9-]+\/(start|end|frame-\d+)\.webp$/)
      }
    }
  })

  it('reports no missing media for the pinned source', () => {
    expect(auditReport.media.missingImages).toEqual([])
    expect(auditReport.media.convertedImages).toBe(auditReport.media.referencedImagePaths)
  })

  it('bundled media file count on disk matches the audit report', () => {
    const mediaCount = countFilesRecursively(join(repoRoot, 'public', 'catalog', 'media'))
    expect(mediaCount).toBe(auditReport.media.convertedImages)
  })

  it('muscle catalog ids are unique and every one is referenced by at least one exercise', () => {
    const muscleIds = new Set(catalog.muscles.map((m) => m.id))
    expect(muscleIds.size).toBe(catalog.muscles.length)
    const referenced = new Set(catalog.exercises.flatMap((e) => e.muscles.map((m) => m.muscleId)))
    for (const id of muscleIds) expect(referenced.has(id)).toBe(true)
  })

  it('every exercise is marked as catalog-sourced and not excluded', () => {
    for (const exercise of catalog.exercises) {
      expect(exercise.source).toBe('catalog')
      expect(exercise.excluded).toBe(false)
    }
  })
})
