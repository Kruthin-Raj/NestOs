/**
 * Roommate compatibility scoring.
 *
 * Only meaningful for a **shared** room that already has occupants: a private
 * room has nobody to be compatible with, and an empty shared room has nothing
 * to compare against. Callers must check that before showing a score.
 *
 * The score answers one question — "how much would living with these people
 * annoy me?" — so every dimension is a lifestyle habit that causes friction in
 * practice. Weights reflect how much friction, not how easy it is to measure.
 */

export interface LifestylePreferences {
  smoking?: string | null
  drinking?: string | null
  foodPreference?: string | null
  sleepSchedule?: string | null
  cleanlinessLevel?: string | null
}

interface Dimension {
  key: keyof LifestylePreferences
  weight: number
  label: string
  /** 1 = perfect, 0 = worst. Undefined on either side means "cannot tell". */
  score: (a: string, b: string) => number
}

/** Ordered scales: neighbouring values clash less than opposite ends. */
function ordinal(scale: string[]) {
  return (a: string, b: string) => {
    const ia = scale.indexOf(a)
    const ib = scale.indexOf(b)
    if (ia === -1 || ib === -1) return 0.5
    const spread = scale.length - 1
    return spread === 0 ? 1 : 1 - Math.abs(ia - ib) / spread
  }
}

const DIMENSIONS: Dimension[] = [
  {
    key: 'smoking',
    weight: 3,
    label: 'Smoking',
    // The sharpest divide in shared housing, so a mismatch costs the most.
    score: ordinal(['NEVER', 'OCCASIONALLY', 'REGULARLY']),
  },
  {
    key: 'cleanlinessLevel',
    weight: 3,
    label: 'Cleanliness',
    score: ordinal(['VERY_CLEAN', 'MODERATE', 'RELAXED']),
  },
  {
    key: 'sleepSchedule',
    weight: 2,
    label: 'Sleep schedule',
    // FLEXIBLE sits between the two, so it clashes with neither.
    score: ordinal(['EARLY_BIRD', 'FLEXIBLE', 'NIGHT_OWL']),
  },
  {
    key: 'drinking',
    weight: 2,
    label: 'Drinking',
    score: ordinal(['NEVER', 'OCCASIONALLY', 'REGULARLY']),
  },
  {
    key: 'foodPreference',
    weight: 2,
    label: 'Food',
    // Not a scale. Sharing a kitchen only really matters between veg and
    // non-veg; ANY gets along with everyone.
    score: (a, b) => {
      if (a === b) return 1
      if (a === 'ANY' || b === 'ANY') return 1
      const veg = (v: string) => v === 'VEG' || v === 'JAIN'
      if (veg(a) !== veg(b)) return 0.3
      return 0.7
    },
  },
]

export interface CompatibilityResult {
  /** 0-100, or null when there is not enough shared information to judge. */
  score: number | null
  /** Dimensions both sides answered, best first. */
  matches: Array<{ label: string; score: number }>
  /** Where they differ most — the useful part for a tenant deciding. */
  clashes: Array<{ label: string; score: number }>
  comparedWith: number
}

/**
 * Scores a prospective tenant against the people already in a room.
 *
 * Returns null when nothing can be compared, rather than a misleading 0 or 50 —
 * "we don't know" and "you clash" are very different things to show someone.
 */
export function scoreCompatibility(
  viewer: LifestylePreferences | null | undefined,
  occupants: Array<LifestylePreferences | null | undefined>
): CompatibilityResult {
  const present = occupants.filter(Boolean) as LifestylePreferences[]

  if (!viewer || present.length === 0) {
    return { score: null, matches: [], clashes: [], comparedWith: present.length }
  }

  const perDimension: Array<{ label: string; weight: number; score: number }> = []

  for (const dim of DIMENSIONS) {
    const mine = viewer[dim.key]
    if (!mine) continue

    const theirs = present
      .map((o) => o[dim.key])
      .filter((v): v is string => Boolean(v))

    if (theirs.length === 0) continue

    // Average across occupants: one incompatible person in a four-bed room
    // should lower the score, not veto it.
    const avg = theirs.reduce((sum, t) => sum + dim.score(mine, t), 0) / theirs.length
    perDimension.push({ label: dim.label, weight: dim.weight, score: avg })
  }

  if (perDimension.length === 0) {
    return { score: null, matches: [], clashes: [], comparedWith: present.length }
  }

  const totalWeight = perDimension.reduce((s, d) => s + d.weight, 0)
  const weighted = perDimension.reduce((s, d) => s + d.score * d.weight, 0)
  const score = Math.round((weighted / totalWeight) * 100)

  const sorted = [...perDimension].sort((a, b) => b.score - a.score)

  return {
    score,
    matches: sorted.filter((d) => d.score >= 0.75).map(({ label, score }) => ({ label, score })),
    clashes: sorted.filter((d) => d.score < 0.5).reverse().map(({ label, score }) => ({ label, score })),
    comparedWith: present.length,
  }
}
