export interface SetFieldInput {
  loadKg?: number
  reps?: number
  durationSeconds?: number
  distanceMeters?: number
  rir?: number
  rpe?: number
}

export interface SetFieldErrors {
  loadKg?: string
  reps?: string
  durationSeconds?: string
  distanceMeters?: string
  rir?: string
  rpe?: string
}

function nonNegativeFiniteError(value: number | undefined, label: string): string | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 0) return `${label} must be a number that is zero or greater.`
  return undefined
}

/** Validates the subset of fields present on `input`; absent fields are not errors (partial edits are allowed). */
export function validateSetFields(input: SetFieldInput): SetFieldErrors {
  const errors: SetFieldErrors = {}

  const loadError = nonNegativeFiniteError(input.loadKg, 'Load')
  if (loadError) errors.loadKg = loadError

  const repsError = nonNegativeFiniteError(input.reps, 'Reps')
  if (repsError) errors.reps = repsError

  const durationError = nonNegativeFiniteError(input.durationSeconds, 'Duration')
  if (durationError) errors.durationSeconds = durationError

  const distanceError = nonNegativeFiniteError(input.distanceMeters, 'Distance')
  if (distanceError) errors.distanceMeters = distanceError

  if (input.rir !== undefined && (!Number.isFinite(input.rir) || input.rir < 0 || input.rir > 10)) {
    errors.rir = 'RIR must be between 0 and 10.'
  }

  if (input.rpe !== undefined && (!Number.isFinite(input.rpe) || input.rpe < 1 || input.rpe > 10)) {
    errors.rpe = 'RPE must be between 1 and 10.'
  }

  return errors
}

export function hasSetFieldErrors(errors: SetFieldErrors): boolean {
  return Object.keys(errors).length > 0
}
