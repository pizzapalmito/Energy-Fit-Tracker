import type { EntityId, Exercise, RecoveryFeedback, TrainingGoal, Workout, WorkoutExercise, WorkoutSet } from './models'

export interface WorkoutRepository {
  getActive(): Promise<Workout | undefined>
  saveWorkout(workout: Workout): Promise<void>
  saveExercise(exercise: WorkoutExercise): Promise<void>
  saveSet(set: WorkoutSet): Promise<void>
}
export interface ExerciseRepository { list(): Promise<Exercise[]>; get(id: string): Promise<Exercise | undefined> }
export interface RecoveryResult { muscleId: string; calculatedRecovery: number; recommendationReadiness: number; explanation: string[]; algorithmVersion: string }
export interface RecoveryEngine { calculate(now: string, workouts: Workout[], exercises: WorkoutExercise[], sets: WorkoutSet[], feedback: RecoveryFeedback[]): RecoveryResult[] }
export interface ScoredExercise { exercise: Exercise; score: number; reasons: string[] }
export interface SubstitutionEngine { rank(source: Exercise, candidates: Exercise[], availableEquipment: string[]): ScoredExercise[] }
export interface ProgressionSuggestion { action: 'increase_load' | 'increase_reps' | 'repeat' | 'reduce_load' | 'deload'; targetLoadKg?: number; targetReps?: number; reason: string }
export interface ProgressionEngine { suggest(history: WorkoutSet[], goal: TrainingGoal, incrementKg: number): ProgressionSuggestion }
export type WorkoutSplit = 'full_body' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'recovery_adaptive' | 'custom'
export interface GeneratorInput { goal: TrainingGoal; split: WorkoutSplit; durationMinutes: number; availableEquipment: string[]; excludedExerciseIds: string[]; seed: string; recentSuccessfulLoadByExerciseId?: Record<EntityId, number>; customTargetMuscleIds?: EntityId[] }
export interface GeneratedWorkout { name: string; exercises: Array<{ exerciseId: string; sets: number; repRange: [number, number]; restSeconds: number; reasons: string[]; recommendedLoadKg?: number }>; engineVersion: string; seed: string; estimatedDurationSeconds: number }
export interface WorkoutGenerator { generate(input: GeneratorInput, exercises: Exercise[], recovery: RecoveryResult[]): GeneratedWorkout }
export interface BackupService { exportJson(): Promise<Blob>; exportCsv(): Promise<Blob>; validate(file: File): Promise<{ valid: boolean; errors: string[]; recordCount: number }>; restore(file: File): Promise<void> }
