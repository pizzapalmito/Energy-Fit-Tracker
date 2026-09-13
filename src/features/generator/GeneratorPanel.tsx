import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import type { GeneratedWorkout, GeneratorInput, WorkoutSplit } from '../../domain/contracts'
import type { TrainingGoal, WorkoutSet } from '../../domain/models'
import { DeterministicWorkoutGenerator } from '../../engines/generator/generatorEngine'
import { DeterministicRecoveryEngine } from '../../engines/recovery/recoveryEngine'
import { createId } from '../workout/id'
import { addExerciseToWorkout, addSet, saveSet, startWorkout, updateWorkoutExercise } from '../workout/workoutActions'
import styles from './GeneratorPanel.module.css'

async function loadInputs(db: RepwiseDatabase) {
  const [exercises, workouts, workoutExercises, sets, feedback, settings, profiles] = await Promise.all([
    db.exercises.toArray(), db.workouts.toArray(), db.workoutExercises.toArray(), db.sets.toArray(),
    db.recoveryFeedback.toArray(), db.settings.get('default'), db.equipmentProfiles.toArray(),
  ])
  const recovery = new DeterministicRecoveryEngine().calculate(new Date().toISOString(), workouts, workoutExercises, sets, feedback)
  const profile = profiles.find((entry) => entry.id === settings?.activeEquipmentProfileId)
  const equipment = profile?.availableEquipment ?? [...new Set(exercises.flatMap((exercise) => exercise.equipment))]
  const instanceById = new Map(workoutExercises.map((entry) => [entry.id, entry]))
  const recentLoad = new Map<string, { load: number; at: string }>()
  for (const set of sets) {
    const instance = instanceById.get(set.workoutExerciseId)
    if (!instance || !set.completed || set.type !== 'working' || set.loadKg === undefined) continue
    const at = set.completedAt ?? ''
    if (at >= (recentLoad.get(instance.exerciseId)?.at ?? '')) recentLoad.set(instance.exerciseId, { load: set.loadKg, at })
  }
  return { exercises, recovery, equipment, settings, recentSuccessfulLoadByExerciseId: Object.fromEntries([...recentLoad].map(([id, value]) => [id, value.load])), hasActiveWorkout: workouts.some((workout) => workout.status === 'active') }
}

export function GeneratorPanel({ db = appDb }: { db?: RepwiseDatabase }) {
  const navigate = useNavigate()
  const source = useLiveQuery(() => loadInputs(db), [db])
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy')
  const [split, setSplit] = useState<WorkoutSplit>('full_body')
  const [duration, setDuration] = useState(60)
  const [customTargets, setCustomTargets] = useState('chest,lats,quadriceps')
  const [plan, setPlan] = useState<GeneratedWorkout>()
  const [input, setInput] = useState<GeneratorInput>()
  const [starting, setStarting] = useState(false)
  const preferencesLoaded = useRef(false)
  const catalogById = useMemo(() => new Map(source.status === 'ready' ? source.value.exercises.map((exercise) => [exercise.id, exercise]) : []), [source])

  useEffect(() => {
    if (source.status !== 'ready' || preferencesLoaded.current) return
    preferencesLoaded.current = true
    if (source.value.settings?.trainingGoal) setGoal(source.value.settings.trainingGoal)
    if (source.value.settings?.preferredSplit) setSplit(source.value.settings.preferredSplit)
    if (source.value.settings?.defaultDurationMinutes) setDuration(source.value.settings.defaultDurationMinutes)
  }, [source])

  function generate() {
    if (source.status !== 'ready') return
    const nextInput: GeneratorInput = { goal, split, durationMinutes: duration, availableEquipment: source.value.equipment, excludedExerciseIds: [], seed: new Date().toISOString().slice(0, 10), recentSuccessfulLoadByExerciseId: source.value.recentSuccessfulLoadByExerciseId, ...(split === 'custom' ? { customTargetMuscleIds: customTargets.split(',').map((target) => target.trim()).filter(Boolean) } : {}) }
    setInput(nextInput)
    setPlan(new DeterministicWorkoutGenerator().generate(nextInput, source.value.exercises, source.value.recovery))
  }

  async function startPlan() {
    if (!plan || !input || source.status !== 'ready' || plan.exercises.length === 0) return
    setStarting(true)
    try {
      const workout = await startWorkout(db, plan.name)
      for (const planned of plan.exercises) {
        const exercise = catalogById.get(planned.exerciseId)
        if (!exercise) continue
        const workoutExercise = await addExerciseToWorkout(db, workout.id, exercise)
        await updateWorkoutExercise(db, { ...workoutExercise, restSeconds: planned.restSeconds })
        const createdSets: WorkoutSet[] = []
        for (let index = 0; index < planned.sets; index += 1) {
          const set = await addSet(db, workoutExercise.id, 'working', createdSets)
          createdSets.push(set)
          await saveSet(db, { ...set, reps: planned.repRange[0], ...(planned.recommendedLoadKg === undefined ? {} : { loadKg: planned.recommendedLoadKg }) })
        }
      }
      await db.generatedPlans.put({ id: createId('plan'), createdAt: new Date().toISOString(), input, plan })
      void navigate('/workout')
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="generator-title">
      <div className={styles.heading}><div><p className={styles.eyebrow}>Recovery-aware</p><h2 id="generator-title">Build a workout</h2></div><span>Local · deterministic</span></div>
      {source.status === 'ready' && <div className={styles.readiness} aria-label="Most recovered muscle groups">{source.value.recovery.length === 0 ? <span>All muscle groups begin at a 100% readiness baseline.</span> : source.value.recovery.slice().sort((a, b) => b.recommendationReadiness - a.recommendationReadiness).slice(0, 4).map((entry) => <span key={entry.muscleId}>{entry.muscleId.replaceAll('-', ' ')} <strong>{Math.round(entry.recommendationReadiness)}%</strong></span>)}</div>}
      <div className={styles.controls}>
        <label>Goal<select value={goal} onChange={(event) => setGoal(event.target.value as TrainingGoal)}>{['strength', 'hypertrophy', 'general', 'endurance', 'maintenance'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Split<select value={split} onChange={(event) => setSplit(event.target.value as WorkoutSplit)}>{['full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'recovery_adaptive', 'custom'].map((value) => <option key={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        <label>Minutes<input type="number" min="15" max="180" step="5" value={duration} onChange={(event) => setDuration(Math.max(15, Number(event.target.value) || 15))} /></label>
        {split === 'custom' && <label className={styles.customTargets}>Target muscle IDs, comma separated<input value={customTargets} onChange={(event) => setCustomTargets(event.target.value)} /></label>}
        <button type="button" onClick={generate} disabled={source.status !== 'ready'}>Generate</button>
      </div>
      {source.status === 'error' && <p role="alert">Generator data is unavailable: {source.message}</p>}
      {plan && <div className={styles.result}>
        <div className={styles.resultHeader}><div><strong>{plan.name}</strong><span>{Math.round(plan.estimatedDurationSeconds / 60)} min estimated</span></div><button type="button" onClick={() => void startPlan()} disabled={starting || source.status !== 'ready' || source.value.hasActiveWorkout || plan.exercises.length === 0}>{source.status === 'ready' && source.value.hasActiveWorkout ? 'Finish active workout first' : 'Start this workout'}</button></div>
        {plan.exercises.length === 0 ? <p>No catalog exercises fit these equipment and time constraints.</p> : <ol>{plan.exercises.map((item) => <li key={item.exerciseId}><div><strong>{catalogById.get(item.exerciseId)?.name ?? item.exerciseId}</strong><span>{item.sets} × {item.repRange[0]}–{item.repRange[1]} · {item.restSeconds}s rest</span></div><p>{item.reasons.join(' · ')}</p></li>)}</ol>}
      </div>}
    </section>
  )
}
