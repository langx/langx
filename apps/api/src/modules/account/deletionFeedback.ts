import { ACCOUNT_DELETION_REASONS, type AccountDeletionReason, type PlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

/**
 * The answer to "why are you leaving?", while the account still exists.
 *
 * Held on the profile through the grace period rather than written straight
 * into `accountDeletionFeedback`, for two reasons. Somebody who signs back in
 * has not left, and a reason from a person who changed their mind would be
 * counted as a departure that never happened — `cancelDeletion` removes this
 * with `deletedAt`. And an anonymous row written the moment deletion is asked
 * for could be matched back to the profile by its date for the next thirty
 * days; written by the purge, it appears in the same breath as the profile
 * disappears, and there is nothing left to match it against.
 *
 * `tier` is the one fact taken at request time: a subscription can lapse
 * during the grace period, and "a paying member left" is the thing worth
 * knowing, not what the plan had decayed to a month later.
 */
export interface PendingDeletionFeedback {
  reason?: AccountDeletionReason
  note?: string
  tier: PlanTier
}

/**
 * One departure, with nothing that says whose.
 *
 * No user id, handle, email, country or language — the account this came from
 * has just been deleted, and deleting it is the promise. What is kept is what
 * counting needs: the reason, the note if one was written, the plan, a coarse
 * age, and the **day** it was written. A day rather than an instant, because
 * the purge writes other rows in the same tick (`analyticsDeletions` is keyed
 * by the user id until it drains) and a shared millisecond is a join.
 */
export interface AccountDeletionFeedback {
  reason: AccountDeletionReason
  note?: string
  tier: PlanTier
  /** Whole 30-day months between joining and asking to leave. Coarse on purpose. */
  accountAgeMonths: number
  createdAt: Date
}

/** What the request carried, reduced to `undefined` when it carried nothing. */
export function feedbackFrom(input: {
  reason?: AccountDeletionReason | undefined
  note?: string | undefined
}): { reason?: AccountDeletionReason; note?: string } | undefined {
  if (input.reason === undefined && input.note === undefined) return undefined
  return {
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Writes the anonymous row for a profile the purge is about to delete, if its
 * owner answered the question.
 *
 * **Never throws.** This is somebody's opinion of the app, and the purge it
 * rides in is somebody's deletion; losing the first is a shame, stranding the
 * second is a broken promise. The log says what failed and not for whom.
 *
 * A note with no reason picked is counted as `other`: whoever wrote it said
 * why in their own words, which is what `other` means.
 */
export async function recordDeletionFeedback(
  db: Db,
  profile: Pick<Profile, 'createdAt' | 'deletedAt' | 'deletionFeedback'>,
  now: Date,
): Promise<void> {
  const pending = profile.deletionFeedback
  if (!pending) return
  const askedAt = profile.deletedAt ?? now
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  try {
    await db.collection<AccountDeletionFeedback>(COLLECTIONS.accountDeletionFeedback).insertOne({
      reason: pending.reason ?? 'other',
      ...(pending.note !== undefined ? { note: pending.note } : {}),
      tier: pending.tier,
      accountAgeMonths: Math.max(
        0,
        Math.floor((askedAt.getTime() - profile.createdAt.getTime()) / (30 * MS_PER_DAY)),
      ),
      createdAt: day,
    })
  } catch (error) {
    console.error('[deletion-feedback] could not be stored', { error })
  }
}

export interface DeletionReasonCount {
  reason: AccountDeletionReason
  last30: number
  last90: number
}

/**
 * How many purged accounts gave each reason, over the last 30 and 90 days.
 *
 * Every reason is in the answer, zeroes included, in the order the screen asks
 * them — a reason nobody picked is a finding too, and a list that dropped it
 * would read as if it had never been offered.
 */
export async function countDeletionReasons(
  db: Db,
  now: Date = new Date(),
): Promise<DeletionReasonCount[]> {
  const since90 = new Date(now.getTime() - 90 * MS_PER_DAY)
  const since30 = new Date(now.getTime() - 30 * MS_PER_DAY)
  const rows = await db
    .collection<AccountDeletionFeedback>(COLLECTIONS.accountDeletionFeedback)
    .aggregate<{ _id: AccountDeletionReason; last30: number; last90: number }>([
      { $match: { createdAt: { $gte: since90 } } },
      {
        $group: {
          _id: '$reason',
          last90: { $sum: 1 },
          last30: { $sum: { $cond: [{ $gte: ['$createdAt', since30] }, 1, 0] } },
        },
      },
    ])
    .toArray()
  const byReason = new Map(rows.map((row) => [row._id, row]))
  return ACCOUNT_DELETION_REASONS.map((reason) => ({
    reason,
    last30: byReason.get(reason)?.last30 ?? 0,
    last90: byReason.get(reason)?.last90 ?? 0,
  }))
}
