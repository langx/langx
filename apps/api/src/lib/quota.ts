import { QUOTA_WINDOW_MS, quotaLimit, type PlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../db/collections'
import type { Profile } from '../modules/profiles/profiles'

/**
 * `corrections` is deliberately absent — `PLAN_LIMITS.correctionsPer24h` is
 * `null` on both tiers (see limits.ts's doc comment), so nothing ever needs
 * to track it, and `profiles.quota` only has `initiations`/`translations`
 * fields to spend storage tracking a limit that doesn't exist.
 */
export type TrackedQuotaKind = 'initiations' | 'translations'

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

  const status = await getQuotaStatus(db, userId, tier, kind)
  return { consumed: false, nextAvailableAt: status.nextAvailableAt }
}
