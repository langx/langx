import { z } from 'zod'
import { walletSchema } from './cosmetics'

/**
 * The token is a point, not a currency. It cannot be traded, withdrawn or
 * bought, and it can never buy a Pro feature — otherwise farming tokens becomes
 * a substitute for the subscription. The only sinks are a streak freeze and
 * cosmetics.
 *
 * v1 shipped the same name wrapped in on-chain framing (wallets, checkouts, a
 * `/token` leaderboard). That framing is gone in v2; the balances are not —
 * they migrate at `TOKEN_RULES.legacyTokenDivisor`.
 * The ledger below is still append-only, idempotent and period-bucketed —
 * that is correct engineering for any point economy (audit, dispute,
 * recompute), and it leaves the door open without committing to it.
 */

export const TOKEN_KINDS = [
  'message',
  'correction',
  'streak',
  'dailyPool',
  'adjustment',
  /** One-off credit for a v1 token balance, at `TOKEN_RULES.legacyTokenDivisor`. */
  'legacyTokenConversion',
  /** One-off bonus for a returning v1 user completing their restore. */
  'welcomeBack',
  /** One-off starting balance, so a new account has something to spend. */
  'signupBonus',
  /**
   * The only kind with a negative `amount`. Spends are recorded in the ledger
   * for audit but deliberately do **not** touch `tokenAggregates`: the
   * leaderboard ranks token *earned*, so buying a frame must never drop someone
   * down the table. Balance is `earned - spent`, tracked separately.
   */
  'spend',
] as const
export type TokenKind = (typeof TOKEN_KINDS)[number]

/**
 * Kinds that are **given**, not earned.
 *
 * These credit the all-time total — which is where a spendable balance comes
 * from — but deliberately not the week, month or year buckets the leaderboard
 * ranks. Nobody did anything this week to deserve them, and counting them
 * would put whoever signed up (or came back from v1) most recently above
 * whoever actually talked to people. On launch week that is not a hypothetical:
 * a returning user's converted v1 balance would top the weekly table with
 * tokens earned in 2023.
 *
 * `adjustment` is not here on purpose. It exists to correct a real award, so
 * it has to land in the same periods that award did.
 */
export const TOKEN_GRANT_KINDS = [
  'legacyTokenConversion',
  'welcomeBack',
  'signupBonus',
] as const satisfies readonly TokenKind[]

export function isGrantKind(kind: TokenKind): boolean {
  return (TOKEN_GRANT_KINDS as readonly TokenKind[]).includes(kind)
}
export const tokenKindSchema = z.enum(TOKEN_KINDS)

export interface TokenRules {
  /** Direct, immediate awards — the feedback loop. */
  award: {
    message: number
    correction: number
    /** Granted once per conversation, the first time both sides have spoken. */
    mutualConversation: number
  }
  caps: {
    /**
     * Max messages that pay per **UTC** day. This counts messages, not
     * tokens — the 101st message of the day awards nothing.
     *
     * Deliberately UTC, unlike the streak. A cap is a ceiling on ledger rows,
     * and ledger rows are bucketed by UTC day/week/month; if the cap reset on
     * the user's local day, moving the device clock east would open a second
     * cap window inside the same UTC day and pay both awards into the same
     * leaderboard bucket. That is exactly the "farm a period twice by flying
     * east" exploit periods.ts warns about. Only the streak is local.
     */
    messagesPerDay: number
    /** Max paying messages per partner per UTC day — blocks single-partner farming. */
    messagesPerPartnerPerDay: number
  }
  /** Bonus token at streak milestones, keyed by day count. */
  streakMilestones: Record<number, number>
  /** Daily pool, distributed at day close by cron in proportion to activity. */
  pool: {
    total: number
    /** Ceiling on one user's share, as a fraction of the pool. */
    maxShareOfPool: number
    /** Accounts younger than this earn no pool share. */
    accountAgeRampUpHours: number
    weights: {
      mutualConversations: number
      corrections: number
      messages: number
      distinctPartners: number
    }
    /** `messages` term is clamped to this before weighting. */
    messageCountCap: number
  }
  sinks: {
    streakFreeze: number
    /** How many freezes a user may bank at once — a freeze stockpile would make the streak meaningless. */
    maxBankedStreakFreezes: number
  }
  /**
   * v1 token balances are credited to **earned** token, divided by this.
   *
   * The two economies are not on the same scale. v1's balances run to a median
   * of 20 and a maximum of 2,277,521, while a very active day in v2 is about
   * 700 tokens — so a 1:1 credit would put the top account roughly nine years ahead
   * and freeze the all-time table permanently. Dividing by 100 leaves it about
   * 32 days ahead: still a head start, but one a new user can close.
   *
   * The cost is that everyone below 100 tokens — over half of them, since the
   * median is 20 — converts to nothing. That is accepted, because the
   * welcome-back bonus is what actually rewards a median user for returning;
   * the conversion is there to recognise the people who genuinely accumulated.
   */
  legacyTokenDivisor: number
  /** Flat bonus when a returning v1 user's profile is restored. */
  welcomeBackBonus: number
  /**
   * What a brand-new account starts with, so the token store is not inert on
   * day one. Set to the price of a streak freeze plus change: the freeze is
   * the one thing worth owning before you have earned anything, because it
   * protects the first day you miss — and buying it is how someone finds out
   * the economy is real.
   *
   * Deliberately below the cheapest cosmetic (500). A starting grant that buys
   * a frame outright would make the cheapest frame mean nothing.
   */
  signupBonus: number
}

/**
 * Starting values only. The right pool size and weights can only be found with
 * real activity data, which is why every one of these is config and the ledger
 * is append-only — a recompute is always possible.
 *
 * These are visible to anyone reading this public repository. That is fine:
 * every rule here is enforced server-side with atomic writes and a unique
 * `{userId, kind, refId}` ledger index, not by being secret.
 */
export const TOKEN_RULES: TokenRules = {
  award: {
    message: 2,
    // Weighted above messages on purpose: teaching is the behaviour worth paying for.
    correction: 10,
    mutualConversation: 15,
  },
  caps: {
    messagesPerDay: 100,
    messagesPerPartnerPerDay: 30,
  },
  streakMilestones: {
    7: 50,
    30: 250,
    100: 1000,
    365: 5000,
  },
  pool: {
    total: 10_000,
    maxShareOfPool: 0.05,
    accountAgeRampUpHours: 24,
    weights: {
      mutualConversations: 5,
      corrections: 3,
      messages: 1,
      distinctPartners: 4,
    },
    messageCountCap: 50,
  },
  sinks: {
    streakFreeze: 200,
    maxBankedStreakFreezes: 2,
  },
  legacyTokenDivisor: 100,
  welcomeBackBonus: 250,
  signupBonus: 250,
}

export interface ActivityCounters {
  mutualConversations: number
  corrections: number
  messages: number
  distinctPartners: number
}

/** Pure, so the cron and its test compute the identical number. */
export function activityScore(counters: ActivityCounters, rules: TokenRules = TOKEN_RULES): number {
  const { weights, messageCountCap } = rules.pool
  return (
    weights.mutualConversations * counters.mutualConversations +
    weights.corrections * counters.corrections +
    weights.messages * Math.min(counters.messages, messageCountCap) +
    weights.distinctPartners * counters.distinctPartners
  )
}

/**
 * Share of the daily pool for one user, floored to a whole number and clamped
 * to `maxShareOfPool`. Returns 0 when nobody was active, so a quiet day
 * distributes nothing rather than dividing by zero.
 */
export function poolShare(
  score: number,
  totalScore: number,
  rules: TokenRules = TOKEN_RULES,
): number {
  if (totalScore <= 0 || score <= 0) return 0
  const { total, maxShareOfPool } = rules.pool
  return Math.floor(Math.min(total * (score / totalScore), total * maxShareOfPool))
}

/**
 * How long a user must wait before changing their timezone again.
 *
 * The streak runs on the user's local day, so an unrestricted timezone field
 * is a streak-repair button: set the clock back a day, act, and a broken
 * streak looks continuous. Seven days is long enough that real travel is
 * unaffected in practice and short enough that a genuine relocation isn't
 * stuck for a month.
 */
export const TIMEZONE_UPDATE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function streakMilestoneBonus(day: number, rules: TokenRules = TOKEN_RULES): number {
  return rules.streakMilestones[day] ?? 0
}

/** `GET /me/tokens` — the user's own totals, streak and today's live counters. */
export const tokenSummarySchema = z.object({
  streak: z.object({
    current: z.number().int(),
    longest: z.number().int(),
    lastQualifiedDay: z.string().nullable(),
    /** True when today has already been credited — drives the "send 1 message" nudge. */
    qualifiedToday: z.boolean(),
  }),
  tokens: z.object({
    all: z.number().int(),
    year: z.number().int(),
    month: z.number().int(),
    week: z.number().int(),
  }),
  wallet: walletSchema,
  today: z.object({
    /** UTC day, matching the ledger buckets and the pool cron — not the local streak day. */
    day: z.string(),
    messages: z.number().int(),
    corrections: z.number().int(),
    mutualConversations: z.number().int(),
    distinctPartners: z.number().int(),
    /** Provisional; the real share is only known when the pool closes the day. */
    activityScore: z.number(),
  }),
})
export type TokenSummary = z.infer<typeof tokenSummarySchema>

/**
 * token credited for a v1 token balance. Floors, so anything under the divisor
 * converts to nothing and — since `awardTokens` writes no row for a zero amount —
 * leaves no ledger entry at all rather than a meaningless one.
 */
export function convertLegacyTokens(balance: number, rules: TokenRules = TOKEN_RULES): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0
  return Math.floor(balance / rules.legacyTokenDivisor)
}
