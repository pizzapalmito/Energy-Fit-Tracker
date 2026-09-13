import { useEffect, useId, useState } from 'react'
import type { SetType, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import { CATALOG_VERSION_METADATA_KEY } from '../../catalog/seedCatalog'
import { WeightedSubstitutionEngine } from '../../engines/substitution/substitutionEngine'
import { DoubleProgressionEngine } from '../../engines/progression/progressionEngine'
import { usePreviousPerformance } from './usePreviousPerformance'
import { summarizeWorkingSets } from './previousPerformance'
import { formatWeight, type WeightUnit } from './units'
import { validateSetFields, type SetFieldErrors, type SetFieldInput } from './validation'
import { addSet, completeSet, removeSet, removeWorkoutExercise, updateSetFields, uncompleteSet, updateWorkoutExercise } from './workoutActions'
import { SetRow } from './SetRow'
import { ConfirmDialog } from './ConfirmDialog'
import styles from './WorkoutExerciseCard.module.css'

export interface WorkoutExerciseCardProps {
  db: RepwiseDatabase
  workoutExercise: WorkoutExercise
  sets: WorkoutSet[]
  unit: WeightUnit
  onSetCompleted: (restSeconds: number, workoutExerciseId: string) => void
}

export function WorkoutExerciseCard({ db, workoutExercise, sets, unit, onSetCompleted }: WorkoutExerciseCardProps) {
  const previous = usePreviousPerformance(db, workoutExercise.exerciseId, workoutExercise.workoutId)
  const [notesText, setNotesText] = useState(workoutExercise.notes)
  const [restText, setRestText] = useState(String(workoutExercise.restSeconds))
  const [restError, setRestError] = useState<string | undefined>()
  const [newSetType, setNewSetType] = useState<SetType>('working')
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [substitutionsOpen, setSubstitutionsOpen] = useState(false)
  const notesId = useId()
  const restId = useId()
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
  const progression = useLiveQuery(async () => {
    const [instances, completedWorkouts, settings] = await Promise.all([
      db.workoutExercises.where('exerciseId').equals(workoutExercise.exerciseId).toArray(),
      db.workouts.where('status').equals('completed').toArray(),
      db.settings.get('default'),
    ])
    const completedIds = new Set(completedWorkouts.map((workout) => workout.id))
    const priorIds = instances.filter((instance) => instance.id !== workoutExercise.id && completedIds.has(instance.workoutId)).map((instance) => instance.id)
    if (priorIds.length === 0) return undefined
    const history = await db.sets.where('workoutExerciseId').anyOf(priorIds).toArray()
    if (history.length === 0) return undefined
    return new DoubleProgressionEngine().suggest(history, settings?.trainingGoal ?? 'hypertrophy', 2.5)
  }, [db, workoutExercise.exerciseId, workoutExercise.id])

  useEffect(() => setNotesText(workoutExercise.notes), [workoutExercise.notes])
  useEffect(() => setRestText(String(workoutExercise.restSeconds)), [workoutExercise.restSeconds])

  function commitNotes() {
    if (notesText !== workoutExercise.notes) void updateWorkoutExercise(db, { ...workoutExercise, notes: notesText })
  }

  function commitRest() {
    const parsed = Number(restText.trim())
    const errors = validateSetFields({ durationSeconds: parsed })
    if (errors.durationSeconds) {
      setRestError('Rest must be zero or greater.')
      return
    }
    setRestError(undefined)
    if (parsed !== workoutExercise.restSeconds) void updateWorkoutExercise(db, { ...workoutExercise, restSeconds: parsed })
  }

  function handleRequestRemove() {
    if (sets.length === 0) {
      void removeWorkoutExercise(db, workoutExercise.id)
      return
    }
    setConfirmRemoveOpen(true)
  }

  async function handleAddSet() {
    await addSet(db, workoutExercise.id, newSetType, sets)
  }

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
    if (!candidate || sets.some((set) => set.completed)) return
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

  const previousSummary = previous.status === 'ready' && previous.value ? summarizeWorkingSets(previous.value.sets, (kg) => formatWeight(kg, unit)) : undefined

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3>{workoutExercise.snapshot.name}</h3>
          <p className={styles.meta}>
            {workoutExercise.snapshot.equipment[0] ?? 'bodyweight'} · {workoutExercise.snapshot.movementPattern}
          </p>
        </div>
        <button type="button" className={styles.removeButton} onClick={handleRequestRemove} aria-label={`Remove ${workoutExercise.snapshot.name}`}>
          ×
        </button>
      </div>

      {previousSummary && (
        <p className={styles.previous}>
          <strong>Last time:</strong> {previousSummary}
        </p>
      )}
      {progression.status === 'ready' && progression.value && <p className={styles.progression}><strong>Next target:</strong> {progression.value.reason}{progression.value.targetLoadKg === undefined ? '' : ` · ${formatWeight(progression.value.targetLoadKg, unit)}`}{progression.value.targetReps === undefined ? '' : ` × ${progression.value.targetReps}`}</p>}

      <div className={styles.substitutionArea}>
        <button type="button" className={styles.substituteButton} onClick={() => setSubstitutionsOpen((open) => !open)} disabled={sets.some((set) => set.completed)}>
          {substitutionsOpen ? 'Close alternatives' : 'Find a substitute'}
        </button>
        {sets.some((set) => set.completed) && <span>Substitution is locked after a set is completed to preserve workout facts.</span>}
        {substitutionsOpen && substitutions.status === 'loading' && <p role="status">Ranking alternatives…</p>}
        {substitutionsOpen && substitutions.status === 'error' && <p role="alert">Could not rank alternatives: {substitutions.message}</p>}
        {substitutionsOpen && substitutions.status === 'ready' && (
          <ol className={styles.substitutions}>
            {substitutions.value.map((candidate) => <li key={candidate.exercise.id}><div><strong>{candidate.exercise.name}</strong><span>{candidate.score.toFixed(0)}/100</span></div><p>{candidate.reasons.slice(0, 2).join(' · ')}</p><button type="button" onClick={() => void substitute(candidate.exercise.id)}>Use this exercise</button></li>)}
          </ol>
        )}
      </div>

      <div className={styles.settingsRow}>
        <div className={styles.settingsField}>
          <label htmlFor={notesId}>Notes</label>
          <input id={notesId} type="text" value={notesText} onChange={(e) => setNotesText(e.target.value)} onBlur={commitNotes} />
        </div>
        <div className={styles.settingsField}>
          <label htmlFor={restId}>Rest (s)</label>
          <input
            id={restId}
            type="number"
            inputMode="numeric"
            min={0}
            value={restText}
            onChange={(e) => setRestText(e.target.value)}
            onBlur={commitRest}
            aria-invalid={restError ? 'true' : undefined}
            aria-describedby={restError ? `${restId}-error` : undefined}
          />
          {restError && (
            <p id={`${restId}-error`} className={styles.fieldError} role="alert">
              {restError}
            </p>
          )}
        </div>
      </div>

      {sets.length > 0 && (
        <ul className={styles.setList}>
          {sets.map((set, index) => (
            <SetRow
              key={set.id}
              set={set}
              index={index}
              unit={unit}
              onCommitField={(field, value) => handleCommitField(set, field, value)}
              onChangeType={(type) => updateSetFields(db, set.id, { type })}
              onToggleComplete={() => handleToggleComplete(set)}
              onRemove={() => void removeSet(db, set.id)}
            />
          ))}
        </ul>
      )}

      <div className={styles.addSetRow}>
        <select aria-label="New set type" value={newSetType} onChange={(e) => setNewSetType(e.target.value as SetType)}>
          <option value="warmup">Warmup</option>
          <option value="working">Working</option>
          <option value="backoff">Backoff</option>
          <option value="dropset">Dropset</option>
          <option value="failure">Failure</option>
        </select>
        <button type="button" className={styles.addSetButton} onClick={() => void handleAddSet()}>
          Add set
        </button>
      </div>

      {confirmRemoveOpen && (
        <ConfirmDialog
          title={`Remove ${workoutExercise.snapshot.name}?`}
          description="This removes all recorded sets for this exercise from the workout. This cannot be undone."
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            setConfirmRemoveOpen(false)
            void removeWorkoutExercise(db, workoutExercise.id)
          }}
          onCancel={() => setConfirmRemoveOpen(false)}
        />
      )}
    </article>
  )
}
