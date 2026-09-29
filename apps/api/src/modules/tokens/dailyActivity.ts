import {
  TOKEN_RULES,
  activityScore,
  localDayKey,
  shiftDayKey,
  utcDayKey,
  type ActivityCounters,
} from '@langx/shared'
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
 * The *bucket* is UTC, not the user's local day, for the reason spelled out on
 * `TokenRules.caps` — a local-day bucket lets a timezone change re-open a cap
 * inside a single leaderboard period.
 *
 * The profile chart is not on that clock, and does not have to be: it awards
 * nothing. It picks its seven days from the user's own calendar, and reads
 * them out of `perLocalDay` — a second tally the same write keeps, split by
 * the local day the actor was living in. So a bar is a day they lived, inside
 * a document still bucketed by the day the pool closes on.
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
  /**
   * The two counters the chart draws, split again by the *actor's* local day.
   * At most two keys: one UTC day covers at most two local days in any zone.
   *
   * A second tally of the same events, not a second source of truth — the
   * top-level counters stay whole and are what the caps and the pool read.
   * Absent on documents written before this field existed; `readActivityWeek`
   * draws what it does not account for under the document's own UTC day.
   */
  perLocalDay?: Record<string, { messages: number; corrections: number }>
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
  input: {
    userId: string
    kind: ActivityKind
    partnerId?: string
    at?: Date
    /**
     * The *acting* user's zone, and only for `perLocalDay` — the document's
     * own bucket stays UTC. Defaults to UTC, which files the sub-key under
     * the same name as the bucket and so changes nothing.
     */
    timeZone?: string
  },
): Promise<DailyActivity> {
  const at = input.at ?? new Date()
  const day = utcDayKey(at)

  const inc: Record<string, number> = { messages: 0, corrections: 0, mutualConversations: 0 }
  inc[COUNTER_FIELD[input.kind]] = 1
  if (input.kind === 'message' && input.partnerId) {
    inc[`perPartner.${input.partnerId}`] = 1
  }
  /*
   * Only the two kinds the chart draws. `mutualConversations` is not one of
   * them, and the mutual write is also made for the *partner*, whose zone is
   * not in scope where it happens — asking for it would be a query per
   * message, to split a number nothing splits.
   *
   * Both sub-counters are always in the `$inc`, one of them by zero, for the
   * same reason the three above are: the sub-document is fully shaped from
   * its first write, so `readActivityWeek` can subtract without guarding
   * every field. `YYYY-MM-DD` is safe as a path component — it is not all
   * digits, so it cannot be read as an array index.
   */
  if (input.kind === 'message' || input.kind === 'correction') {
    const localDay = localDayKey(at, input.timeZone ?? 'UTC')
    inc[`perLocalDay.${localDay}.messages`] = 0
    inc[`perLocalDay.${localDay}.corrections`] = 0
    inc[`perLocalDay.${localDay}.${COUNTER_FIELD[input.kind]}`] = 1
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
 * The last `ACTIVITY_WEEK_DAYS` days the user themselves lived, oldest first.
 * `timeZone` defaults to UTC, which reproduces what this returned before any
 * of it was local.
 *
 * Both halves are theirs: which seven days, from `localDayKey`, and what is
 * in each one, from the `perLocalDay` tally the write keeps. So a bar holds
 * their midnight-to-midnight, not a UTC day wearing their label, and the
 * evening they are looking at the chart during is in the bar they expect.
 *
 * By `_id` rather than a `{ userId, day: { $gte } }` range: `_id` is
 * `<userId>:<day>` and already unique-indexed, so a handful of point lookups
 * need no new compound index for a query that runs once per profile view.
 * Missing days come back as zero rows — see the note on
 * `tokenSummarySchema.week`.
 *
 * One thing it deliberately does not line up with: `summary.today` is still
 * the UTC day, because that is the day the pool closes on. West of UTC the
 * two disagree in the evening. They are on different screens, and the pool's
 * number has always been the pool's.
 */
export async function readActivityWeek(
  db: Db,
  userId: string,
  at: Date = new Date(),
  timeZone = 'UTC',
): Promise<{ day: string; messages: number; corrections: number }[]> {
  const today = localDayKey(at, timeZone)
  const days = Array.from({ length: ACTIVITY_WEEK_DAYS }, (_, i) =>
    shiftDayKey(today, i - (ACTIVITY_WEEK_DAYS - 1)),
  )

  /*
   * Zone offsets run from -12 to +14, so a local day never spills past one
   * UTC day either side of its own key — whatever the zone. The documents
   * that can carry this window are therefore the seven plus one at each end,
   * and nine is nine for everybody, with nothing to branch on.
   */
  const utcDays = Array.from({ length: ACTIVITY_WEEK_DAYS + 2 }, (_, i) =>
    shiftDayKey(today, i - ACTIVITY_WEEK_DAYS),
  )

  const docs = await db
    .collection<DailyActivity>(COLLECTIONS.dailyActivity)
    .find({ _id: { $in: utcDays.map((day) => dailyActivityId(userId, day)) } })
    .toArray()

  const totals = new Map(days.map((day) => [day, { messages: 0, corrections: 0 }]))
  const add = (day: string, messages: number, corrections: number): void => {
    const row = totals.get(day)
    // Days outside the window: the two edge documents are fetched for the
    // part of them that reaches in, and the rest of them is not ours.
    if (!row) return
    row.messages += messages
    row.corrections += corrections
  }

  for (const doc of docs) {
    let split = { messages: 0, corrections: 0 }
    for (const [day, counts] of Object.entries(doc.perLocalDay ?? {})) {
      add(day, counts.messages, counts.corrections)
      split = {
        messages: split.messages + counts.messages,
        corrections: split.corrections + counts.corrections,
      }
    }
    /*
     * Whatever the split does not account for predates it, and keeps the
     * shape it was drawn with: the whole-day total under the document's own
     * UTC key. A remainder rather than an either/or, so a document written
     * across the deploy — part of its day counted one way, part the other —
     * is drawn once and entirely.
     *
     * It disarms itself. Every `$inc` of `messages` now carries one of
     * `perLocalDay.<day>.messages`, so for a document written wholly after
     * the deploy this is exactly zero, and eight days on it is zero for all
     * of them. Clamped because a negative would not draw a short bar, it
     * would eat a correct neighbouring one.
     */
    add(
      doc.day,
      Math.max(0, doc.messages - split.messages),
      Math.max(0, doc.corrections - split.corrections),
    )
  }

  return days.map((day) => ({
    day,
    messages: totals.get(day)?.messages ?? 0,
    corrections: totals.get(day)?.corrections ?? 0,
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
 * How many users have a positive activity score today — the "N active today"
 * on the token screen, and nothing more.
 *
 * It used to also sum every score, so the client could divide its own by the
 * total and draw a live "+N your share so far". That number is gone on
 * purpose: see the note on `tokenSummarySchema.pool`. A count is a fact about
 * today; a projected share was a promise about tonight that the payout does
 * not make.
 *
 * The score is computed inside the aggregation with the same weights
 * `activityScore` uses, so the two can only disagree if `TOKEN_RULES` changes
 * mid-request. One pipeline over the day's partition of `dailyActivity`, which
 * the `{day: 1}` index bounds to the day's active users.
 */
export async function countActiveToday(db: Db, at: Date = new Date()): Promise<number> {
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
    .aggregate<{ activeToday: number }>([
      { $match: { day: utcDayKey(at) } },
      { $project: { score } },
      { $match: { score: { $gt: 0 } } },
      { $group: { _id: null, activeToday: { $sum: 1 } } },
      { $project: { _id: 0, activeToday: 1 } },
    ])
    .toArray()

  return rows[0]?.activeToday ?? 0
}
