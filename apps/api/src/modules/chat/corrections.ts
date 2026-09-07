import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import type { Conversation, Message } from './conversations'

export interface CorrectionWritten {
  message: Message
  /**
   * The other side of the conversation — who the correction was for. Absent
   * only if the conversation is gone, which the row tolerates by showing the
   * date alone.
   */
  recipientId?: string
}

export interface CorrectionsPage {
  items: CorrectionWritten[]
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
 *
 * Each row names who it was for. A message carries only a `conversationId`,
 * so the page's conversations are read once (`_id` lookup, `participants`
 * only) and the other participant is attached — the design leads every row
 * with "For {name}", and the client has no endpoint that resolves a
 * conversation to its partner without fetching the thread.
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
  const messages = hasMore ? rows.slice(0, limit) : rows
  const last = messages.at(-1)

  const conversations = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find(
      { _id: { $in: [...new Set(messages.map((m) => m.conversationId))] } },
      { projection: { participants: 1 } },
    )
    .toArray()
  const partnerByConversation = new Map(
    conversations.map((c) => [String(c._id), c.participants.find((p) => p !== userId)]),
  )

  return {
    items: messages.map((message) => {
      const recipientId = partnerByConversation.get(String(message.conversationId))
      return recipientId ? { message, recipientId } : { message }
    }),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}
