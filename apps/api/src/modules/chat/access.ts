import { ERROR_CODES, MEDIA_UNLOCKS_AFTER_MESSAGES } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Conversation, Message } from './conversations'

/**
 * The one gate every conversation-scoped operation goes through — REST
 * (`routes/messages.ts`) and socket handlers (`ws/index.ts`) alike, so the
 * socket transport is never a back door around the REST checks (see the
 * plan's "socket events pass through the same guards").
 *
 * Checks participancy AND re-checks blocks live on every call, not just at
 * `POST /conversations` time — a block placed after the conversation exists
 * must immediately cut off both REST and realtime access to it.
 */
export async function assertConversationAccess(
  db: Db,
  conversationId: string,
  userId: string,
): Promise<Conversation> {
  let objectId: ObjectId
  try {
    objectId = new ObjectId(conversationId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed conversation id')
  }

  const conversation = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .findOne({ _id: objectId })
  // Not a participant gets the same 404 as "doesn't exist" — existence of a
  // conversation between two other people is not this caller's business.
  if (!conversation || !conversation.participants.includes(userId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')
  }

  const otherId = conversation.participants.find((id) => id !== userId)
  const blocked = await db.collection(COLLECTIONS.blocks).findOne({
    $or: [
      { blockerId: userId, blockedId: otherId },
      { blockerId: otherId, blockedId: userId },
    ],
  })
  if (blocked)
    throw new ApiError(ERROR_CODES.BLOCKED, 'Cannot access a conversation with a blocked user')

  return conversation
}

/**
 * How many messages this thread has actually carried.
 *
 * Reads the denormalized counter, and falls back to counting for the
 * conversations that predate it. An absent `messageCount` cannot mean "no
 * messages" — every conversation is created with at least one, and with the
 * field set — so it can only mean the document was written before the counter
 * existed. Those are exactly the threads with the most history, and reading
 * their absence as zero would lock two-year-old conversations out of sending a
 * photo.
 *
 * The count is not written back. It is one query, on the media path only, for
 * a set of documents that shrinks every time one of them gets a message.
 */
async function messagesInThread(db: Db, conversation: Conversation): Promise<number> {
  if (typeof conversation.messageCount === 'number') return conversation.messageCount
  return db
    .collection<Message>(COLLECTIONS.messages)
    .countDocuments({ conversationId: conversation._id })
}

/**
 * Refuses a photo or a voice note into a conversation that has not said
 * `MEDIA_UNLOCKS_AFTER_MESSAGES` things yet.
 *
 * Called from two places on purpose, and the *first* one is the one that
 * matters. `POST /messages/upload-url` is where the bytes are stopped: the
 * client uploads straight to the bucket through a presigned URL and only then
 * sends the message, so a check on the send path alone would refuse a message
 * pointing at a photograph we had already stored and could already serve. The
 * second call, in `sendMediaMessage`, catches a URL signed a moment before the
 * fifth message was undone — and any future transport that forgets the first.
 *
 * No tier check anywhere in here, deliberately. See
 * `MEDIA_UNLOCKS_AFTER_MESSAGES`.
 */
export async function assertMediaUnlocked(db: Db, conversation: Conversation): Promise<void> {
  const sent = await messagesInThread(db, conversation)
  if (sent >= MEDIA_UNLOCKS_AFTER_MESSAGES) return
  throw new ApiError(
    ERROR_CODES.MEDIA_LOCKED,
    `Photos and voice notes unlock after ${MEDIA_UNLOCKS_AFTER_MESSAGES} messages`,
    { max: MEDIA_UNLOCKS_AFTER_MESSAGES },
  )
}
