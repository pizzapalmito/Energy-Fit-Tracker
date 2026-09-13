import { createDatabase } from './db'
import { DEFAULT_LOCALE } from '../i18n/locale'

/** The single shared Dexie handle used by the running app (tests construct their own isolated instances via createDatabase). */
export const db = createDatabase()

const ALL_EQUIPMENT = ['bands', 'barbell', 'bodyweight', 'cable', 'dumbbell', 'exercise-ball', 'ez-curl-bar', 'foam-roller', 'kettlebell', 'machine', 'medicine-ball', 'other']

/** Idempotent first-run defaults. Existing local preferences and profiles are never overwritten. */
export async function ensureAppDefaults() {
  await db.transaction('rw', db.settings, db.equipmentProfiles, async () => {
    if (!await db.settings.get('default')) await db.settings.put({ id: 'default', unit: 'kg', activeEquipmentProfileId: 'commercial-gym', trainingGoal: 'hypertrophy', preferredSplit: 'full_body', defaultDurationMinutes: 60, locale: DEFAULT_LOCALE })
    const defaults = [
      { id: 'commercial-gym', name: 'Commercial Gym', availableEquipment: ALL_EQUIPMENT, isDefault: true },
      { id: 'home', name: 'Home', availableEquipment: ['bands', 'bodyweight', 'dumbbell', 'exercise-ball', 'kettlebell'], isDefault: false },
      { id: 'hotel', name: 'Hotel', availableEquipment: ['bands', 'bodyweight', 'dumbbell'], isDefault: false },
    ]
    for (const profile of defaults) if (!await db.equipmentProfiles.get(profile.id)) await db.equipmentProfiles.put(profile)
  })
}
