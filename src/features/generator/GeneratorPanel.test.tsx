import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { GeneratorPanel } from './GeneratorPanel'

let db: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDatabase(`generator-panel-${counter}`)
  await db.open()
})

describe('GeneratorPanel duration input', () => {
  it('can be cleared while editing and disables generation until a valid duration is entered', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GeneratorPanel db={db} /></MemoryRouter>)

    const minutes = await screen.findByLabelText('Minutes')
    const generate = screen.getByRole('button', { name: 'Generate' })
    await user.clear(minutes)
    expect(minutes).toHaveValue(null)
    expect(generate).toBeDisabled()

    await user.type(minutes, '30')
    expect(minutes).toHaveValue(30)
    expect(generate).toBeEnabled()
  })
})
