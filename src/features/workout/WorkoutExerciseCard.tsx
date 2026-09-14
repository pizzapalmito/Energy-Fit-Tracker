import { useState } from 'react'
import { CatalogImage } from '../../catalog/CatalogImage'
import { CATALOG_VERSION_METADATA_KEY } from '../../catalog/seedCatalog'
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { WeightedSubstitutionEngine } from '../../engines/substitution/substitutionEngine'
import { useI18n } from '../../i18n/I18nContext'
import type { Translator } from '../../i18n/enumLabels'
import { formatSetFieldError } from '../../i18n/validationPresentation'
import { usePreviousPerformance } from './usePreviousPerformance'
import { formatPreviousSet } from './previousPerformance'
import type { WeightUnit } from './units'
import { validateSetFields, type SetFieldErrors, type SetFieldInput } from './validation'
import { addSet, completeSet, removeSet, removeWorkoutExercise, updateSetFields, uncompleteSet, updateWorkoutExercise } from './workoutActions'
import { SetRow } from './SetRow'
import { ConfirmDialog } from './ConfirmDialog'
import { ExerciseDemoDialog } from './ExerciseDemoDialog'
import styles from './WorkoutExerciseCard.module.css'

export interface WorkoutExerciseCardProps {
  db: RepwiseDatabase
  workoutExercise: WorkoutExercise
  sets: WorkoutSet[]
  unit: WeightUnit
  onSetCompleted: (restSeconds: number, workoutExerciseId: string) => void
}

function conciseReason(t: Translator, source: Exercise, candidate: Exercise): string {
  const sourcePrimary = new Set(source.muscles.filter((muscle) => muscle.weight >= 1).map((muscle) => muscle.muscleId))
  if (candidate.muscles.some((muscle) => muscle.weight >= 1 && sourcePrimary.has(muscle.muscleId))) return t('workoutExerciseCard.reasonSamePrimaryMuscle')
  if (candidate.movementPattern === source.movementPattern) return t('workoutExerciseCard.reasonSameMovement')
  if (candidate.equipment.some((equipment) => source.equipment.includes(equipment))) return t('workoutExerciseCard.reasonAvailableEquipment')
  return t('workoutExerciseCard.reasonSimilarProfile')
}

export function WorkoutExerciseCard({ db, workoutExercise, sets, unit, onSetCompleted }: WorkoutExerciseCardProps) {
  const { t } = useI18n()
  const previous = usePreviousPerformance(db, workoutExercise.exerciseId, workoutExercise.workoutId)
  const exercise = useLiveQuery(() => db.exercises.get(workoutExercise.exerciseId), [db, workoutExercise.exerciseId])
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [substitutionsOpen, setSubstitutionsOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const substitutionLocked = sets.some((set) => set.completed)

  const substitutions = useLiveQuery(async () => {
    if (!substitutionsOpen) return []
    const [source, candidates, settings, profiles] = await Promise.all([
      db.exercises.get(workoutExercise.exerciseId),
      db.exercises.toArray(),
      db.settings.get('default'),
      db.equipmentProfiles.toArray(),
    ])
    if (!source) return []
    const profile = profiles.find((entry) => entry.id === settings?.activeEquipmentProfileId)
    const availableEquipment = profile?.availableEquipment ?? [...new Set(candidates.flatMap((candidate) => candidate.equipment))]
    return new WeightedSubstitutionEngine().rank(source, candidates, availableEquipment).slice(0, 5)
  }, [db, workoutExercise.exerciseId, substitutionsOpen])

  async function handleCommitField(set: WorkoutSet, field: keyof SetFieldInput, value: number | undefined): Promise<SetFieldErrors> {
    const errors = validateSetFields({ [field]: value })
    if (errors[field]) return { [field]: formatSetFieldError(t, errors[field]) }
    await updateSetFields(db, set.id, { [field]: value })
    return {}
  }

  async function handleToggleComplete(set: WorkoutSet) {
    if (set.completed) {
      await uncompleteSet(db, set)
    } else {
      await completeSet(db, set)
      onSetCompleted(workoutExercise.restSeconds, workoutExercise.id)
    }
  }

  async function substitute(candidateId: string) {
    const candidate = await db.exercises.get(candidateId)
    if (!candidate || substitutionLocked) return
    const catalogVersion = (await db.metadata.get(CATALOG_VERSION_METADATA_KEY))?.value ?? 'unknown'
    await updateWorkoutExercise(db, {
      ...workoutExercise,
      exerciseId: candidate.id,
      restSeconds: candidate.defaultRestSeconds,
      snapshot: {
        name: candidate.name,
        equipment: candidate.equipment,
        movementPattern: candidate.movementPattern,
        muscles: candidate.muscles,
        catalogVersion,
      },
    })
    setSubstitutionsOpen(false)
  }

  const sourceExercise = exercise.status === 'ready' ? exercise.value : undefined
  const previousSets = previous.status === 'ready' && previous.value
    ? previous.value.sets.filter((set) => set.completed).sort((a, b) => a.setNumber - b.setNumber)
    : []

  return <article className={styles.card}>
    <header className={styles.header}>
      <button type="button" className={styles.thumbnailButton} onClick={() => setDemoOpen(true)} disabled={!sourceExercise} aria-label={t('workoutExerciseCard.viewDemoAriaLabel', { name: workoutExercise.snapshot.name })}>
        <CatalogImage relativePath={sourceExercise?.media[0]} alt="" fallbackClassName={styles.thumbnailFallback} />
      </button>
      <div className={styles.exerciseTitle}>
        <h3>{workoutExercise.snapshot.name}</h3>
        {sourceExercise?.difficulty === 'advanced' && <span className={styles.cautionBadge} role="img" aria-label={t('workoutExerciseCard.advancedCaution')} title={t('workoutExerciseCard.advancedCaution')}>!</span>}
      </div>
      <button type="button" className={styles.substituteButton} onClick={() => setSubstitutionsOpen((open) => !open)} disabled={substitutionLocked}>
        {t('workoutExerciseCard.substitute')}
      </button>
    </header>

    {substitutionLocked && <p className={styles.locked}>{t('workoutExerciseCard.substitutionLocked')}</p>}
    {substitutionsOpen && substitutions.status === 'loading' && <p role="status" className={styles.compactStatus}>{t('workoutExerciseCard.findingSubstitutes')}</p>}
    {substitutionsOpen && substitutions.status === 'error' && <p role="alert" className={styles.compactStatus}>{t('workoutExerciseCard.substitutesLoadError')}</p>}
    {substitutionsOpen && substitutions.status === 'ready' && sourceExercise && <ol className={styles.substitutions}>
      {substitutions.value.map((candidate) => <li key={candidate.exercise.id}>
        <CatalogImage relativePath={candidate.exercise.media[0]} alt="" fallbackClassName={styles.candidateFallback} />
        <div><strong>{candidate.exercise.name}</strong><span>{t('workoutExerciseCard.matchPercent', { score: Math.round(candidate.score), reason: conciseReason(t, sourceExercise, candidate.exercise) })}</span></div>
        <button type="button" aria-label={t('workoutExerciseCard.useAriaLabel', { name: candidate.exercise.name })} onClick={() => void substitute(candidate.exercise.id)}>{t('workoutExerciseCard.use')}</button>
      </li>)}
    </ol>}

    <div className={styles.columnHeaders} aria-hidden="true"><span>{t('workoutExerciseCard.setColumn')}</span><span>{t('workoutExerciseCard.previousColumn')}</span><span>{t('workoutExerciseCard.weightColumn')}<br /><small>{unit}</small></span><span>{t('workoutExerciseCard.repsColumn')}</span><span>{t('workoutExerciseCard.completeColumn')}</span></div>
    <ul className={styles.setList}>
      {sets.map((set, index) => <SetRow
        key={set.id}
        set={set}
        index={index}
        unit={unit}
        previous={formatPreviousSet(previousSets[index], unit)}
        onCommitField={(field, value) => handleCommitField(set, field, value)}
        onToggleComplete={() => handleToggleComplete(set)}
        onDelete={() => removeSet(db, set.id)}
      />)}
    </ul>

    <button type="button" className={styles.addSetButton} onClick={() => void addSet(db, workoutExercise.id, 'working', sets)}>{t('workoutExerciseCard.addSet')}</button>
    <button type="button" className={styles.removeExerciseButton} onClick={() => setConfirmRemoveOpen(true)}>{t('workoutExerciseCard.removeExercise')}</button>

    {demoOpen && sourceExercise && <ExerciseDemoDialog exercise={sourceExercise} onClose={() => setDemoOpen(false)} />}
    {confirmRemoveOpen && <ConfirmDialog
      title={t('workoutExerciseCard.removeConfirmTitle', { name: workoutExercise.snapshot.name })}
      description={t('workoutExerciseCard.removeConfirmDescription')}
      confirmLabel={t('workoutExerciseCard.removeConfirmConfirm')}
      destructive
      onConfirm={() => { setConfirmRemoveOpen(false); void removeWorkoutExercise(db, workoutExercise.id) }}
      onCancel={() => setConfirmRemoveOpen(false)}
    />}
  </article>
}
