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

/**
 * Every id here arrives from a webhook body and is used as a document `_id`,
 * so each entry point checks it is a string before Mongo sees it.
 *
 * The route checks too, and this is not the same check twice: TypeScript's
 * `string` is a compile-time claim about a value parsed out of somebody else's
 * JSON, and access control in this codebase lives in the repository. An object
 * reaching `{ _id: id }` is not a bad lookup, it is every row at once.
 */
function assertId(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${what} must be a non-empty string`)
  }
  return value
}

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
  const id = assertId(commentId, 'comment id')
  try {
    await db
      .collection(COLLECTIONS.instagramComments)
      .insertOne({ _id: id as never, answeredAt: new Date() })
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
  const id = assertId(igsid, 'instagram user id')
  const result = await db
    .collection<InstagramLead>(COLLECTIONS.instagramLeads)
    .findOneAndUpdate(
      { _id: id },
      { $set: { lastMessageAt: at }, $setOnInsert: { createdAt: at } },
      { upsert: true, returnDocument: 'after' },
    )
  if (!result) throw new Error(`lead ${igsid} vanished between upsert and read`)
  return result
}

export async function markDelivered(db: Db, igsid: string): Promise<void> {
  const id = assertId(igsid, 'instagram user id')
  await db
    .collection<InstagramLead>(COLLECTIONS.instagramLeads)
    .updateOne({ _id: id }, { $set: { deliveredAt: new Date() } })
}

export async function countFollowAsk(db: Db, igsid: string): Promise<number> {
  const id = assertId(igsid, 'instagram user id')
  const result = await db
    .collection<InstagramLead>(COLLECTIONS.instagramLeads)
    .findOneAndUpdate({ _id: id }, { $inc: { followAsks: 1 } }, { returnDocument: 'after' })
  return result?.followAsks ?? 1
}
