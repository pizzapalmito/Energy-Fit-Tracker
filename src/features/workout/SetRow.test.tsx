import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkoutSet } from '../../domain/models'
import type { SetFieldErrors } from './validation'
import { SetRow } from './SetRow'

const set: WorkoutSet = { id: 'set-1', workoutExerciseId: 'we-1', setNumber: 1, type: 'working', completed: false }

beforeEach(() => localStorage.clear())

describe('SetRow persistence ordering', () => {
  it('starts persistence on change without waiting for blur', () => {
    const onCommitField = vi.fn(() => Promise.resolve({}))
    render(<SetRow set={set} index={0} unit="kg" previous="—" onCommitField={onCommitField} onToggleComplete={() => Promise.resolve()} onDelete={() => Promise.resolve()} />)

    fireEvent.change(screen.getByLabelText('Load (kg)'), { target: { value: '42' } })

    expect(onCommitField).toHaveBeenCalledWith('loadKg', 42)
  })

  it('serializes rapid writes so the latest value is persisted last', async () => {
    let resolveFirst!: (errors: SetFieldErrors) => void
    let resolveSecond!: (errors: SetFieldErrors) => void
    const onCommitField = vi.fn((field: string, value: number | undefined) => new Promise<SetFieldErrors>((resolve) => {
      if (field === 'loadKg' && value === 7) resolveFirst = resolve
      else resolveSecond = resolve
    }))
    render(<SetRow set={set} index={0} unit="kg" previous="—" onCommitField={onCommitField} onToggleComplete={() => Promise.resolve()} onDelete={() => Promise.resolve()} />)

    const load = screen.getByLabelText('Load (kg)')
    fireEvent.change(load, { target: { value: '7' } })
    fireEvent.change(load, { target: { value: '70' } })
    expect(onCommitField).toHaveBeenCalledTimes(1)

    act(() => resolveFirst({}))
    await waitFor(() => expect(onCommitField).toHaveBeenLastCalledWith('loadKg', 70))
    act(() => resolveSecond({}))
  })

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
    expect(reps).toHaveValue(8)
    expect(onToggleComplete).not.toHaveBeenCalled()
  })

  it('recovers a synchronous draft after an immediate reload interrupts IndexedDB persistence', async () => {
    const interruptedCommit = vi.fn(() => new Promise<SetFieldErrors>(() => {}))
    const first = render(<SetRow set={set} index={0} unit="kg" previous="—" onCommitField={interruptedCommit} onToggleComplete={async () => {}} onDelete={async () => {}} />)
    fireEvent.change(screen.getByLabelText('Load (kg)'), { target: { value: '70' } })
    first.unmount()

    const recoveredCommit = vi.fn(() => Promise.resolve({}))
    render(<SetRow set={set} index={0} unit="kg" previous="—" onCommitField={recoveredCommit} onToggleComplete={async () => {}} onDelete={async () => {}} />)

    expect(screen.getByLabelText('Load (kg)')).toHaveValue(70)
    await waitFor(() => expect(recoveredCommit).toHaveBeenCalledWith('loadKg', 70))
    await waitFor(() => expect(localStorage.length).toBe(0))
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
