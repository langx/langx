import { QUOTA_WINDOW_MS, quotaLimit, type PlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../db/collections'
import type { Profile } from '../modules/profiles/profiles'

/**
 * `corrections` is deliberately absent — `PLAN_LIMITS.correctionsPer24h` is
 * `null` on both tiers (see limits.ts's doc comment), so nothing ever needs
 * to track it, and `profiles.quota` spends no storage on a limit that does
 * not exist. `media` *is* tracked: attachments cost bytes we store and serve
 * forever, which text does not.
 */
export type TrackedQuotaKind = 'initiations' | 'translations' | 'media'

export interface QuotaStatus {
  limit: number | null
  remaining: number | null
  nextAvailableAt: Date | null
}

function windowStartAt(now: Date): Date {
  return new Date(now.getTime() - QUOTA_WINDOW_MS)
}

function validTimestamps(timestamps: Date[], windowStart: Date): Date[] {
  return timestamps.filter((d) => new Date(d) >= windowStart)
}

export async function getQuotaStatus(
  db: Db,
  userId: string,
  tier: PlanTier,
  kind: TrackedQuotaKind,
): Promise<QuotaStatus> {
  const limit = quotaLimit(tier, kind)
  if (limit === null) return { limit: null, remaining: null, nextAvailableAt: null }

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  const valid = validTimestamps(profile?.quota[kind] ?? [], windowStartAt(new Date()))
  const remaining = Math.max(0, limit - valid.length)
  const nextAvailableAt =
    remaining === 0 && valid.length > 0
      ? new Date(Math.min(...valid.map((d) => new Date(d).getTime())) + QUOTA_WINDOW_MS)
      : null

  return { limit, remaining, nextAvailableAt }
}

export type ConsumeResult = { consumed: true } | { consumed: false; nextAvailableAt: Date | null }

/**
 * Atomic, race-safe decrement for a rolling-24h quota bucket (`initiations`
 * or `translations` — see `TrackedQuotaKind`).
 *
 * The naive approach — read the count, check it client-side, then push a
 * timestamp — overruns the quota under concurrent requests (the plan calls
 * this out explicitly: "count-then-write overruns the quota under concurrent
 * requests"). This does both in one `findOneAndUpdate`: the query's `$expr`
 * recomputes the in-window count from the document MongoDB is about to write
 * to, and only a request that still sees room gets its update applied.
 * MongoDB serializes writes to a single document, so concurrent callers for
 * the same user can't both observe "room for one more" and both win — one
 * `findOneAndUpdate` succeeds per available slot, the rest see `null`.
 *
 * The same pipeline stage also prunes anything outside the window, so the
 * array never grows past `limit` entries.
 */
export async function consumeQuota(
  db: Db,
  userId: string,
  tier: PlanTier,
  kind: TrackedQuotaKind,
): Promise<ConsumeResult> {
  const limit = quotaLimit(tier, kind)
  if (limit === null) return { consumed: true } // Pro — unlimited, quota untouched

  const now = new Date()
  const windowStart = windowStartAt(now)
  const field = `quota.${kind}`

  const result = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lt: [
          { $size: { $filter: { input: `$${field}`, cond: { $gte: ['$$this', windowStart] } } } },
          limit,
        ],
      },
    },
    [
      {
        $set: {
          [field]: {
            $concatArrays: [
              { $filter: { input: `$${field}`, cond: { $gte: ['$$this', windowStart] } } },
              [now],
            ],
          },
        },
      },
    ],
  )

  if (result) return { consumed: true }

  await recordRefusal(db, userId, now)
  const status = await getQuotaStatus(db, userId, tier, kind)
  return { consumed: false, nextAvailableAt: status.nextAvailableAt }
}

/**
 * How long a refusal is remembered. Three days: long enough that hitting the
 * limit on two evenings running still reads as a pattern, short enough that
 * a bad week in March is not an argument about a plan in June.
 */
export const QUOTA_REFUSAL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Remembers that somebody was refused, so a nudge can tell "hit the limit
 * once" from "keeps hitting it".
 *
 * Here rather than at the three call sites, because here is the only place
 * a refusal is decided — and the fourth caller, whenever it arrives, gets
 * this for free rather than being the one that forgot.
 *
 * The same prune-and-append pipeline the quota itself uses, so the array
 * cannot grow: everything outside the window is dropped on each write.
 * Failure is swallowed — this is a counter for a marketing nudge, and
 * nothing about it is worth turning a 429 into a 500.
 */
async function recordRefusal(db: Db, userId: string, now: Date): Promise<void> {
  const since = new Date(now.getTime() - QUOTA_REFUSAL_WINDOW_MS)
  try {
    await db.collection<Profile>(COLLECTIONS.profiles).updateOne({ _id: userId }, [
      {
        $set: {
          quotaRefusals: {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ['$quotaRefusals', []] },
                  cond: { $gte: ['$$this', since] },
                },
              },
              [now],
            ],
          },
        },
      },
    ])
  } catch {
    // A counter nobody is waiting on.
  }
}
