import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { startWorkout } from '../workout/workoutActions'
import { addCatalogExerciseToActiveWorkout } from './catalogWorkoutActions'
import { ExerciseDetail } from './ExerciseDetail'
import type { Exercise } from '../../domain/models'
import { createDatabase, type RepwiseDatabase } from '../../data/db'

const exercise: Exercise = {
  id: 'squat',
  name: 'Squat',
  aliases: [],
  category: 'strength',
  movementPattern: 'legs',
  difficulty: 'advanced',
  mechanic: 'compound',
  equipment: ['barbell'],
  instructions: ['Set up the bar.', 'Squat down.'],
  muscles: [
    { muscleId: 'quadriceps', weight: 1 },
    { muscleId: 'glutes', weight: 0.5 },
  ],
  defaultRestSeconds: 150,
  media: ['media/squat/start.webp', 'media/squat/end.webp'],
  source: 'catalog',
  excluded: false,
}

let db: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDatabase(`exercise-detail-${counter}`)
  await db.open()
})

function renderDetail(overrides: Partial<Exercise> = {}, onClose: () => void = () => {}) {
  return render(
      <ExerciseDetail db={db} exercise={{ ...exercise, ...overrides }} onClose={onClose} />
    ,
  )
}

describe('ExerciseDetail', () => {
  it('keeps focus inside the detail dialog and retains standalone use without a router', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('link', { name: 'Start one from Today' })
    screen.getByRole('button', { name: 'Close exercise details' }).focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('link', { name: 'Start one from Today' })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Close exercise details' })).toHaveFocus()
  })

  it('never applies an old duplicate confirmation to a newly active session', async () => {
    await db.exercises.put(exercise)
    const old = await startWorkout(db, 'Old')
    await addCatalogExerciseToActiveWorkout(db, old.id, exercise)
    const user = userEvent.setup()
    renderDetail()
    await user.click(await screen.findByRole('button', { name: 'Add to workout' }))
    expect(await screen.findByRole('alertdialog')).toBeVisible()
    await db.workouts.update(old.id, { status: 'completed', endTime: new Date().toISOString() })
    const current = await startWorkout(db, 'New')
    await user.click(screen.getByRole('button', { name: 'Add another' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('active workout changed')
    expect(await db.workoutExercises.where('workoutId').equals(current.id).count()).toBe(0)
  })

  it('shows facts, muscle contributions, and instructions using the fixed-vocabulary muscle labels (not stored muscle-catalog names)', () => {
    renderDetail()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByText('150s')).toBeInTheDocument()
    expect(screen.getByText('Quadriceps (primary)')).toBeInTheDocument()
    expect(screen.getByText('Glutes (secondary)')).toBeInTheDocument()
    expect(screen.getByText('Set up the bar.')).toBeInTheDocument()
  })

  it('defaults to the starting-position image and toggles to the ending position', async () => {
    const user = userEvent.setup()
    renderDetail()
    expect(screen.getByRole('img')).toHaveAttribute('alt', expect.stringContaining('starting position'))
    await user.click(screen.getByRole('button', { name: 'End' }))
    expect(screen.getByRole('img')).toHaveAttribute('alt', expect.stringContaining('ending position'))
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDetail({}, onClose)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is activated', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDetail({}, onClose)
    await user.click(screen.getByRole('button', { name: 'Close exercise details' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the close button on open for keyboard/screen-reader users', () => {
    renderDetail()
    expect(screen.getByRole('button', { name: 'Close exercise details' })).toHaveFocus()
  })

  it('omits the media toggle when only one demonstration frame is available', () => {
    renderDetail({ media: ['media/squat/start.webp'] })
    expect(screen.queryByRole('button', { name: 'End' })).not.toBeInTheDocument()
  })

  it('shows a clean fallback instead of a broken image', () => {
    renderDetail()
    fireEvent.error(screen.getByRole('img', { name: /starting position/ }))
    expect(screen.getByRole('img', { name: /starting position unavailable/ })).toHaveTextContent('No image')
  })

  it('shows a no-active-workout affordance and recent-performance empty state when there is no history', async () => {
    renderDetail()
    expect(await screen.findByText('Start a workout from Today to add this exercise.')).toBeVisible()
    expect(screen.getByText('No completed sets recorded yet.')).toBeVisible()
  })
})
