export type WeightUnit = 'kg' | 'lb'

/** Exact kilograms-per-pound conversion factor. */
export const KG_PER_LB = 0.45359237

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Canonical kg -> display value in the given unit, rounded to hundredths for stable round-tripping. */
export function kgToDisplayWeight(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? round2(kg) : round2(kg / KG_PER_LB)
}

/** Display value (in the given unit) -> canonical kg, rounded to hundredths. */
export function displayWeightToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? round2(value) : round2(value * KG_PER_LB)
}

export function formatWeight(kg: number | undefined, unit: WeightUnit): string {
  if (kg === undefined) return '—'
  return `${kgToDisplayWeight(kg, unit)}${unit}`
}
