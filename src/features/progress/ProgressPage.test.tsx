import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import type { Workout } from '../../domain/models'
import { ProgressPage } from './ProgressPage'

let db: RepwiseDatabase
let counter = 0

function completedWorkout(id: string, date: string): Workout {
  return { id, date, startTime: `${date}T10:00:00.000Z`, endTime: `${date}T11:00:00.000Z`, name: `Session ${id}`, notes: '', status: 'completed' }
}

beforeEach(async () => {
  counter += 1
  db = createDatabase(`progress-page-${counter}`)
  await db.open()
})

describe('ProgressPage volume trend', () => {
  it('shows the single recorded value and a sparse-data note instead of a one-bar chart', async () => {
    await db.workouts.put(completedWorkout('w-1', '2026-09-01'))
    render(<ProgressPage db={db} />)
    expect(await screen.findByText('One workout recorded. Complete another to see a trend.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Workout volume chart')).not.toBeInTheDocument()
  })

  it('renders the chart once more than one workout is recorded', async () => {
    await db.workouts.bulkPut([completedWorkout('w-1', '2026-09-01'), completedWorkout('w-2', '2026-09-03')])
    render(<ProgressPage db={db} />)
    expect(await screen.findByLabelText('Workout volume chart')).toBeInTheDocument()
    expect(screen.queryByText('One workout recorded. Complete another to see a trend.')).not.toBeInTheDocument()
  })
})
