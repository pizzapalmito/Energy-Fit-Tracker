import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db as appDb } from '../../data/appDatabase'
import type { RepwiseDatabase } from '../../data/db'
import { useLiveQuery } from '../../data/useLiveQuery'
import type { GeneratedWorkout, GeneratorInput, WorkoutSplit } from '../../domain/contracts'
import type { TrainingGoal, WorkoutSet } from '../../domain/models'
import { DeterministicWorkoutGenerator } from '../../engines/generator/generatorEngine'
import { DeterministicRecoveryEngine } from '../../engines/recovery/recoveryEngine'
import { useI18n } from '../../i18n/I18nContext'
import { muscleLabel, trainingGoalLabel, splitLabel } from '../../i18n/enumLabels'
import { formatGeneratorReason, formatPlanName } from '../../i18n/generatorPresentation'
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
  const { t, formatNumber } = useI18n()
  const source = useLiveQuery(() => loadInputs(db), [db])
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy')
  const [split, setSplit] = useState<WorkoutSplit>('full_body')
  const [durationText, setDurationText] = useState('60')
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
    if (source.value.settings?.defaultDurationMinutes) setDurationText(String(source.value.settings.defaultDurationMinutes))
  }, [source])

  const duration = Number(durationText)
  const durationValid = durationText.trim() !== '' && Number.isFinite(duration) && duration >= 15 && duration <= 180

  function generate() {
    if (source.status !== 'ready' || !durationValid) return
    const nextInput: GeneratorInput = { goal, split, durationMinutes: duration, availableEquipment: source.value.equipment, excludedExerciseIds: [], seed: new Date().toISOString().slice(0, 10), recentSuccessfulLoadByExerciseId: source.value.recentSuccessfulLoadByExerciseId, ...(split === 'custom' ? { customTargetMuscleIds: customTargets.split(',').map((target) => target.trim()).filter(Boolean) } : {}) }
    setInput(nextInput)
    setPlan(new DeterministicWorkoutGenerator().generate(nextInput, source.value.exercises, source.value.recovery))
  }

  async function startPlan() {
    if (!plan || !input || source.status !== 'ready' || plan.exercises.length === 0) return
    setStarting(true)
    try {
      const workout = await startWorkout(db, formatPlanName(t, plan.name))
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
      <div className={styles.heading}><div><p className={styles.eyebrow}>{t('generator.eyebrow')}</p><h2 id="generator-title">{t('generator.title')}</h2></div><span>{t('generator.localDeterministic')}</span></div>
      {source.status === 'ready' && <div className={styles.readiness} aria-label={t('generator.readinessAriaLabel')}>{source.value.recovery.length === 0 ? <span>{t('generator.baselineReadiness')}</span> : source.value.recovery.slice().sort((a, b) => b.recommendationReadiness - a.recommendationReadiness).slice(0, 4).map((entry) => <span key={entry.muscleId}>{muscleLabel(t, entry.muscleId)} <strong>{t('generator.readinessPercent', { percent: Math.round(entry.recommendationReadiness) })}</strong></span>)}</div>}
      <div className={styles.controls}>
        <label>{t('generator.goalLabel')}<select value={goal} onChange={(event) => setGoal(event.target.value as TrainingGoal)}>{['strength', 'hypertrophy', 'general', 'endurance', 'maintenance'].map((value) => <option key={value} value={value}>{trainingGoalLabel(t, value)}</option>)}</select></label>
        <label>{t('generator.splitLabel')}<select value={split} onChange={(event) => setSplit(event.target.value as WorkoutSplit)}>{['full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'recovery_adaptive', 'custom'].map((value) => <option key={value} value={value}>{splitLabel(t, value)}</option>)}</select></label>
        <label>{t('generator.minutesLabel')}<input type="number" min="15" max="180" step="5" value={durationText} aria-label={t('generator.minutesLabel')} aria-invalid={!durationValid ? 'true' : undefined} aria-describedby="generator-duration-help" onChange={(event) => setDurationText(event.target.value)} /><span id="generator-duration-help" className={!durationValid ? styles.fieldError : styles.fieldHint}>{t('generator.minutesRange')}</span></label>
        {split === 'custom' && <label className={styles.customTargets}>{t('generator.customTargetsLabel')}<input value={customTargets} onChange={(event) => setCustomTargets(event.target.value)} /></label>}
        <button type="button" onClick={generate} disabled={source.status !== 'ready' || !durationValid}>{t('generator.generate')}</button>
      </div>
      {source.status === 'error' && <p role="alert">{t('generator.dataUnavailable', { message: source.message })}</p>}
      {plan && <div className={styles.result}>
        <div className={styles.resultHeader}><div><strong>{formatPlanName(t, plan.name)}</strong><span>{t('generator.estimatedMinutes', { minutes: Math.round(plan.estimatedDurationSeconds / 60) })}</span></div><button type="button" onClick={() => void startPlan()} disabled={starting || source.status !== 'ready' || source.value.hasActiveWorkout || plan.exercises.length === 0}>{source.status === 'ready' && source.value.hasActiveWorkout ? t('generator.finishActiveFirst') : t('generator.startThisWorkout')}</button></div>
        {plan.exercises.length === 0 ? <p>{t('generator.noExercisesFit')}</p> : <ol>{plan.exercises.map((item) => <li key={item.exerciseId}><div><strong>{catalogById.get(item.exerciseId)?.name ?? item.exerciseId}</strong><span>{t('generator.setsByReps', { sets: item.sets, low: item.repRange[0], high: item.repRange[1], rest: item.restSeconds })}</span></div><p>{item.reasons.map((reason) => formatGeneratorReason(t, formatNumber, reason)).join(' · ')}</p></li>)}</ol>}
      </div>}
    </section>
  )
}
