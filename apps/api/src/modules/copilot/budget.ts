import { COPILOT_RULES } from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

interface UsageDay {
  /** The UTC day, `yyyy-mm-dd`. The document has no other identity. */
  _id: string
  calls: number
  createdAt: Date
}

function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Takes one of today's model calls for everybody, or says there are none
 * left — `COPILOT_RULES.globalCallsPerDay`.
 *
 * The same one-update claim as `claimAssistantCall`, for its reasons: the
 * filter refuses the write at the cap, and with `upsert` the refusal surfaces
 * as a duplicate key on the day's `_id`, so two requests racing for the last
 * call cannot both win. A counter of model calls rather than a count of
 * answers kept, because a call is what is billed.
 *
 * Kept apart from the assistant's counter, so neither can spend the other's
 * day. Claimed and then not used — the model declined, or failed — is not
 * given back: it was a call, and the person's own allowance is what is
 * refunded.
 */
export async function claimCopilotCall(db: Db, now: Date = new Date()): Promise<boolean> {
  const usage = db.collection<UsageDay>(COLLECTIONS.copilotUsage)
  try {
    await usage.updateOne(
      { _id: dayOf(now), calls: { $lt: COPILOT_RULES.globalCallsPerDay } },
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
export async function copilotCallsToday(db: Db, now: Date = new Date()): Promise<number> {
  const day = await db.collection<UsageDay>(COLLECTIONS.copilotUsage).findOne({ _id: dayOf(now) })
  return day?.calls ?? 0
}
