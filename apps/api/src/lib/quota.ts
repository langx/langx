import { QUOTA_WINDOW_MS, quotaLimit, type PlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../db/collections'
import type { Profile } from '../modules/profiles/profiles'

/**
 * `corrections` is deliberately absent — `PLAN_LIMITS.correctionsPer24h` is
 * `null` on both tiers (see limits.ts's doc comment), so nothing ever needs
 * to track it, and `profiles.quota` spends no storage on a limit that does
 * not exist. `media` *is* tracked: attachments cost bytes we store and serve
 * forever, which text does not. `echoCaptures` is tracked for the same reason
 * as `translations`: capturing a card asks Google to translate a sentence the
 * thread had not translated, and that is billed per character.
 */
export type TrackedQuotaKind =
  | 'initiations'
  | 'translations'
  | 'media'
  | 'echoCaptures'
  /**
   * Starting pack cards. `echoNewCardsPerDay` is null on every tier, so this
   * costs one comparison and writes nothing — which is the point: the row
   * exists so that metering intake later is a number in `limits.ts` and not a
   * new code path under a feature that is already live.
   */
  | 'echoNewCards'
  /** A member's own card read by the server voice; one unit per card. */
  | 'echoVoices'
  /**
   * A chat message read by the server voice; one unit per reading, and only
   * when the sentence was not already in the cache. Metered for the same
   * reason as `echoVoices` — CPU seconds on a machine of ours, plus a
   * permanent object in the bucket — but on its own ceiling, so a talkative
   * afternoon cannot silence the Echo button.
   */
  | 'chatVoices'

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

export type ConsumeResult =
  /**
   * `spentAt` is the timestamp this call wrote, so it can be taken back off
   * again if the work it was paying for never happened. Absent on an
   * unlimited tier, where nothing was written.
   */
  { consumed: true; spentAt?: Date } | { consumed: false; nextAvailableAt: Date | null }

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
  /**
   * `$ifNull`, because `$filter` raises on a missing field rather than
   * treating it as empty — and every profile written before a quota kind was
   * added lacks its array. Without this the first request of a newly added
   * kind is a 500 for every account that predates it, which is the whole
   * user base. `recordRefusal` below already does the same thing for the same
   * reason; doing it here makes the helper safe for the next kind too, and
   * removes the backfill that would otherwise have to run before a deploy.
   */
  const inWindow = { $ifNull: [`$${field}`, []] }

  const result = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lt: [
          {
            $size: {
              $filter: { input: inWindow, cond: { $gte: ['$$this', windowStart] } },
            },
          },
          limit,
        ],
      },
    },
    [
      {
        $set: {
          [field]: {
            $concatArrays: [
              { $filter: { input: inWindow, cond: { $gte: ['$$this', windowStart] } } },
              [now],
            ],
          },
        },
      },
    ],
  )

  if (result) return { consumed: true, spentAt: now }

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

/**
 * Give back a unit that bought nothing.
 *
 * For the one case that is neither a refusal nor anybody's fault: the voice
 * service was busy, so the caller is being told to try again — and telling
 * somebody to try again while still charging them is the actual unfairness.
 *
 * Pulls the exact timestamp `consumeQuota` wrote rather than the newest one,
 * so a second spend landing in the same window is left alone.
 */
export async function refundQuota(
  db: Db,
  userId: string,
  kind: TrackedQuotaKind,
  spentAt: Date | undefined,
): Promise<void> {
  if (!spentAt) return
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $pull: { [`quota.${kind}`]: spentAt } })
}
