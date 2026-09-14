import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WorkoutSet } from '../../domain/models'
import type { SetFieldErrors } from './validation'
import { SetRow } from './SetRow'

const set: WorkoutSet = { id: 'set-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', completed: false }

describe('SetRow persistence ordering', () => {
  it('preserves a focused draft across live-query prop refreshes', () => {
    const onCommitField = vi.fn(() => Promise.resolve({}))
    const props = { index: 0, unit: 'kg' as const, previous: '60 kg × 8', onCommitField, onToggleComplete: async () => {}, onDelete: async () => {} }
    const { rerender } = render(<SetRow {...props} set={set} />)

    const load = screen.getByLabelText('Load (kg)')
    fireEvent.focus(load)
    fireEvent.change(load, { target: { value: '70' } })
    rerender(<SetRow {...props} set={{ ...set, loadKg: 5 }} />)

    expect(load).toHaveValue(70)
    fireEvent.blur(load)
    expect(onCommitField).toHaveBeenCalledWith('loadKg', 70)
  })

  it('waits for a blur-triggered field save before completing the set', async () => {
    let resolveCommit!: (errors: SetFieldErrors) => void
    const onCommitField = vi.fn(() => new Promise<SetFieldErrors>((resolve) => { resolveCommit = resolve }))
    const onToggleComplete = vi.fn(async () => {})
    render(<SetRow set={set} index={0} unit="kg" previous="—" onCommitField={onCommitField} onToggleComplete={onToggleComplete} onDelete={async () => {}} />)

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
    render(<SetRow set={set} index={0} unit="kg" previous="—" onCommitField={onCommitField} onToggleComplete={onToggleComplete} onDelete={async () => {}} />)

    const reps = screen.getByLabelText('Reps')
    fireEvent.change(reps, { target: { value: '8' } })
    fireEvent.blur(reps)
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    act(() => rejectCommit(new Error('IndexedDB unavailable')))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this set')
    expect(onToggleComplete).not.toHaveBeenCalled()
  })

  it('shows only the primary one-handed logging facts', () => {
    render(<SetRow set={set} index={0} unit="kg" previous="60 kg × 8" onCommitField={() => Promise.resolve({})} onToggleComplete={() => Promise.resolve()} onDelete={() => Promise.resolve()} />)

    expect(screen.getByText('60 kg × 8')).toBeVisible()
    expect(screen.getByLabelText('Load (kg)')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Reps')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.queryByLabelText('RIR')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('RPE')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Duration (seconds)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Distance (metres)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Set type')).not.toBeInTheDocument()
  })

  it('exposes an accessible delete action for swipe and keyboard users', async () => {
    const onDelete = vi.fn(async () => {})
    render(<SetRow set={set} index={0} unit="kg" previous="—" onCommitField={() => Promise.resolve({})} onToggleComplete={() => Promise.resolve()} onDelete={onDelete} />)

    const deleteButton = screen.getByRole('button', { name: 'Delete set 1' })
    const pointerEvent = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, { pointerType: { value: 'touch' }, clientX: { value: clientX }, clientY: { value: clientY } })
      return event
    }
    fireEvent(deleteButton.parentElement!, pointerEvent('pointerdown', 120, 20))
    fireEvent(deleteButton.parentElement!, pointerEvent('pointerup', 40, 24))
    expect(deleteButton.parentElement).toHaveAttribute('data-revealed', 'true')

    fireEvent.click(deleteButton)
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce())
  })
})
