import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Workout, WorkoutExercise, WorkoutSet } from '../../domain/models'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { SETTINGS_SINGLETON_ID } from '../../data/repositories/settingsRepository'
import { WorkoutSummaryPage } from './WorkoutSummaryPage'

let db: RepwiseDatabase
let counter = 0

const workout: Workout = {
  id: 'workout-1', date: '2026-09-14', startTime: '2026-09-14T10:00:00.000Z', endTime: '2026-09-14T10:31:40.000Z',
  name: 'Offline Push', notes: '', status: 'completed',
}

const workoutExercise: WorkoutExercise = {
  id: 'we-1', workoutId: workout.id, exerciseId: 'ex-1', order: 0, notes: '', restSeconds: 90,
  snapshot: { name: 'Barbell Bench Press - Medium Grip', equipment: ['barbell'], movementPattern: 'push', muscles: [], catalogVersion: 'test' },
}

const sets: WorkoutSet[] = [
  { id: 'set-1', workoutExerciseId: workoutExercise.id, setNumber: 1, type: 'working', completed: true, loadKg: 70, reps: 8 },
  { id: 'set-2', workoutExerciseId: workoutExercise.id, setNumber: 2, type: 'working', completed: false },
]

function renderAt(workoutId: string) {
  return render(
    <MemoryRouter initialEntries={[`/workout/summary/${workoutId}`]}>
      <Routes>
        <Route path="/workout/summary/:workoutId" element={<WorkoutSummaryPage db={db} />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  counter += 1
  db = createDatabase(`workout-summary-page-${counter}`)
  await db.open()
  await db.workouts.put(workout)
  await db.workoutExercises.put(workoutExercise)
  await db.sets.bulkPut(sets)
})

describe('WorkoutSummaryPage', () => {
  it('shows recorded facts for a completed workout: name, duration, completed/total sets, and kg volume', async () => {
    renderAt(workout.id)

    expect(await screen.findByText('Offline Push')).toBeVisible()
    expect(screen.getByText('31:40')).toBeVisible()
    expect(screen.getByText('1 of 2 sets · best 70kg')).toBeVisible()
    expect(screen.getByText('Partial')).toBeVisible()
  })

  it('shows unavailable duration instead of inventing zero when timestamps are absent', async () => {
    await db.workouts.put({ ...workout, endTime: undefined })
    renderAt(workout.id)
    expect(await screen.findByText('Offline Push')).toBeVisible()
    expect(screen.getByText('—')).toBeVisible()
  })

  it('converts volume to pounds when the unit setting is lb', async () => {
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'lb' })
    renderAt(workout.id)

    expect(await screen.findByText('1 of 2 sets · best 154.32lb')).toBeVisible()
  })

  it('shows a missing-summary message for an unknown workout id', async () => {
    renderAt('does-not-exist')
    expect(await screen.findByRole('alert')).toHaveTextContent('not available')
    expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
  })

  it('shows a missing-summary message for a workout that is still active (not completed)', async () => {
    await db.workouts.put({ ...workout, id: 'workout-active', status: 'active', endTime: undefined })
    renderAt('workout-active')
    expect(await screen.findByRole('alert')).toHaveTextContent('not available')
    expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
  })

  it('reflects the same persisted facts after an unmount/remount (reload-style lookup)', async () => {
    const first = renderAt(workout.id)
    expect(await screen.findByText('Offline Push')).toBeVisible()
    first.unmount()

    renderAt(workout.id)
    expect(await screen.findByText('Offline Push')).toBeVisible()
    expect(screen.getByText('31:40')).toBeVisible()
  })
})
