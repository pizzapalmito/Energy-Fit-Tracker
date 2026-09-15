import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type RepwiseDatabase } from '../../data/db'
import { SETTINGS_SINGLETON_ID } from '../../data/repositories/settingsRepository'
import { I18nProvider } from '../../i18n/I18nContext'
import { SettingsPage } from './SettingsPage'

let db: RepwiseDatabase
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDatabase(`settings-page-${counter}`)
  await db.open()
  document.documentElement.lang = ''
})

function renderSettings() {
  return render(
    <I18nProvider db={db}>
      <SettingsPage db={db} />
    </I18nProvider>,
  )
}

describe('SettingsPage language control', () => {
  it('defaults to English for a settings row with no saved locale', async () => {
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'kg' })
    renderSettings()
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches visible and accessibility copy immediately, persists the choice, and updates document.lang', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByRole('button', { name: 'Français' }))

    expect(await screen.findByRole('heading', { name: 'Réglages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Kilogrammes' })).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.lang).toBe('fr'))
    await waitFor(async () => expect((await db.settings.get(SETTINGS_SINGLETON_ID))?.locale).toBe('fr'))
  })

  it('keeps the selected language after a reload (settings persisted, provider remounted)', async () => {
    const user = userEvent.setup()
    const { unmount } = renderSettings()
    await screen.findByRole('heading', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Español' }))
    await screen.findByRole('heading', { name: 'Ajustes' })
    unmount()

    renderSettings()
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('normalizes an unsupported persisted locale to English instead of failing', async () => {
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'kg', locale: 'de' as never })
    renderSettings()
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('does not disturb other settings when switching language', async () => {
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'lb', trainingGoal: 'strength' })
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('heading', { name: 'Settings' })

    await user.click(screen.getByRole('button', { name: 'Português (Brasil)' }))
    await screen.findByRole('heading', { name: 'Configurações' })

    const settings = await db.settings.get(SETTINGS_SINGLETON_ID)
    expect(settings?.unit).toBe('lb')
    expect(settings?.trainingGoal).toBe('strength')
    expect(settings?.locale).toBe('pt-BR')
  })

  it('exposes the language control as a programmatically labelled group', async () => {
    renderSettings()
    await screen.findByRole('heading', { name: 'Settings' })
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
  })

  it('localizes default equipment profile names by their stable id while preserving a custom profile name verbatim', async () => {
    await db.equipmentProfiles.bulkPut([
      { id: 'commercial-gym', name: 'Commercial Gym', availableEquipment: ['barbell', 'dumbbell'], isDefault: true },
      { id: 'home', name: 'Home', availableEquipment: ['bands', 'bodyweight'], isDefault: false },
      { id: 'my-garage-rig', name: 'Ma Salle Perso', availableEquipment: ['barbell'], isDefault: false },
    ])
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('heading', { name: 'Settings' })
    expect(await screen.findByRole('button', { name: 'Commercial Gym · Barbell, Dumbbell' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home · Bands, Bodyweight' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ma Salle Perso · Barbell' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Français' }))
    expect(await screen.findByRole('button', { name: 'Salle de sport · Barre, Haltères' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Maison · Élastiques, Poids du corps' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ma Salle Perso · Barre' })).toBeInTheDocument()
  })
})

describe('SettingsPage workout preferences', () => {
  it('does not let late initial settings overwrite a duration the user already edited', async () => {
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'kg', defaultDurationMinutes: 55 })
    render(<SettingsPage db={db} />)

    const duration = screen.getByLabelText('Default workout duration')
    fireEvent.change(duration, { target: { value: '45' } })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled())
    expect(duration).toHaveValue(45)
  })

  it('allows replacing the duration, blocks an empty value, and saves preferences explicitly', async () => {
    await db.settings.put({ id: SETTINGS_SINGLETON_ID, unit: 'kg', trainingGoal: 'hypertrophy', preferredSplit: 'full_body', defaultDurationMinutes: 55 })
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('heading', { name: 'Settings' })

    const duration = screen.getByLabelText('Default workout duration')
    const save = screen.getByRole('button', { name: 'Save settings' })
    await waitFor(() => expect(duration).toHaveValue(55))
    await user.clear(duration)
    expect(duration).toHaveValue(null)
    expect(save).toBeDisabled()

    await user.type(duration, '45')
    await user.selectOptions(screen.getByLabelText('Training goal'), 'strength')
    expect((await db.settings.get(SETTINGS_SINGLETON_ID))?.defaultDurationMinutes).toBe(55)

    await user.click(save)
    await waitFor(async () => expect(await db.settings.get(SETTINGS_SINGLETON_ID)).toMatchObject({ trainingGoal: 'strength', defaultDurationMinutes: 45 }))
    expect(screen.getByRole('status')).toHaveTextContent('Settings saved.')
  })
})
