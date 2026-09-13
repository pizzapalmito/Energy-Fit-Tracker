// Shared constants for how catalog import and downstream engines represent
// "how much a muscle is involved" in a given exercise. Kept in one place so
// the importer (which assigns weights) and the engines (which consume them)
// never drift apart.
export const PRIMARY_CONTRIBUTION_WEIGHT = 1
export const SECONDARY_CONTRIBUTION_WEIGHT = 0.5

// A muscle contribution at or above this weight is treated as a "primary"
// muscle for scoring purposes (substitution similarity, generator targeting).
export const PRIMARY_WEIGHT_THRESHOLD = 0.75
