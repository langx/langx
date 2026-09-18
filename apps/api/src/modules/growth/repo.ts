import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * Everything this flow reads or writes, in one place — the route never touches
 * a collection, same as everywhere else.
 *
 * Two rows per person at most: the comment that was answered, and the person
 * who wrote it. The first exists only to be a uniqueness constraint; the
 * second is the lead.
 */

export interface InstagramLead {
  /** Instagram-scoped user id — theirs, and only for this account. */
  _id: string
  /** The comment that started it, so a delivery can be traced back to a post. */
  commentId?: string
  /** When they last wrote to us: the 24-hour window is measured from this. */
  lastMessageAt?: Date
  /** When the link went out. Set once; a second delivery is not wanted. */
  deliveredAt?: Date
  /** How many times we have asked them to follow. One is a nudge, two is not. */
  followAsks?: number
  createdAt: Date
}

/**
 * Claim a comment, or find it already claimed.
 *
 * The unique index on `_id` is what makes this safe rather than the read that
 * would otherwise precede it: Instagram retries a webhook it did not get a
 * 200 for, and two deliveries of the same event arriving at once would both
 * pass a check-then-insert. A comment gets exactly one private reply from the
 * platform anyway — this is what stops us spending it twice and logging a
 * platform error for the second.
 */
export async function claimComment(db: Db, commentId: string): Promise<boolean> {
  try {
    await db
      .collection(COLLECTIONS.instagramComments)
      .insertOne({ _id: commentId as never, answeredAt: new Date() })
    return true
  } catch (caught) {
    // 11000 is the duplicate key; anything else is a real failure.
    if (caught instanceof Error && 'code' in caught && caught.code === 11000) return false
    throw caught
  }
}

/** Remember that somebody wrote to us, and when — the window starts here. */
export async function recordInboundMessage(
  db: Db,
  igsid: string,
  at: Date = new Date(),
): Promise<InstagramLead> {
  const result = await db
    .collection<InstagramLead>(COLLECTIONS.instagramLeads)
    .findOneAndUpdate(
      { _id: igsid },
      { $set: { lastMessageAt: at }, $setOnInsert: { createdAt: at } },
      { upsert: true, returnDocument: 'after' },
    )
  if (!result) throw new Error(`lead ${igsid} vanished between upsert and read`)
  return result
}

export async function markDelivered(db: Db, igsid: string): Promise<void> {
  await db
    .collection<InstagramLead>(COLLECTIONS.instagramLeads)
    .updateOne({ _id: igsid }, { $set: { deliveredAt: new Date() } })
}

export async function countFollowAsk(db: Db, igsid: string): Promise<number> {
  const result = await db
    .collection<InstagramLead>(COLLECTIONS.instagramLeads)
    .findOneAndUpdate({ _id: igsid }, { $inc: { followAsks: 1 } }, { returnDocument: 'after' })
  return result?.followAsks ?? 1
}
