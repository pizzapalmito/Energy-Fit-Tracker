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
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[]} unit="kg" position={1} total={1} defaultExpanded onSetCompleted={vi.fn()} />)

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
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[completedSet]} unit="kg" position={1} total={1} defaultExpanded onSetCompleted={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Substitute/ })).toBeDisabled()
    expect(screen.getByText('Substitution unavailable after a set is completed.')).toBeVisible()
  })

  it('marks advanced exercises with a visible caution indicator', async () => {
    const advanced = { ...source, difficulty: 'advanced' as const }
    await db.exercises.put(advanced)
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[]} unit="kg" position={1} total={1} defaultExpanded onSetCompleted={vi.fn()} />)

    expect(await screen.findByRole('img', { name: 'Advanced exercise — use caution' })).toHaveTextContent('!')
  })

  it('shows the exercise position and live completed/total sets, keeping them accurate as sets complete', async () => {
    const oneDone: WorkoutSet = { id: 'set-1', workoutExerciseId: workoutExercise.id, setNumber: 1, type: 'working', completed: true }
    const notDone: WorkoutSet = { id: 'set-2', workoutExerciseId: workoutExercise.id, setNumber: 2, type: 'working', completed: false }
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[oneDone, notDone]} unit="kg" position={2} total={3} defaultExpanded onSetCompleted={vi.fn()} />)

    expect(await screen.findByText('Exercise 2 of 3')).toBeVisible()
    expect(screen.getByText('1/2')).toBeVisible()
  })

  it('keeps set inputs mounted (hidden, not removed) when collapsed via keyboard, preserving an unsaved invalid draft across collapse/reopen', async () => {
    const set: WorkoutSet = { id: 'set-1', workoutExerciseId: workoutExercise.id, setNumber: 1, type: 'working', completed: false }
    await db.sets.put(set)
    const user = userEvent.setup()
    render(<WorkoutExerciseCard db={db} workoutExercise={workoutExercise} sets={[set]} unit="kg" position={1} total={1} defaultExpanded onSetCompleted={vi.fn()} />)

    const loadInput = await screen.findByLabelText('Load (kg)')
    await user.type(loadInput, '-5')
    expect(loadInput).toHaveAttribute('aria-invalid', 'true')

    const disclosure = screen.getByRole('button', { expanded: true })
    disclosure.focus()
    await user.keyboard('{Enter}')
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')

    // The field stays mounted (just hidden), so the unsaved draft and its validation state survive collapse.
    expect(screen.getByLabelText('Load (kg)')).toHaveValue(-5)
    expect(screen.getByLabelText('Load (kg)')).toHaveAttribute('aria-invalid', 'true')
    expect(await db.sets.get('set-1')).not.toHaveProperty('loadKg')

    await user.keyboard('{Enter}')
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Load (kg)')).toHaveValue(-5)
    expect(screen.getByLabelText('Load (kg)')).toHaveAttribute('aria-invalid', 'true')
  })
})
