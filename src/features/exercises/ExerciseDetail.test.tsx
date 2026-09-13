import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseDetail } from './ExerciseDetail'
import type { Exercise } from '../../domain/models'

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

describe('ExerciseDetail', () => {
  it('shows facts, muscle contributions, and instructions using the fixed-vocabulary muscle labels (not stored muscle-catalog names)', () => {
    render(<ExerciseDetail exercise={exercise} onClose={() => {}} />)
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByText('150s')).toBeInTheDocument()
    expect(screen.getByText('Quadriceps (primary)')).toBeInTheDocument()
    expect(screen.getByText('Glutes (secondary)')).toBeInTheDocument()
    expect(screen.getByText('Set up the bar.')).toBeInTheDocument()
  })

  it('defaults to the starting-position image and toggles to the ending position', async () => {
    const user = userEvent.setup()
    render(<ExerciseDetail exercise={exercise} onClose={() => {}} />)
    expect(screen.getByRole('img')).toHaveAttribute('alt', expect.stringContaining('starting position'))
    await user.click(screen.getByRole('button', { name: 'End' }))
    expect(screen.getByRole('img')).toHaveAttribute('alt', expect.stringContaining('ending position'))
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExerciseDetail exercise={exercise} onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is activated', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExerciseDetail exercise={exercise} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close exercise details' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the close button on open for keyboard/screen-reader users', () => {
    render(<ExerciseDetail exercise={exercise} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Close exercise details' })).toHaveFocus()
  })

  it('omits the media toggle when only one demonstration frame is available', () => {
    render(<ExerciseDetail exercise={{ ...exercise, media: ['media/squat/start.webp'] }} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'End' })).not.toBeInTheDocument()
  })

  it('shows a clean fallback instead of a broken image', () => {
    render(<ExerciseDetail exercise={exercise} onClose={() => {}} />)
    fireEvent.error(screen.getByRole('img', { name: /starting position/ }))
    expect(screen.getByRole('img', { name: /starting position unavailable/ })).toHaveTextContent('No image')
  })
})
