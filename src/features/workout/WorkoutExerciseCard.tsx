import { useState } from 'react'
import { CatalogImage } from '../../catalog/CatalogImage'
import { CATALOG_VERSION_METADATA_KEY } from '../../catalog/seedCatalog'
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { WeightedSubstitutionEngine } from '../../engines/substitution/substitutionEngine'
import { usePreviousPerformance } from './usePreviousPerformance'
import { formatPreviousSet } from './previousPerformance'
import type { WeightUnit } from './units'
import { validateSetFields, type SetFieldErrors, type SetFieldInput } from './validation'
import { addSet, completeSet, removeWorkoutExercise, updateSetFields, uncompleteSet, updateWorkoutExercise } from './workoutActions'
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

function conciseReason(source: Exercise, candidate: Exercise): string {
  const sourcePrimary = new Set(source.muscles.filter((muscle) => muscle.weight >= 1).map((muscle) => muscle.muscleId))
  if (candidate.muscles.some((muscle) => muscle.weight >= 1 && sourcePrimary.has(muscle.muscleId))) return 'Same primary muscle'
  if (candidate.movementPattern === source.movementPattern) return 'Same movement'
  if (candidate.equipment.some((equipment) => source.equipment.includes(equipment))) return 'Available equipment'
  return 'Similar training profile'
}

export function WorkoutExerciseCard({ db, workoutExercise, sets, unit, onSetCompleted }: WorkoutExerciseCardProps) {
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
    if (errors[field]) return errors
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
      <button type="button" className={styles.thumbnailButton} onClick={() => setDemoOpen(true)} disabled={!sourceExercise} aria-label={`View ${workoutExercise.snapshot.name} demonstration`}>
        <CatalogImage relativePath={sourceExercise?.media[0]} alt="" fallbackClassName={styles.thumbnailFallback} />
      </button>
      <h3>{workoutExercise.snapshot.name}</h3>
      <button type="button" className={styles.substituteButton} onClick={() => setSubstitutionsOpen((open) => !open)} disabled={substitutionLocked}>
        ⇄ Substitute
      </button>
    </header>

    {substitutionLocked && <p className={styles.locked}>Substitution unavailable after a set is completed.</p>}
    {substitutionsOpen && substitutions.status === 'loading' && <p role="status" className={styles.compactStatus}>Finding substitutes…</p>}
    {substitutionsOpen && substitutions.status === 'error' && <p role="alert" className={styles.compactStatus}>Could not load substitutes.</p>}
    {substitutionsOpen && substitutions.status === 'ready' && sourceExercise && <ol className={styles.substitutions}>
      {substitutions.value.map((candidate) => <li key={candidate.exercise.id}>
        <CatalogImage relativePath={candidate.exercise.media[0]} alt="" fallbackClassName={styles.candidateFallback} />
        <div><strong>{candidate.exercise.name}</strong><span>{Math.round(candidate.score)}% match · {conciseReason(sourceExercise, candidate.exercise)}</span></div>
        <button type="button" aria-label={`Use ${candidate.exercise.name}`} onClick={() => void substitute(candidate.exercise.id)}>Use</button>
      </li>)}
    </ol>}

    <div className={styles.columnHeaders} aria-hidden="true"><span>Set</span><span>Previous</span><span>Weight<br /><small>{unit}</small></span><span>Reps</span><span>✓</span></div>
    <ul className={styles.setList}>
      {sets.map((set, index) => <SetRow
        key={set.id}
        set={set}
        index={index}
        unit={unit}
        previous={formatPreviousSet(previousSets[index], unit)}
        onCommitField={(field, value) => handleCommitField(set, field, value)}
        onToggleComplete={() => handleToggleComplete(set)}
      />)}
    </ul>

    <button type="button" className={styles.addSetButton} onClick={() => void addSet(db, workoutExercise.id, 'working', sets)}>+ Add Set</button>
    <button type="button" className={styles.removeExerciseButton} onClick={() => setConfirmRemoveOpen(true)}>Remove exercise</button>

    {demoOpen && sourceExercise && <ExerciseDemoDialog exercise={sourceExercise} onClose={() => setDemoOpen(false)} />}
    {confirmRemoveOpen && <ConfirmDialog
      title={`Remove ${workoutExercise.snapshot.name}?`}
      description="This removes all recorded sets for this exercise from the workout. This cannot be undone."
      confirmLabel="Remove"
      destructive
      onConfirm={() => { setConfirmRemoveOpen(false); void removeWorkoutExercise(db, workoutExercise.id) }}
      onCancel={() => setConfirmRemoveOpen(false)}
    />}
  </article>
}
