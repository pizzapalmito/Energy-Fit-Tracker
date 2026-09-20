import { describe, expect, it } from 'vitest'
import { importCatalog } from './importer'

describe('importCatalog', () => {
  it('normalizes a well-formed free-exercise-db record', () => {
    const result = importCatalog([
      {
        id: '3_4_Sit-Up',
        name: '3/4 Sit-Up',
        force: 'pull',
        level: 'beginner',
        mechanic: null,
        equipment: 'body only',
        primaryMuscles: ['abdominals'],
        secondaryMuscles: [],
        instructions: ['Lie down.', 'Sit up.'],
        category: 'strength',
        images: ['3_4_Sit-Up/0.jpg'],
      },
    ])
    expect(result.rejected).toHaveLength(0)
    expect(result.exercises).toHaveLength(1)
    const [ex] = result.exercises
    expect(ex).toMatchObject({
      id: '3-4-sit-up',
      name: '3/4 Sit-Up',
      movementPattern: 'pull',
      difficulty: 'beginner',
      mechanic: 'unknown',
      equipment: ['bodyweight'],
      defaultRestSeconds: 90,
      media: ['3_4_Sit-Up/0.jpg'],
      source: 'catalog',
      excluded: false,
    })
    expect(ex!.muscles).toEqual([{ muscleId: 'abdominals', weight: 1 }])
  })

  it('derives a stable id from the name when no id is provided', () => {
    const result = importCatalog([{ name: 'Barbell Row', primaryMuscles: ['lats'] }])
    expect(result.exercises[0]?.id).toBe('barbell-row')
  })

  it('maps "expert" level to "advanced" and falls back to intermediate when missing', () => {
    const result = importCatalog([
      { name: 'A', level: 'expert', primaryMuscles: ['chest'] },
      { name: 'B', primaryMuscles: ['chest'] },
      { name: 'C', level: 'not-a-real-level', primaryMuscles: ['chest'] },
    ])
    expect(result.exercises.map((e) => e.difficulty)).toEqual(['advanced', 'intermediate', 'intermediate'])
  })

  it('falls back mechanic to "unknown" for missing/unrecognized values', () => {
    const result = importCatalog([
      { name: 'A', mechanic: 'compound', primaryMuscles: ['chest'] },
      { name: 'B', mechanic: null, primaryMuscles: ['chest'] },
      { name: 'C', mechanic: 'weird', primaryMuscles: ['chest'] },
    ])
    expect(result.exercises.map((e) => e.mechanic)).toEqual(['compound', 'unknown', 'unknown'])
  })

  it('assigns primary weight 1 and secondary weight 0.5', () => {
    const result = importCatalog([{ name: 'Bench', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] }])
    expect(result.exercises[0]?.muscles).toEqual(
      expect.arrayContaining([
        { muscleId: 'chest', weight: 1 },
        { muscleId: 'triceps', weight: 0.5 },
      ]),
    )
  })

  it('produces a deduplicated muscle catalog with body-region groups', () => {
    const result = importCatalog([
      { name: 'Bench', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] },
      { name: 'Dip', primaryMuscles: ['chest', 'triceps'] },
    ])
    expect(result.muscles).toHaveLength(2)
    expect(result.muscles.find((m) => m.id === 'chest')?.group).toBe('chest')
    expect(result.muscles.find((m) => m.id === 'triceps')?.group).toBe('arms')
  })

  it('defaults missing/null equipment to bodyweight', () => {
    const result = importCatalog([{ name: 'Push-Up', primaryMuscles: ['chest'], equipment: null }])
    expect(result.exercises[0]?.equipment).toEqual(['bodyweight'])
  })

  it('derives default rest seconds from category with a fallback', () => {
    const result = importCatalog([
      { name: 'A', primaryMuscles: ['chest'], category: 'powerlifting' },
      { name: 'B', primaryMuscles: ['chest'], category: 'stretching' },
      { name: 'C', primaryMuscles: ['chest'], category: 'unknown-category' },
      { name: 'D', primaryMuscles: ['chest'] },
    ])
    expect(result.exercises.map((e) => e.defaultRestSeconds)).toEqual([180, 30, 90, 90])
  })

  it('rejects records with a missing or empty name', () => {
    const result = importCatalog([{ name: '', primaryMuscles: ['chest'] }, { primaryMuscles: ['chest'] }])
    expect(result.exercises).toHaveLength(0)
    expect(result.rejected).toHaveLength(2)
    expect(result.rejected.every((r) => r.reason.includes('name'))).toBe(true)
  })

  it('rejects records with no primary or secondary muscles', () => {
    const result = importCatalog([{ name: 'Mystery Move' }])
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]?.reason).toContain('muscle')
  })

  it('quarantines duplicate ids, keeping the first occurrence', () => {
    const result = importCatalog([
      { id: 'row', name: 'Row', primaryMuscles: ['lats'] },
      { id: 'row', name: 'Row Variant', primaryMuscles: ['lats'] },
    ])
    expect(result.exercises).toHaveLength(1)
    expect(result.exercises[0]?.name).toBe('Row')
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]?.reason).toContain('duplicate')
  })

  it('rejects non-object records without guessing', () => {
    const result = importCatalog(['not-an-object', 42, null])
    expect(result.exercises).toHaveLength(0)
    expect(result.rejected).toHaveLength(3)
  })

  it('rejects a non-array root value', () => {
    const result = importCatalog({ not: 'an array' })
    expect(result.exercises).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
  })

  it('deduplicates a muscle name repeated within the same array', () => {
    const result = importCatalog([{ name: 'Bench', primaryMuscles: ['chest', 'chest'] }])
    expect(result.exercises[0]?.muscles).toEqual([{ muscleId: 'chest', weight: 1 }])
  })

  it('deduplicates case and spacing variants of the same muscle name', () => {
    const result = importCatalog([{ name: 'Row', primaryMuscles: [' Lower Back ', 'lower back', 'LOWER BACK'] }])
    expect(result.exercises[0]?.muscles).toEqual([{ muscleId: 'lower-back', weight: 1 }])
  })

  it('gives primary contribution precedence when the same muscle appears in both arrays', () => {
    const result = importCatalog([{ name: 'Dip', primaryMuscles: ['chest'], secondaryMuscles: ['Chest', 'triceps'] }])
    expect(result.exercises[0]?.muscles).toEqual(
      expect.arrayContaining([
        { muscleId: 'chest', weight: 1 },
        { muscleId: 'triceps', weight: 0.5 },
      ]),
    )
    expect(result.exercises[0]?.muscles).toHaveLength(2)
  })

  it('never downloads or fabricates media; copies image paths through as-is', () => {
    const result = importCatalog([{ name: 'Squat', primaryMuscles: ['quadriceps'], images: ['Squat/0.jpg', 'Squat/1.jpg'] }])
    expect(result.exercises[0]?.media).toEqual(['Squat/0.jpg', 'Squat/1.jpg'])
  })

  it('keeps every kettlebell movement when curating the focused library', () => {
    const broadLibrary = Array.from({ length: 465 }, (_, index) => ({
      id: `barbell-move-${index}`,
      name: `Barbell move ${index}`,
      category: 'strength',
      equipment: 'barbell',
      primaryMuscles: ['chest'],
    }))
    broadLibrary.push(
      {
        id: 'Kettlebell_Dead_Clean',
        name: 'Kettlebell Dead Clean',
        category: 'strength',
        equipment: 'kettlebells',
        primaryMuscles: ['shoulders'],
      },
      {
        id: 'Advanced_Kettlebell_Windmill',
        name: 'Advanced Kettlebell Windmill',
        category: 'strength',
        equipment: 'kettlebells',
        primaryMuscles: ['abdominals'],
      },
      {
        id: 'One-Arm_Kettlebell_Snatch',
        name: 'One-Arm Kettlebell Snatch',
        category: 'strength',
        equipment: 'kettlebells',
        primaryMuscles: ['shoulders'],
      },
    )

    const result = importCatalog(broadLibrary)

    expect(result.exercises).toHaveLength(441)
    expect(result.exercises.map((exercise) => exercise.id)).toEqual(
      expect.arrayContaining(['kettlebell-dead-clean', 'advanced-kettlebell-windmill', 'one-arm-kettlebell-snatch']),
    )
  })
})
