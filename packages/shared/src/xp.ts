import { z } from 'zod'

/**
 * XP is **not** a token. It cannot be traded, withdrawn or bought, and it can
 * never buy a Pro feature — otherwise farming XP becomes a substitute for the
 * subscription. The only sinks are a streak freeze and cosmetics.
 *
 * v1 shipped an on-chain-flavoured token (wallets, checkouts, a token
 * leaderboard). That system is retired in v2 and balances are not migrated.
 * The ledger below is still append-only, idempotent and period-bucketed —
 * that is correct engineering for any point economy (audit, dispute,
 * recompute), and it leaves the door open without committing to it.
 */

export const XP_KINDS = ['message', 'correction', 'streak', 'dailyPool', 'adjustment'] as const
export type XpKind = (typeof XP_KINDS)[number]
export const xpKindSchema = z.enum(XP_KINDS)

export interface XpRules {
  /** Direct, immediate awards — the feedback loop. */
  award: {
    message: number
    correction: number
    /** Granted once per conversation, the first time both sides have spoken. */
    mutualConversation: number
  }
  caps: {
    /** Max message-XP a user can earn per local day. */
    messagesPerDay: number
    /** Max message-XP per partner per local day — blocks single-partner farming. */
    messagesPerPartnerPerDay: number
  }
  /** Bonus XP at streak milestones, keyed by day count. */
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
    profileFrame: number
    title: number
  }
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
export const XP_RULES: XpRules = {
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
    profileFrame: 500,
    title: 1000,
  },
}

export interface ActivityCounters {
  mutualConversations: number
  corrections: number
  messages: number
  distinctPartners: number
}

/** Pure, so the cron and its test compute the identical number. */
export function activityScore(counters: ActivityCounters, rules: XpRules = XP_RULES): number {
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
export function poolShare(score: number, totalScore: number, rules: XpRules = XP_RULES): number {
  if (totalScore <= 0 || score <= 0) return 0
  const { total, maxShareOfPool } = rules.pool
  return Math.floor(Math.min(total * (score / totalScore), total * maxShareOfPool))
}

export function streakMilestoneBonus(day: number, rules: XpRules = XP_RULES): number {
  return rules.streakMilestones[day] ?? 0
}
