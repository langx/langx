import { z } from 'zod'
import { walletSchema } from './cosmetics'
import { shiftDayKey, utcDayKey } from './periods'

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
  /** Daily pool, paid out after the day closes in proportion to activity. */
  pool: {
    total: number
    /** Ceiling on one user's share, as a fraction of the pool. */
    maxShareOfPool: number
    /** Accounts younger than this earn no pool share. */
    accountAgeRampUpHours: number
    /**
     * Hour of the **UTC** day at which the previous day is paid out.
     *
     * The day itself still closes at 00:00 UTC — this only says when the
     * payout runs, and the gap is deliberate. A share is a number about
     * everyone, so it cannot be computed until every writer has finished with
     * the day, and midnight UTC is exactly when the day's last messages, a
     * redeploy and the cap counters are all still settling. Four hours later
     * nothing is still moving, and the deposit lands at one predictable time
     * rather than whenever the process happened to tick past midnight.
     */
    payoutHourUtc: number
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
    /**
     * Price per day to bring a v1 streak back to life, and the ceiling on it.
     *
     * `legacyRestore.ts` has always said "`frozenStreak` is what they can buy
     * back" and there was no way to buy it — the number only reached
     * `streak.longest`, where it sat as a souvenir. Priced by length because a
     * long streak is worth more to its owner, and capped because v1's longest
     * was 446 days and a linear price there would be unreachable.
     *
     * At 20 a day the welcome-back bonus alone buys back about twelve days,
     * which is what a returning user's streak usually was.
     */
    streakRestorePerDay: number
    streakRestoreMax: number
    /**
     * Price to fill in one missed day on the activity map.
     *
     * Dearer than a freeze, which is the point of the pair: a freeze is bought
     * ahead of a day you might miss and costs you the foresight; a repair is
     * bought after one you did miss and costs nothing but tokens. Pricing the
     * retrospective one lower would make the freeze pointless.
     */
    dayRepair: number
    /** How far back a day can still be repaired. */
    dayRepairMaxAgeDays: number
    /**
     * Repairs allowed per calendar month.
     *
     * The cap, not the price, is what stops a balance buying a streak
     * outright: at two a month even a rich account cannot manufacture a run it
     * did not live, and the streak keeps meaning what it says.
     */
    dayRepairPerMonth: number
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
  /*
   * Every payout here must be **distinct**. `streakMilestoneDates` dates a
   * badge by mapping a ledger row's amount back to the milestone that paid it,
   * because the row records the day and the amount but not which milestone it
   * was for. Two milestones sharing an amount would silently attribute both to
   * the earlier row. `badges.test.ts` holds the rule.
   */
  streakMilestones: {
    7: 50,
    30: 250,
    100: 1000,
    180: 1500,
    365: 5000,
    730: 12_000,
    1095: 25_000,
  },
  pool: {
    total: 10_000,
    maxShareOfPool: 0.05,
    accountAgeRampUpHours: 24,
    payoutHourUtc: 4,
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
    streakRestorePerDay: 20,
    streakRestoreMax: 2000,
    dayRepair: 300,
    dayRepairMaxAgeDays: 14,
    dayRepairPerMonth: 2,
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
 * The most recent day whose payout window has opened, as a day key.
 *
 * A day closes at 00:00 UTC but is not paid until `pool.payoutHourUtc` that
 * morning, so between midnight and the payout hour the newest payable day is
 * the one before yesterday. Pure, so the scheduler and its test agree on the
 * boundary rather than each computing it.
 */
export function newestPayableDay(now: Date, rules: TokenRules = TOKEN_RULES): string {
  const today = utcDayKey(now)
  return shiftDayKey(today, now.getUTCHours() >= rules.pool.payoutHourUtc ? -1 : -2)
}

/**
 * The UTC day a ledger row belongs to *for the reader*.
 *
 * Every other kind is filed on the day it was written, but a pool share is
 * written at the instant its day closes — `dayCloseAt(D)` is `D+1T00:00Z`, so
 * `entry.day` for a pool award is already the day *after* the one it rewards.
 * The history has to show it against the day that earned it, which `refId`
 * holds. Shared because the aggregation and its test must agree.
 */
export function earnedDayOf(entry: { kind: TokenKind; day: string; refId?: string }): string {
  return entry.kind === 'dailyPool' && entry.refId ? entry.refId : entry.day
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
  /**
   * The pool as the app is allowed to state it: how busy today is, and what the
   * last closed day actually paid this user.
   *
   * There is deliberately **no** projected share for today. The obvious card
   * draws one — score over everyone's score, live — but that number is a
   * promise the cron will not keep: it moves all day as other people act, it
   * ignores the eligibility the payout applies at day close, and an account
   * inside `accountAgeRampUpHours` would watch a share climb all day and be
   * paid nothing. `lastPayout` is a number that already happened.
   */
  pool: z.object({
    /** Users with a positive activity score so far today. */
    activeToday: z.number().int(),
    /**
     * The most recent pool share credited to this user, and the day it was
     * earned for — not the day it was paid. Null until the first payout lands,
     * which for a new account is the morning after their first active day.
     */
    lastPayout: z.object({ day: z.string(), amount: z.number().int() }).nullable(),
  }),
  /**
   * All-time counts that are not token totals.
   *
   * Corrections are counted from the ledger rather than kept on the profile:
   * the same reasoning as the note on `getTokenSummary` — a denormalized copy
   * of a number written from several code paths is a drift generator, and the
   * `{userId, kind}` index prefix already makes the count a single scan.
   */
  lifetime: z.object({ corrections: z.number().int() }),
  /**
   * The seven UTC days ending today, oldest first, for the profile chart.
   *
   * Always exactly seven entries: a day with no activity is a zero row rather
   * than a gap, so the client can index by position instead of matching dates,
   * and a quiet Tuesday draws as a short bar rather than shifting the week.
   */
  week: z
    .array(
      z.object({
        day: z.string(),
        messages: z.number().int(),
        corrections: z.number().int(),
      }),
    )
    .length(7),
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

/**
 * What it costs to bring a frozen v1 streak back. `0` means there is nothing
 * to buy — no streak, or one already restored.
 */
export function streakRestorePrice(frozenStreak: number, rules = TOKEN_RULES): number {
  if (!Number.isFinite(frozenStreak) || frozenStreak <= 0) return 0
  return Math.min(
    rules.sinks.streakRestoreMax,
    Math.ceil(frozenStreak) * rules.sinks.streakRestorePerDay,
  )
}

/** `GET /me/activity` — an inclusive local-day range. */
/** How many days of history one page of `GET /me/tokens/history` returns. */
export const TOKEN_HISTORY_PAGE_DAYS = 30

export const tokenHistoryDaySchema = z.object({
  /**
   * The UTC day this row is filed under — the day the token was *earned for*,
   * which for a pool share is the day it rewards rather than the morning it
   * was credited. See `earnedDayOf`.
   */
  day: z.string(),
  /** Sum of everything credited that day. */
  earned: z.number().int(),
  /** Sum of everything spent that day, as a positive number. */
  spent: z.number().int(),
  /**
   * Per-kind totals, signed the way the ledger stores them, so `spend` is
   * negative. Only kinds that moved appear — a day with no corrections has no
   * `correction` entry rather than a zero one, so the client can render the
   * list without filtering.
   */
  breakdown: z.array(z.object({ kind: tokenKindSchema, amount: z.number().int() })),
})
export type TokenHistoryDay = z.infer<typeof tokenHistoryDaySchema>

export const tokenHistorySchema = z.object({
  /** Newest day first. */
  days: z.array(tokenHistoryDaySchema),
  /**
   * Pass as `before` to get the next page, or null at the end. A day key
   * rather than an offset: the ledger is append-only and pages are read
   * newest-first, so a cursor cannot be shifted by a write landing mid-scroll.
   */
  nextCursor: z.string().nullable(),
})
export type TokenHistory = z.infer<typeof tokenHistorySchema>

export const tokenHistoryQuerySchema = z.object({
  /** Exclusive upper bound, as a day key. */
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

/**
 * The furthest back `GET /me/activity` will look.
 *
 * The range is caller-supplied and was never bounded, while the client carried
 * a comment saying the server clamped it. A little over the half-year the map
 * draws, so the map keeps working and a request for a decade does not.
 */
export const ACTIVITY_MAX_RANGE_DAYS = 400

export const activityRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * `POST /me/activity/repair`.
 *
 * The day is in the body rather than the path, matching `/me/wallet/purchase`:
 * path params are not zod-validated anywhere in this API, and a spend is not
 * the place to start trusting one.
 */
export const repairDaySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * The streak that a set of filled days implies, counting back from today.
 *
 * In shared because both sides need the same answer for different reasons: the
 * server writes it after a repair, and the client has to *predict* it before
 * one, to say what the purchase will do. Two implementations of this would be
 * two different promises.
 *
 * Yesterday is where an unfinished today starts from — a user who has not sent
 * anything yet today still has the run that ended yesterday.
 */
export function streakFromDays(days: Set<string>, today: string): number {
  let cursor = streakHeadDay(days, today)
  if (cursor === null) return 0
  let length = 0
  while (days.has(cursor)) {
    length++
    cursor = shiftDayKey(cursor, -1)
  }
  return length
}

/**
 * The newest day of the run `streakFromDays` counts, or `null` when there is no
 * run at all.
 *
 * This is what `streak.lastQualifiedDay` has to become after a repair, and it
 * shares the "yesterday is where an unfinished today starts from" rule above by
 * construction rather than by being written out twice. Getting the two out of
 * step is not a cosmetic bug: `recordQualifyingAction` reads
 * `lastQualifiedDay` to decide both whether the streak continues and whether a
 * banked freeze is owed, so a stale value silently undoes a purchase.
 */
export function streakHeadDay(days: Set<string>, today: string): string | null {
  const head = days.has(today) ? today : shiftDayKey(today, -1)
  return days.has(head) ? head : null
}
