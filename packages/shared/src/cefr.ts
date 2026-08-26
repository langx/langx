import { z } from 'zod'

/**
 * CEFR proficiency levels, ordered from lowest to highest.
 *
 * Both the discovery filter UI and the `profiles.learning[].level` field read
 * this list — the filter cannot offer a level the database does not store.
 */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const cefrLevelSchema = z.enum(CEFR_LEVELS)

/** Rank of a level, 1 (A1) through 6 (C2). Used for `>=` style filters. */
export function cefrRank(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level) + 1
}

export const CEFR_LABELS: Record<CefrLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
}
