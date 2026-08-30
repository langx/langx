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
export const BADGE_KINDS = ['streak', 'correction', 'messages', 'tokens', 'veteran'] as const
export type BadgeKind = (typeof BADGE_KINDS)[number]

/**
 * Every kind has to be **monotonic** — a number that can only go up.
 *
 * That is not a style rule, it is what makes a badge a badge: `streak` reads
 * `longest` rather than `current` precisely so a broken streak does not take
 * one away. It is also why followers and banked freezes are not kinds here,
 * tempting as they are: both go down, and an achievement that can be revoked
 * is not an achievement.
 */
export interface BadgeDefinition {
  id: string
  kind: BadgeKind
  /**
   * What the kind counts: days for `streak` and `veteran`, corrections
   * written, messages sent, tokens ever earned.
   */
  threshold: number
  label: string
  /**
   * Feather glyph name, or `null` for the one kind drawn with an emoji.
   *
   * On the definition rather than switched on in the grid: the icon is a
   * property of the kind, and a `kind === 'streak' ? … : …` ternary silently
   * gave every new kind the correction tick.
   */
  icon: string | null
}

/**
 * Correction milestones. Unlike the streak ones these have no payout to be read
 * off, so they are written here — chosen as one, then roughly a decade apart, so
 * the next badge is always visible without ever being close.
 */
const CORRECTION_THRESHOLDS = [1, 10, 100, 1000, 5000, 10_000, 25_000] as const

/** Messages sent, lifetime. `profile.stats.messagesSent`, which only ever grows. */
const MESSAGE_THRESHOLDS = [100, 1000, 10_000, 50_000] as const

/**
 * Tokens **earned**, lifetime — the all-time aggregate, never the balance.
 * Spending is deliberately kept out of `tokenAggregates`, so buying a frame
 * cannot cost somebody a badge they already had.
 */
const TOKEN_THRESHOLDS = [10_000, 50_000, 250_000] as const

/**
 * Days since the account was created. One, two and three years.
 *
 * Loyalty rather than effort, and that is the point of having it beside
 * `streak.1095`: three years of turning up is reachable, three years without
 * missing a day is not, and the easy one is what stops the hard one reading as
 * decoration.
 */
const VETERAN_THRESHOLDS = [365, 730, 1095] as const

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
      icon: null,
    })),
  ...CORRECTION_THRESHOLDS.map((count) => ({
    id: `correction.${count}`,
    kind: 'correction' as const,
    threshold: count,
    label: correctionLabel(count),
    icon: 'check',
  })),
  ...MESSAGE_THRESHOLDS.map((count) => ({
    id: `messages.${count}`,
    kind: 'messages' as const,
    threshold: count,
    label: `${count.toLocaleString('en-US')} messages`,
    icon: 'message-square',
  })),
  ...TOKEN_THRESHOLDS.map((count) => ({
    id: `tokens.${count}`,
    kind: 'tokens' as const,
    threshold: count,
    label: `${count.toLocaleString('en-US')} tokens earned`,
    icon: 'award',
  })),
  ...VETERAN_THRESHOLDS.map((days) => ({
    id: `veteran.${days}`,
    kind: 'veteran' as const,
    threshold: days,
    label: `${days} days a member`,
    icon: 'calendar',
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
  icon: z.string().nullable(),
  earned: z.boolean(),
  /**
   * When it was earned, if that is knowable. A streak badge has the ledger row
   * that paid the milestone, and a veteran badge is `createdAt` plus its own
   * threshold. The counting kinds have no date at all: the count is a total,
   * and nothing records which correction was the thousandth.
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
   *
   * "Nearest" is by fraction of the way there, not by position in `BADGES`.
   * Taking the first unearned entry was defensible with two kinds and is not
   * with five: it would offer a three-year streak to somebody one correction
   * short of a badge they could earn this afternoon.
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
