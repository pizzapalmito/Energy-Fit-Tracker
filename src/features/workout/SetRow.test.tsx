import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WorkoutSet } from '../../domain/models'
import type { SetFieldErrors } from './validation'
import { SetRow } from './SetRow'

const set: WorkoutSet = { id: 'set-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', completed: false }

describe('SetRow persistence ordering', () => {
  it('waits for a blur-triggered field save before completing the set', async () => {
    let resolveCommit!: (errors: SetFieldErrors) => void
    const onCommitField = vi.fn(() => new Promise<SetFieldErrors>((resolve) => { resolveCommit = resolve }))
    const onToggleComplete = vi.fn(async () => {})
    render(<SetRow set={set} index={0} unit="kg" onCommitField={onCommitField} onChangeType={async () => {}} onToggleComplete={onToggleComplete} onRemove={() => {}} />)

    const load = screen.getByLabelText('Load (kg)')
    fireEvent.change(load, { target: { value: '70' } })
    fireEvent.blur(load)
    expect(onCommitField).toHaveBeenCalledWith('loadKg', 70)

    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(onToggleComplete).not.toHaveBeenCalled()
    act(() => resolveCommit({}))
    await waitFor(() => expect(onToggleComplete).toHaveBeenCalledOnce())
  })

  it('does not complete when the pending persistence operation fails', async () => {
    let rejectCommit!: (error: Error) => void
    const onCommitField = vi.fn(() => new Promise<SetFieldErrors>((_resolve, reject) => { rejectCommit = reject }))
    const onToggleComplete = vi.fn(async () => {})
    render(<SetRow set={set} index={0} unit="kg" onCommitField={onCommitField} onChangeType={async () => {}} onToggleComplete={onToggleComplete} onRemove={() => {}} />)

    const reps = screen.getByLabelText('Reps')
    fireEvent.change(reps, { target: { value: '8' } })
    fireEvent.blur(reps)
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    act(() => rejectCommit(new Error('IndexedDB unavailable')))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this set')
    expect(onToggleComplete).not.toHaveBeenCalled()
  })
})
