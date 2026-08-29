import { z } from 'zod'
import { TOKEN_RULES } from './token'

/**
 * Badges are **derived**, never stored.
 *
 * Everything one could assert is already a fact the ledger or the profile
 * holds: a 30-day streak is `streak.longest >= 30`, a thousand corrections is a
 * count of `correction` rows. A `badges` collection would be a second copy of
 * those numbers, written from a different code path, and the first time the two
 * disagreed the badge would be the one lying.
 *
 * The catalogue is config for the same reason `TOKEN_RULES` is: the thresholds
 * are product decisions, and the streak ones are not even decisions made here —
 * they are read straight off the milestones that pay out, so a badge can never
 * appear for a streak length the economy does not recognise.
 */
export const BADGE_KINDS = ['streak', 'correction'] as const
export type BadgeKind = (typeof BADGE_KINDS)[number]

export interface BadgeDefinition {
  id: string
  kind: BadgeKind
  /** Days for a streak badge, corrections given for a correction badge. */
  threshold: number
  label: string
}

/**
 * Correction milestones. Unlike the streak ones these have no payout to be read
 * off, so they are written here — chosen as one, then roughly a decade apart, so
 * the next badge is always visible without ever being close.
 */
const CORRECTION_THRESHOLDS = [1, 10, 100, 1000, 5000] as const

function correctionLabel(threshold: number): string {
  return threshold === 1 ? 'First correction' : `${threshold.toLocaleString('en-US')} corrections`
}

export const BADGES: readonly BadgeDefinition[] = [
  ...Object.keys(TOKEN_RULES.streakMilestones)
    .map(Number)
    .sort((a, b) => a - b)
    .map((days) => ({
      id: `streak.${days}`,
      kind: 'streak' as const,
      threshold: days,
      label: `${days} days`,
    })),
  ...CORRECTION_THRESHOLDS.map((count) => ({
    id: `correction.${count}`,
    kind: 'correction' as const,
    threshold: count,
    label: correctionLabel(count),
  })),
]

export function findBadge(id: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.id === id)
}

export const earnedBadgeSchema = z.object({
  id: z.string(),
  kind: z.enum(BADGE_KINDS),
  threshold: z.number().int(),
  label: z.string(),
  earned: z.boolean(),
  /**
   * When it was earned, if that is knowable. Streak badges have a date — the
   * ledger row that paid the milestone — and correction badges do not: the
   * count is a total, and nothing records which correction was the thousandth.
   */
  earnedAt: z.string().nullable(),
})
export type EarnedBadge = z.infer<typeof earnedBadgeSchema>

/** `GET /me/badges`. */
export const badgeSummarySchema = z.object({
  badges: z.array(earnedBadgeSchema),
  earnedCount: z.number().int(),
  /**
   * The nearest unearned badge, or `null` when they are all earned. `current`
   * is where the user stands on that badge's own scale, so the client can draw
   * the bar without knowing which kind it is.
   */
  next: z
    .object({
      id: z.string(),
      kind: z.enum(BADGE_KINDS),
      label: z.string(),
      current: z.number().int(),
      threshold: z.number().int(),
      reward: z.number().int(),
    })
    .nullable(),
})
export type BadgeSummary = z.infer<typeof badgeSummarySchema>
