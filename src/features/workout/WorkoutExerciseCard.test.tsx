import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../domain/models'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { WorkoutExerciseCard } from './WorkoutExerciseCard'

let db: RepwiseDatabase
let counter = 0

const source: Exercise = {
  id: 'barbell-bench-press-medium-grip', name: 'Barbell Bench Press - Medium Grip', aliases: [], category: 'strength',
  movementPattern: 'push', difficulty: 'intermediate', mechanic: 'compound', equipment: ['barbell'], instructions: [],
  muscles: [{ muscleId: 'pectorals', weight: 1 }], defaultRestSeconds: 120,
  media: ['media/barbell-bench-press-medium-grip/start.webp', 'media/barbell-bench-press-medium-grip/end.webp'], source: 'catalog', excluded: false,
}

const candidate: Exercise = {
  ...source, id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', equipment: ['dumbbell'],
  media: ['media/dumbbell-bench-press/start.webp', 'media/dumbbell-bench-press/end.webp'],
}

const workoutExercise: WorkoutExercise = {
  id: 'we-1', workoutId: 'workout-1', exerciseId: source.id, order: 0, notes: '', restSeconds: 120,
  snapshot: { name: source.name, equipment: source.equipment, movementPattern: source.movementPattern, muscles: source.muscles, catalogVersion: 'test' },
}

beforeEach(async () => {
  counter += 1
  db = createDatabase(`workout-exercise-card-${counter}`)
  await db.open()
  await db.exercises.bulkPut([source, candidate])
  await db.workoutExercises.put(workoutExercise)
})

describe('WorkoutExerciseCard', () => {
  it('uses canonical media, opens the demonstration, and exposes substitution in one action', async () => {
    const user = userEvent.setup()
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[]} unit="kg" onSetCompleted={vi.fn()} />)

    const demoButton = await screen.findByRole('button', { name: `View ${source.name} demonstration` })
    await waitFor(() => expect(demoButton.querySelector('img')).toHaveAttribute('src', `${import.meta.env.BASE_URL}catalog/media/barbell-bench-press-medium-grip/start.webp`))
    await user.click(demoButton)
    expect(screen.getByRole('dialog', { name: source.name })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Close demonstration' }))

    await user.click(screen.getByRole('button', { name: /Substitute/ }))
    expect(await screen.findByText(candidate.name)).toBeVisible()
    await user.click(screen.getByRole('button', { name: `Use ${candidate.name}` }))
    await waitFor(async () => expect((await db.workoutExercises.get(workoutExercise.id))?.exerciseId).toBe(candidate.id))
  })

  it('locks substitution after a completed set', async () => {
    const completedSet: WorkoutSet = { id: 'set-1', workoutExerciseId: workoutExercise.id, setNumber: 1, type: 'working', completed: true }
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[completedSet]} unit="kg" onSetCompleted={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Substitute/ })).toBeDisabled()
    expect(screen.getByText('Substitution unavailable after a set is completed.')).toBeVisible()
  })

  it('marks advanced exercises with a visible caution indicator', async () => {
    const advanced = { ...source, difficulty: 'advanced' as const }
    await db.exercises.put(advanced)
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[]} unit="kg" onSetCompleted={vi.fn()} />)

    expect(await screen.findByRole('img', { name: 'Advanced exercise — use caution' })).toHaveTextContent('!')
  })
})
