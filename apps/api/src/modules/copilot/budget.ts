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
 * day. Claimed and then not used — the model declined, or failed — is given
 * back with `releaseCopilotCall`, as the person's own unit is: otherwise one
 * person could ask the same declined question over and over, never spending
 * their allowance, until nobody else had a call left today.
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

/**
 * Gives back a call `claimCopilotCall` took. Same `now` as the claim, so a
 * call that straddles midnight is returned to the day it came from; the
 * filter keeps the counter from going below zero.
 */
export async function releaseCopilotCall(db: Db, now: Date = new Date()): Promise<void> {
  await db
    .collection<UsageDay>(COLLECTIONS.copilotUsage)
    .updateOne({ _id: dayOf(now), calls: { $gt: 0 } }, { $inc: { calls: -1 } })
}

/** What has been spent today. Read by nothing but a person asking. */
export async function copilotCallsToday(db: Db, now: Date = new Date()): Promise<number> {
  const day = await db.collection<UsageDay>(COLLECTIONS.copilotUsage).findOne({ _id: dayOf(now) })
  return day?.calls ?? 0
}
