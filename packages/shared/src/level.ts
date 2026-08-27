import { z } from 'zod'

/**
 * How well someone speaks a language they are learning, on **v1's scale**.
 *
 * This replaced CEFR (`A1…C2`), and the reason is the migration rather than
 * taste. v1 stored a number, 0–3, and mapping it onto six CEFR bands was lossy
 * in both directions: the old `LEVEL_TO_CEFR` sent v1's top to `B2` on purpose,
 * with a comment admitting the compromise — "an inflated level produces
 * confident bad matches" — and `C1`/`C2` were bands no migrated user could ever
 * be in. Four tiers make the mapping exact and the compromise disappears.
 *
 * It is also a scale people can answer honestly. CEFR is a formal
 * qualification most speakers have never been assessed against, so on a
 * self-declared field it invites guessing; "beginner / fluent" does not.
 *
 * Ordered lowest to highest — `levelRank` and every `>=` filter depend on it.
 */
export const LANGUAGE_LEVELS = ['absoluteBeginner', 'beginner', 'intermediate', 'fluent'] as const

export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number]

export const languageLevelSchema = z.enum(LANGUAGE_LEVELS)

/** Rank of a level, 1 (absolute beginner) through 4 (fluent), for `>=` filters. */
export function levelRank(level: LanguageLevel): number {
  return LANGUAGE_LEVELS.indexOf(level) + 1
}

export const LEVEL_LABELS: Record<LanguageLevel, string> = {
  absoluteBeginner: 'Absolute beginner',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  fluent: 'Fluent',
}

/** Short form, for chips and filter rows where the full label does not fit. */
export const LEVEL_SHORT_LABELS: Record<LanguageLevel, string> = {
  absoluteBeginner: 'New',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  fluent: 'Fluent',
}

/**
 * v1's numeric scale, exactly. `-1` marked a mother tongue and never reaches
 * here; 0–3 are the learning levels, and each one has a counterpart rather
 * than an approximation of one.
 */
export const V1_LEVEL_TO_LANGUAGE_LEVEL: Record<number, LanguageLevel> = {
  0: 'absoluteBeginner',
  1: 'beginner',
  2: 'intermediate',
  3: 'fluent',
}

/**
 * The one-off conversion for data already stored as CEFR.
 *
 * Six bands collapse to four, so this loses information — deliberately, and in
 * the direction that under-claims: `C1` and `C2` both become `fluent` because
 * there is nothing above it, while `A1`/`A2` split at the boundary v1 itself
 * used. Nobody is promoted by this migration.
 */
export const CEFR_TO_LANGUAGE_LEVEL: Record<string, LanguageLevel> = {
  A1: 'absoluteBeginner',
  A2: 'beginner',
  B1: 'intermediate',
  B2: 'intermediate',
  C1: 'fluent',
  C2: 'fluent',
}
