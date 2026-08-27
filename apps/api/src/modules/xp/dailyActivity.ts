import { activityScore, utcDayKey, type ActivityCounters } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * One document per user per **UTC** day. Two readers depend on it:
 *
 * - the XP caps in `awards.ts`, which need a counter that is incremented
 *   atomically and read back in the same round-trip;
 * - the daily-pool cron (Faz 9), which closes a UTC day and needs every
 *   active user's counters without scanning the ledger.
 *
 * UTC, not the user's local day, for the reason spelled out on
 * `XpRules.caps` — a local-day bucket lets a timezone change re-open a cap
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
    distinctPartners: doc?.partners.length ?? 0,
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

export async function readActivity(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<DailyActivity | null> {
  return db
    .collection<DailyActivity>(COLLECTIONS.dailyActivity)
    .findOne({ _id: dailyActivityId(userId, utcDayKey(at)) })
}
