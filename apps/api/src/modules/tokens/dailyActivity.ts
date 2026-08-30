import { TOKEN_RULES, activityScore, utcDayKey, type ActivityCounters } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * One document per user per **UTC** day. Two readers depend on it:
 *
 * - the token caps in `awards.ts`, which need a counter that is incremented
 *   atomically and read back in the same round-trip;
 * - the daily-pool cron (Faz 9), which closes a UTC day and needs every
 *   active user's counters without scanning the ledger.
 *
 * UTC, not the user's local day, for the reason spelled out on
 * `TokenRules.caps` — a local-day bucket lets a timezone change re-open a cap
 * inside a single leaderboard period.
 */
export interface DailyActivity {
  /** `<userId>:<day>` */
  _id: string
  userId: string
  day: string
  messages: number
  corrections: number
  mutualConversations: number
  /** Distinct partners spoken to today; `distinctPartners` is its length. */
  partners: string[]
  /** Messages per partner, for the per-partner cap. Only text messages count. */
  perPartner: Record<string, number>
  updatedAt: Date
}

export type ActivityKind = 'message' | 'correction' | 'mutual'

const COUNTER_FIELD = {
  message: 'messages',
  correction: 'corrections',
  mutual: 'mutualConversations',
} as const satisfies Record<ActivityKind, keyof DailyActivity>

export function dailyActivityId(userId: string, day: string): string {
  return `${userId}:${day}`
}

export function countersOf(doc: DailyActivity | null): ActivityCounters {
  return {
    messages: doc?.messages ?? 0,
    corrections: doc?.corrections ?? 0,
    mutualConversations: doc?.mutualConversations ?? 0,
    /*
     * `partners` is guarded separately, and not out of caution. The three
     * counters above are always in the `$inc`, so an upserted document has
     * them from the first write — `partners` is not: it only appears under
     * `$addToSet`, which only runs when there is a partner. A day whose first
     * activity is a correction therefore creates a document with no `partners`
     * field at all, and `doc?.partners.length` threw on it. That was a 500 on
     * the whole token summary — the streak, the chart and the tile — for
     * exactly the person who had spent the day teaching.
     */
    distinctPartners: doc?.partners?.length ?? 0,
  }
}

export function scoreOf(doc: DailyActivity | null): number {
  return activityScore(countersOf(doc))
}

/**
 * Increment one counter and return the document as it now stands.
 *
 * All three counters are always in the `$inc` (two of them by zero) so an
 * upserted document is fully shaped from the first write — the pool cron can
 * then read `doc.messages` without every field being `number | undefined`.
 *
 * The post-image is the point: MongoDB serializes writes to a single document,
 * so each concurrent caller gets a distinct counter value back and the cap
 * check in `awards.ts` can be a plain comparison rather than a read-then-write
 * race (the same reasoning as `lib/quota.ts`).
 */
export async function recordActivity(
  db: Db,
  input: { userId: string; kind: ActivityKind; partnerId?: string; at?: Date },
): Promise<DailyActivity> {
  const at = input.at ?? new Date()
  const day = utcDayKey(at)

  const inc: Record<string, number> = { messages: 0, corrections: 0, mutualConversations: 0 }
  inc[COUNTER_FIELD[input.kind]] = 1
  if (input.kind === 'message' && input.partnerId) {
    inc[`perPartner.${input.partnerId}`] = 1
  }

  const result = await db.collection<DailyActivity>(COLLECTIONS.dailyActivity).findOneAndUpdate(
    { _id: dailyActivityId(input.userId, day) },
    {
      $inc: inc,
      ...(input.partnerId ? { $addToSet: { partners: input.partnerId } } : {}),
      $setOnInsert: { userId: input.userId, day },
      $set: { updatedAt: at },
    },
    { upsert: true, returnDocument: 'after' },
  )

  // `upsert` + `returnDocument: 'after'` always yields a document.
  if (!result) throw new Error('recordActivity: no document returned from upsert')
  return { ...result, partners: result.partners ?? [], perPartner: result.perPartner ?? {} }
}

/** Number of days the profile chart shows, and so the length of `summary.week`. */
export const ACTIVITY_WEEK_DAYS = 7

/**
 * The last `ACTIVITY_WEEK_DAYS` UTC days ending at `at`, oldest first.
 *
 * By `_id` rather than a `{ userId, day: { $gte } }` range: `_id` is
 * `<userId>:<day>` and already unique-indexed, so seven point lookups need no
 * new compound index for a query that runs once per profile view. Missing days
 * come back as zero rows — see the note on `tokenSummarySchema.week`.
 */
export async function readActivityWeek(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<{ day: string; messages: number; corrections: number }[]> {
  const days = Array.from({ length: ACTIVITY_WEEK_DAYS }, (_, i) => {
    const date = new Date(at)
    date.setUTCDate(date.getUTCDate() - (ACTIVITY_WEEK_DAYS - 1 - i))
    return utcDayKey(date)
  })

  const docs = await db
    .collection<DailyActivity>(COLLECTIONS.dailyActivity)
    .find({ _id: { $in: days.map((day) => dailyActivityId(userId, day)) } })
    .toArray()
  const byDay = new Map(docs.map((doc) => [doc.day, doc]))

  return days.map((day) => ({
    day,
    messages: byDay.get(day)?.messages ?? 0,
    corrections: byDay.get(day)?.corrections ?? 0,
  }))
}

export async function readActivity(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<DailyActivity | null> {
  const doc = await db
    .collection<DailyActivity>(COLLECTIONS.dailyActivity)
    .findOne({ _id: dailyActivityId(userId, utcDayKey(at)) })
  // Normalized the same way `recordActivity` normalizes its post-image, so a
  // reader cannot tell which of the two produced the document it holds. The
  // optional fields are optional in the *document*, not in the shape callers
  // were promised.
  return doc ? { ...doc, partners: doc.partners ?? [], perPartner: doc.perPartner ?? {} } : null
}

/**
 * Where today's pool stands right now: how many users have a positive
 * provisional score, and what those scores sum to. The client divides its own
 * score by the total with `poolShare()` to draw a live "+N your share so far".
 *
 * The score is computed inside the aggregation with the same weights
 * `activityScore` uses, so the two can only disagree if `TOKEN_RULES` changes
 * mid-request. One pipeline over the day's partition of `dailyActivity` —
 * bounded by the day's active users, the same set the pool cron walks.
 *
 * Deliberately *not* filtered by eligibility (account age, frozen): the
 * denominator the cron will use at day close differs at the margin, but
 * filtering here would mean a profile lookup per active user on every summary
 * read. The share is labelled provisional for exactly this reason.
 */
export async function readPoolSnapshot(
  db: Db,
  at: Date = new Date(),
): Promise<{ activeToday: number; totalScore: number }> {
  const { weights, messageCountCap } = TOKEN_RULES.pool
  const score = {
    $add: [
      { $multiply: [weights.mutualConversations, { $ifNull: ['$mutualConversations', 0] }] },
      { $multiply: [weights.corrections, { $ifNull: ['$corrections', 0] }] },
      { $multiply: [weights.messages, { $min: [{ $ifNull: ['$messages', 0] }, messageCountCap] }] },
      { $multiply: [weights.distinctPartners, { $size: { $ifNull: ['$partners', []] } }] },
    ],
  }

  const rows = await db
    .collection<DailyActivity>(COLLECTIONS.dailyActivity)
    .aggregate<{ activeToday: number; totalScore: number }>([
      { $match: { day: utcDayKey(at) } },
      { $project: { score } },
      { $match: { score: { $gt: 0 } } },
      { $group: { _id: null, activeToday: { $sum: 1 }, totalScore: { $sum: '$score' } } },
      { $project: { _id: 0, activeToday: 1, totalScore: 1 } },
    ])
    .toArray()

  return rows[0] ?? { activeToday: 0, totalScore: 0 }
}
