import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { DexieExerciseRepository } from '../../data/repositories/exerciseRepository'
import { DexieMuscleRepository } from '../../data/repositories/muscleRepository'
import { ExercisesPage } from './ExercisesPage'
import { useCatalogReadiness } from '../../catalog/useCatalogReadiness'
import type { Exercise } from '../../domain/models'
import type { Muscle } from '../../data/types'

vi.mock('../../catalog/useCatalogReadiness')

const mockedUseCatalogReadiness = vi.mocked(useCatalogReadiness)

let db: RepwiseDatabase
let counter = 0

const musclesFixture: Muscle[] = [
  { id: 'chest', name: 'Chest', group: 'chest', aliases: [] },
  { id: 'quadriceps', name: 'Quadriceps', group: 'legs', aliases: [] },
]

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'bench-press',
    name: 'Bench Press',
    aliases: [],
    category: 'strength',
    movementPattern: 'push',
    difficulty: 'intermediate',
    mechanic: 'compound',
    equipment: ['barbell'],
    instructions: ['Lie on the bench.', 'Press the bar up.'],
    muscles: [{ muscleId: 'chest', weight: 1 }],
    defaultRestSeconds: 120,
    media: ['media/bench-press/start.webp', 'media/bench-press/end.webp'],
    source: 'catalog',
    excluded: false,
    ...overrides,
  }
}

beforeEach(async () => {
  counter += 1
  db = createDatabase(`exercises-page-${counter}`)
  await db.open()
  mockedUseCatalogReadiness.mockReturnValue({ status: 'ready', version: 'catalog-x' })
})

describe('ExercisesPage', () => {
  it('shows a loading state before any data is available', () => {
    mockedUseCatalogReadiness.mockReturnValue({ status: 'loading' })
    render(<ExercisesPage db={db} />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('shows a blocking error state when the catalog fails and nothing is cached locally', async () => {
    mockedUseCatalogReadiness.mockReturnValue({ status: 'error', message: 'network down' })
    render(<ExercisesPage db={db} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })

  it('lists exercises once ready and reports a result count', async () => {
    await new DexieMuscleRepository(db).bulkUpsert(musclesFixture)
    await new DexieExerciseRepository(db).bulkUpsert([
      exercise(),
      exercise({ id: 'squat', name: 'Squat', muscles: [{ muscleId: 'quadriceps', weight: 1 }] }),
    ])
    render(<ExercisesPage db={db} />)
    expect(await screen.findByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 exercises')).toBeInTheDocument()
  })

  it('filters the list by search text and shows a zero-results state', async () => {
    await new DexieMuscleRepository(db).bulkUpsert(musclesFixture)
    await new DexieExerciseRepository(db).bulkUpsert([
      exercise(),
      exercise({ id: 'squat', name: 'Squat', muscles: [{ muscleId: 'quadriceps', weight: 1 }] }),
    ])
    const user = userEvent.setup()
    render(<ExercisesPage db={db} />)
    await screen.findByText('Bench Press')

    await user.type(screen.getByLabelText('Search'), 'squat')
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Search'))
    await user.type(screen.getByLabelText('Search'), 'nonexistent exercise')
    expect(await screen.findByText('No exercises match your filters.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('Bench Press')).toBeInTheDocument()
  })

  it('filters the list by difficulty', async () => {
    await new DexieMuscleRepository(db).bulkUpsert(musclesFixture)
    await new DexieExerciseRepository(db).bulkUpsert([exercise(), exercise({ id: 'push-up', name: 'Push-Up', difficulty: 'beginner' })])
    const user = userEvent.setup()
    render(<ExercisesPage db={db} />)
    await screen.findByText('Bench Press')
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'beginner')
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
    expect(screen.getByText('Push-Up')).toBeInTheDocument()
  })

  it('opens an exercise detail view with instructions and a start/end media toggle', async () => {
    await new DexieMuscleRepository(db).bulkUpsert(musclesFixture)
    await new DexieExerciseRepository(db).bulkUpsert([exercise()])
    const user = userEvent.setup()
    render(<ExercisesPage db={db} />)

    await user.click(await screen.findByText('Bench Press'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Lie on the bench.')).toBeInTheDocument()
    expect(within(dialog).getByRole('img')).toHaveAttribute('alt', expect.stringContaining('starting position'))

    await user.click(within(dialog).getByRole('button', { name: 'End' }))
    expect(within(dialog).getByRole('img')).toHaveAttribute('alt', expect.stringContaining('ending position'))

    await user.click(within(dialog).getByRole('button', { name: 'Close exercise details' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
