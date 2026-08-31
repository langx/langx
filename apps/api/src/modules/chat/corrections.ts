import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import type { Message } from './conversations'

export interface CorrectionsPage {
  items: Message[]
  nextCursor: string | null
}

/**
 * Every chat correction one person has written, newest first.
 *
 * A sibling of `listStarredMessages` — the other read in the chat area that is
 * not scoped to a thread — but **paged**, which starred deliberately is not. A
 * bookmark list people actually keep is tens of items and the server caps it; a
 * correction history is the number on somebody's profile, which is meant to
 * grow without bound. Capping it would quietly hide the older half of the thing
 * the screen exists to show.
 *
 * Chat only. Post corrections live in a different collection with a different
 * shape — no `original` of their own, because the original is the post's body —
 * and merging the two in one Mongo query is not possible. The screen shows the
 * chat half and says so; the feed already has its own per-post list.
 *
 * Rides `sender_type_created`. `sender_type` gives the same filter with no
 * `createdAt`, which sorts every correction the user ever wrote in memory.
 */
export async function listCorrectionsWritten(
  db: Db,
  userId: string,
  limit: number,
  cursor?: string,
): Promise<CorrectionsPage> {
  const filter: Record<string, unknown> = {
    senderId: userId,
    type: 'correction',
    deletedAt: { $exists: false },
  }

  if (cursor) {
    const { date, id } = decodeDateIdCursor(cursor)
    // Keyset, not skip: an offset shifts under a correction written while the
    // reader is paging, which repeats or drops a row.
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  // One over, so "is there another page" is answered without a second count.
  const rows = await db
    .collection<Message>(COLLECTIONS.messages)
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray()

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items.at(-1)

  return {
    items,
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}
