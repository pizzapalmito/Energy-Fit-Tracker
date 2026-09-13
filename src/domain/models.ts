export type EntityId = string
export type ISODateTime = string
export type SetType = 'warmup' | 'working' | 'backoff' | 'dropset' | 'failure'
export type TrainingGoal = 'strength' | 'hypertrophy' | 'general' | 'endurance' | 'maintenance'
export type SubjectiveState = 'very_sore' | 'sore' | 'normal' | 'fresh'

export interface MuscleContribution { muscleId: EntityId; weight: number }
export interface Exercise {
  id: EntityId; name: string; aliases: string[]; category: string; movementPattern: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced'; mechanic: 'compound' | 'isolation' | 'unknown';
  equipment: string[]; instructions: string[]; muscles: MuscleContribution[]; substitutionGroup?: string;
  defaultRestSeconds: number; media: string[]; source: 'catalog' | 'custom'; excluded: boolean;
}
export interface Workout { id: EntityId; date: string; startTime: ISODateTime; endTime?: ISODateTime; name: string; notes: string; status: 'active' | 'completed' | 'discarded' }
export interface ExerciseSnapshot { name: string; equipment: string[]; movementPattern: string; muscles: MuscleContribution[]; catalogVersion: string }
export interface WorkoutExercise { id: EntityId; workoutId: EntityId; exerciseId: EntityId; order: number; notes: string; restSeconds: number; snapshot: ExerciseSnapshot }
export interface WorkoutSet { id: EntityId; workoutExerciseId: EntityId; setNumber: number; type: SetType; loadKg?: number; reps?: number; durationSeconds?: number; distanceMeters?: number; rir?: number; rpe?: number; completed: boolean; completedAt?: ISODateTime }
export interface RecoveryFeedback { id: EntityId; muscleId: EntityId; date: string; subjectiveState: SubjectiveState }
