import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/** Which scheduled pass a row belongs to; first component of the `_id`. */
export type NotificationJob = 'unreadDigest' | 'profileVisitsPush' | 'profileVisitsEmail'

export interface NotificationLedgerEntry {
  _id: string
  sentOn: Date
}

function ledgerId(job: NotificationJob, userId: string, periodKey: string): string {
  return `${job}:${userId}:${periodKey}`
}

/**
 * Claims the right to notify one person once, for one job, in one period.
 *
 * The insert failing on a duplicate `_id` *is* the check — the same trick the
 * streak reminder uses, and for the same reason: a read followed by a write
 * has a gap, and two ticks landing in that gap is somebody being told the same
 * thing twice. Which, for a notification, is how a permission gets revoked.
 *
 * Claimed *before* the send, deliberately. A send that then fails is one
 * notification nobody got; a send that succeeds after a claim that failed to
 * record is one they get again every half hour until the hour passes.
 */
export async function claimOnce(
  db: Db,
  job: NotificationJob,
  userId: string,
  periodKey: string,
): Promise<boolean> {
  try {
    await db
      .collection<NotificationLedgerEntry>(COLLECTIONS.notificationLedger)
      .insertOne({ _id: ledgerId(job, userId, periodKey), sentOn: new Date() })
    return true
  } catch (error) {
    // 11000 is a duplicate key: somebody else got there, which is the answer.
    // Anything else is a database problem and must not read as "already done".
    if ((error as { code?: number }).code === 11000) return false
    throw error
  }
}

/**
 * The cheap look before the expensive work.
 *
 * `claimOnce` alone is correct, but a pass that claims first would have to do
 * every count and lookup for people it is going to skip. This is a hint, not a
 * lock: the claim is still what decides.
 */
export async function alreadyClaimed(
  db: Db,
  job: NotificationJob,
  userId: string,
  periodKey: string,
): Promise<boolean> {
  const existing = await db
    .collection<NotificationLedgerEntry>(COLLECTIONS.notificationLedger)
    .findOne({ _id: ledgerId(job, userId, periodKey) }, { projection: { _id: 1 } })
  return existing !== null
}
