import type { ScoredExercise, SubstitutionEngine } from '../../domain/contracts'
import type { Exercise } from '../../domain/models'
import { PRIMARY_WEIGHT_THRESHOLD } from '../shared/muscleContribution'

export const SUBSTITUTION_ENGINE_VERSION = 'substitution-v1'

/** Point budget for each scoring factor; must total 100. */
export const SUBSTITUTION_WEIGHTS = {
  primarySimilarity: 40,
  exactMovement: 30,
  equipmentOverlap: 10,
  difficultyProximity: 10,
  secondarySimilarity: 10,
} as const

const DIFFICULTY_ORDER: Record<Exercise['difficulty'], number> = { beginner: 0, intermediate: 1, advanced: 2 }
const MAX_DIFFICULTY_DISTANCE = 2
const ALWAYS_AVAILABLE_EQUIPMENT = 'bodyweight'

function primaryMuscleIds(exercise: Exercise): Set<string> {
  return new Set(exercise.muscles.filter((m) => m.weight >= PRIMARY_WEIGHT_THRESHOLD).map((m) => m.muscleId))
}

function secondaryMuscleIds(exercise: Exercise): Set<string> {
  return new Set(exercise.muscles.filter((m) => m.weight < PRIMARY_WEIGHT_THRESHOLD).map((m) => m.muscleId))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const item of a) if (b.has(item)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function isEquipmentAvailable(exercise: Exercise, availableEquipment: readonly string[]): boolean {
  const available = new Set(availableEquipment)
  return exercise.equipment.every((eq) => eq === ALWAYS_AVAILABLE_EQUIPMENT || available.has(eq))
}

/**
 * Deterministic, pure substitution engine. Scores candidates 0-100 across
 * five weighted factors and filters out the current exercise, exercises
 * flagged `excluded`, and exercises requiring unavailable equipment.
 * Ties are broken by exercise id (ascending) for stable, reproducible order.
 */
export class WeightedSubstitutionEngine implements SubstitutionEngine {
  rank(source: Exercise, candidates: Exercise[], availableEquipment: string[]): ScoredExercise[] {
    const sourcePrimary = primaryMuscleIds(source)
    const sourceSecondary = secondaryMuscleIds(source)
    const sourceEquipment = new Set(source.equipment)

    const scored: ScoredExercise[] = []

    for (const candidate of candidates) {
      if (candidate.id === source.id) continue
      if (candidate.excluded) continue
      if (!isEquipmentAvailable(candidate, availableEquipment)) continue

      const candidatePrimary = primaryMuscleIds(candidate)
      const candidateSecondary = secondaryMuscleIds(candidate)

      const primaryScore = jaccard(sourcePrimary, candidatePrimary) * SUBSTITUTION_WEIGHTS.primarySimilarity
      const movementScore = candidate.movementPattern === source.movementPattern ? SUBSTITUTION_WEIGHTS.exactMovement : 0
      const equipmentScore = jaccard(sourceEquipment, new Set(candidate.equipment)) * SUBSTITUTION_WEIGHTS.equipmentOverlap
      const difficultyDistance = Math.abs(DIFFICULTY_ORDER[source.difficulty] - DIFFICULTY_ORDER[candidate.difficulty])
      const difficultyScore = (1 - difficultyDistance / MAX_DIFFICULTY_DISTANCE) * SUBSTITUTION_WEIGHTS.difficultyProximity
      const secondaryScore = jaccard(sourceSecondary, candidateSecondary) * SUBSTITUTION_WEIGHTS.secondarySimilarity

      const score = primaryScore + movementScore + equipmentScore + difficultyScore + secondaryScore

      const reasons = [
        `primary muscle similarity: ${primaryScore.toFixed(1)}/${SUBSTITUTION_WEIGHTS.primarySimilarity}`,
        movementScore > 0
          ? `exact movement pattern match "${candidate.movementPattern}": ${movementScore}/${SUBSTITUTION_WEIGHTS.exactMovement}`
          : `movement pattern differs ("${candidate.movementPattern}" vs "${source.movementPattern}"): 0/${SUBSTITUTION_WEIGHTS.exactMovement}`,
        `equipment overlap: ${equipmentScore.toFixed(1)}/${SUBSTITUTION_WEIGHTS.equipmentOverlap}`,
        `difficulty proximity (${source.difficulty} vs ${candidate.difficulty}): ${difficultyScore.toFixed(1)}/${SUBSTITUTION_WEIGHTS.difficultyProximity}`,
        `secondary muscle similarity: ${secondaryScore.toFixed(1)}/${SUBSTITUTION_WEIGHTS.secondarySimilarity}`,
      ]

      scored.push({ exercise: candidate, score, reasons })
    }

    return scored.sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))
  }
}
