import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { PERSON_DELETE_BATCH, type PersonDeleter } from '../analytics/personDeleter'

/**
 * One deleted account, still owed a deletion at PostHog.
 *
 * `_id` is the distinct id, which is `profiles._id`, which is the Better Auth
 * user id as a string. Using it as the key rather than a field is what makes a
 * second enqueue of the same account impossible without an index to enforce
 * it — and it means `lib/authId.ts` never enters this file: the ObjectId form
 * would match nothing at PostHog and report success doing it.
 */
export interface AnalyticsDeletion {
  _id: string
  createdAt: Date
  attempts: number
  lastAttemptAt?: Date
  lastError?: string
}

/**
 * Records what the purge owes PostHog, in the same breath as deleting the
 * account.
 *
 * Unconditional — not gated on a key being configured. An instance with no
 * analytics accumulates rows it never sends, which costs a string and a date
 * per deleted account; the other way round, a key that is briefly missing at
 * purge time loses the obligation permanently, with the profile already gone
 * and nothing left to find it from. Only one of those two is recoverable.
 */
export function recordAnalyticsDeletion(db: Db, userId: string, now: Date): Promise<unknown> {
  return db
    .collection<AnalyticsDeletion>(COLLECTIONS.analyticsDeletions)
    .updateOne({ _id: userId }, { $setOnInsert: { createdAt: now, attempts: 0 } }, { upsert: true })
}

export interface DrainResult {
  /** Rows PostHog accepted and that are now gone from the queue. */
  deleted: number
  /** Rows tried and left behind, with the attempt counted. */
  failed: number
}

/**
 * Sends one batch of the queue to PostHog and clears what it accepted.
 *
 * One call per tick, not a loop: the queue is drained by an hourly scheduler
 * and a thousand accounts an hour is far past any rate this app can produce,
 * so there is nothing to gain from emptying it faster and something to lose
 * from a tight retry loop against a key that has just been revoked.
 *
 * A failure leaves every row in place with `attempts` incremented. That is the
 * whole point of the collection: the account is already gone, so the only
 * record that the deletion is still owed is this one, and it has to survive
 * being unable to do the work.
 */
export async function drainAnalyticsDeletions(
  db: Db,
  deleter: PersonDeleter,
  options: { now?: Date; limit?: number } = {},
): Promise<DrainResult> {
  const now = options.now ?? new Date()
  const collection = db.collection<AnalyticsDeletion>(COLLECTIONS.analyticsDeletions)
  const pending = await collection
    .find({}, { projection: { _id: 1 } })
    .sort({ createdAt: 1 })
    .limit(Math.min(options.limit ?? PERSON_DELETE_BATCH, PERSON_DELETE_BATCH))
    .toArray()
  if (pending.length === 0) return { deleted: 0, failed: 0 }

  const ids = pending.map((row) => row._id)
  try {
    await deleter.deletePersons(ids)
  } catch (error) {
    await collection.updateMany(
      { _id: { $in: ids } },
      {
        $inc: { attempts: 1 },
        $set: {
          lastAttemptAt: now,
          lastError: error instanceof Error ? error.message.slice(0, 300) : 'unknown error',
        },
      },
    )
    return { deleted: 0, failed: ids.length }
  }

  await collection.deleteMany({ _id: { $in: ids } })
  return { deleted: ids.length, failed: 0 }
}
