import { OFFICIAL_ASSISTANT } from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

interface UsageDay {
  /** The UTC day, `yyyy-mm-dd`. The document has no other identity. */
  _id: string
  calls: number
  createdAt: Date
}

/** UTC, like every other cap that is a ceiling on rows rather than a streak. */
function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Takes one of today's model calls, or says there are none left.
 *
 * **A counter, not a count of messages.** The obvious implementation — count
 * what @langx has said in the last 24 hours — is wrong in a way that only
 * shows up on the worst possible day: an announcement writes a message to
 * every account on the service, and the assistant would go silent for everyone
 * the moment the send finished. What costs money is a call to the model, so
 * that is what is counted.
 *
 * The check and the claim are **one atomic update**, which is what makes this
 * a real ceiling rather than a race: the filter refuses the write once the
 * count is at the cap, and with `upsert` that refusal surfaces as a duplicate
 * key on `_id`, because Mongo falls through to inserting a day that is already
 * there. Same reasoning as the quota decrement and the hourly gift — let the
 * write decide, rather than reading first and hoping nothing happens in
 * between.
 *
 * Claimed and then not used is fine: a failed call costs a slot out of five
 * hundred, and the alternative is a slot released by code that also has to be
 * right about every way a call can end.
 */
export async function claimAssistantCall(db: Db, now: Date = new Date()): Promise<boolean> {
  const usage = db.collection<UsageDay>(COLLECTIONS.assistantUsage)
  try {
    await usage.updateOne(
      { _id: dayOf(now), calls: { $lt: OFFICIAL_ASSISTANT.globalRepliesPerDay } },
      { $inc: { calls: 1 }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    )
    return true
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return false
    throw error
  }
}

/** What has been spent today. Read by nothing but a person asking. */
export async function assistantCallsToday(db: Db, now: Date = new Date()): Promise<number> {
  const day = await db.collection<UsageDay>(COLLECTIONS.assistantUsage).findOne({ _id: dayOf(now) })
  return day?.calls ?? 0
}
