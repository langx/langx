import { PLAN_LIMITS, QUOTA_WINDOW_MS, type PlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

export interface QuotaStatus {
  limit: number | null
  remaining: number | null
  nextAvailableAt: Date | null
}

function windowStartAt(now: Date): Date {
  return new Date(now.getTime() - QUOTA_WINDOW_MS)
}

function validInitiations(initiations: Date[], windowStart: Date): Date[] {
  return initiations.filter((d) => new Date(d) >= windowStart)
}

export async function getInitiationQuotaStatus(
  db: Db,
  userId: string,
  tier: PlanTier,
): Promise<QuotaStatus> {
  const limit = PLAN_LIMITS[tier].initiationsPer24h
  if (limit === null) return { limit: null, remaining: null, nextAvailableAt: null }

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  const valid = validInitiations(profile?.quota.initiations ?? [], windowStartAt(new Date()))
  const remaining = Math.max(0, limit - valid.length)
  const nextAvailableAt =
    remaining === 0 && valid.length > 0
      ? new Date(Math.min(...valid.map((d) => new Date(d).getTime())) + QUOTA_WINDOW_MS)
      : null

  return { limit, remaining, nextAvailableAt }
}

export type ConsumeResult = { consumed: true } | { consumed: false; nextAvailableAt: Date | null }

/**
 * Atomic, race-safe decrement for the rolling-24h initiation quota.
 *
 * The naive approach — read the count, check it client-side, then push a
 * timestamp — overruns the quota under concurrent requests (the plan calls
 * this out explicitly: "sayıp sonra yazmak eşzamanlı isteklerde kotayı
 * aşırır"). This does both in one `findOneAndUpdate`: the query's `$expr`
 * recomputes the in-window count from the document MongoDB is about to write
 * to, and only a request that still sees room gets its update applied.
 * MongoDB serializes writes to a single document, so concurrent callers for
 * the same user can't both observe "room for one more" and both win — one
 * `findOneAndUpdate` succeeds per available slot, the rest see `null`.
 *
 * The same pipeline stage also prunes anything outside the window, so the
 * array never grows past `limit` entries.
 */
export async function consumeInitiationQuota(
  db: Db,
  userId: string,
  tier: PlanTier,
): Promise<ConsumeResult> {
  const limit = PLAN_LIMITS[tier].initiationsPer24h
  if (limit === null) return { consumed: true } // Pro — unlimited, quota untouched

  const now = new Date()
  const windowStart = windowStartAt(now)

  const result = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lt: [
          {
            $size: {
              $filter: { input: '$quota.initiations', cond: { $gte: ['$$this', windowStart] } },
            },
          },
          limit,
        ],
      },
    },
    [
      {
        $set: {
          'quota.initiations': {
            $concatArrays: [
              { $filter: { input: '$quota.initiations', cond: { $gte: ['$$this', windowStart] } } },
              [now],
            ],
          },
        },
      },
    ],
  )

  if (result) return { consumed: true }

  const status = await getInitiationQuotaStatus(db, userId, tier)
  return { consumed: false, nextAvailableAt: status.nextAvailableAt }
}
