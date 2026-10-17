import { z } from 'zod'

/**
 * The measurement screen: cohorts, first messages and refusals, read from what
 * the server already keeps — and a person's money timeline beside them.
 *
 * Private, for the reason `docs/decisions.md` → _The analytics dashboard is
 * private_ gives: retention and activation are exactly the numbers that must
 * not sit next to a paywall in public. Nothing here may be re-exported to
 * `insight` or the public stats page. The definitions the numbers are computed
 * with live in `measurement.ts`.
 */

/** Weeks of sign-ups the screen reads. Twelve, so a Day-30 reading has mature cohorts. */
export const ADMIN_MEASURE_WEEKS_DEFAULT = 12
/** The most weeks one request may ask for — each is more profiles and more conversations scanned. */
export const ADMIN_MEASURE_WEEKS_MAX = 26

/** The most lines the money timeline reads from each source. Far more than one person has. */
export const ADMIN_MONEY_TIMELINE_ROWS = 100

export const adminMeasureQuerySchema = z.object({
  weeks: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_MEASURE_WEEKS_MAX)
    .default(ADMIN_MEASURE_WEEKS_DEFAULT),
})
export type AdminMeasureQuery = z.infer<typeof adminMeasureQuerySchema>

/**
 * "Of the people who could have met it by now, how many did."
 *
 * Both halves are sent, never the ratio alone: a cohort of four people at 50%
 * and a cohort of four hundred at 50% are different readings, and the panel
 * prints the denominator beside every rate.
 */
export interface AdminRate {
  /** Met the condition. */
  count: number
  /** Could have met it by now — the denominator. */
  of: number
}

export interface AdminCohortRow {
  /** UTC Monday of the sign-up week, `YYYY-MM-DD`. */
  weekStart: string
  signedUp: number
  /** `COHORT_RETURN_DAYS`, in that order. */
  returned: { d1: AdminRate; d7: AdminRate; d30: AdminRate }
  activated: AdminRate
}

export interface AdminFirstMessageWeek {
  weekStart: string
  /** Conversations opened that week between two people. */
  started: number
  /** Of those, the ones old enough to judge — opened more than the threshold ago. */
  settled: number
  /** Settled, and no reply inside the threshold (a late reply still counts here). */
  unanswered: number
  /** Settled, and never answered at all so far. */
  neverAnswered: number
  /** Median time to the first reply, over the conversations that got one. Minutes. */
  medianReplyMinutes: number | null
}

export interface AdminRefusalKind {
  /** A quota kind, or `unknown` for refusals recorded before the kind was kept. */
  kind: string
  refusals: number
  people: number
}

export interface AdminMeasure {
  generatedAt: string
  /** UTC Monday of the first week read. */
  from: string
  weeks: number
  /** The definitions the numbers below were computed with. */
  rules: {
    activationConversations: number
    activationWindowHours: number
    unansweredAfterHours: number
    returnRecordedFrom: string
  }
  /** Newest week first. */
  cohorts: AdminCohortRow[]
  cohortTotals: Omit<AdminCohortRow, 'weekStart'>
  /** Newest week first. */
  firstMessages: AdminFirstMessageWeek[]
  firstMessageTotals: Omit<AdminFirstMessageWeek, 'weekStart'>
  refusals: {
    /** How far back `quotaRefusals` reaches — all it keeps. */
    windowDays: number
    kinds: AdminRefusalKind[]
  }
  /** A cap was hit, so the figures cover the earliest part of what was asked for. */
  truncated: boolean
}

/**
 * One line of a person's money timeline.
 *
 * Three sources and nothing else: gifts of Pro the server queued or granted,
 * the events RevenueCat sent its webhook, and the moment an account fell back
 * to free. What is **not** here is every view of the paywall and every tap on
 * it — those are PostHog's, not the server's, and the screen says so rather
 * than leaving the gap to look like nothing happened.
 */
export type AdminMoneyItem =
  | {
      kind: 'gift'
      at: string
      /** Whole days after joining; negative for something dated before the profile. */
      daysAfterJoin: number
      source: string
      months: number
      weeks: number
      status: string
      endsAt: string | null
    }
  | {
      kind: 'store'
      at: string
      daysAfterJoin: number
      /** RevenueCat's own event type, as recorded. */
      event: string
      store: string
      productId: string
      expiresAt: string | null
      /** Whole days between the event and the end of the period it opened, when both are known. */
      periodDays: number | null
      sandbox: boolean
    }
  | {
      kind: 'churn'
      at: string
      daysAfterJoin: number
      /** The tier that was lost. */
      tier: string
    }

export interface AdminMoneyTimeline {
  userId: string
  joinedAt: string
  /** The entitlement as it stands now. */
  now: {
    tier: string
    store: string | null
    expiresAt: string | null
    willRenew: boolean | null
    /**
     * `trial`, `intro` or `normal`, as the entitlement last recorded it. Null
     * for a gift, and for anything written before 10 September 2026.
     */
    periodType: string | null
    updatedAt: string | null
  }
  /** Newest first. */
  items: AdminMoneyItem[]
  /** More rows exist than were read. */
  truncated: boolean
}
