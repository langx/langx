import { ERROR_CODES, MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES } from '@langx/shared'
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
 * How many messages `userId` has received in this thread — the other
 * participant's share of the count.
 *
 * Reads the denormalized per-sender map, and falls back to counting for the
 * conversations that predate it. An absent `messageCountBy` cannot mean "they
 * never wrote": the map is written on the same `$inc` as `messageCount`, so it
 * is only missing from documents that predate it — the threads with the most
 * history, whose absence read as zero would lock a two-year-old conversation
 * out of sending a photo. Those are counted, on the media path only, through
 * the `conversation_sender` index; the set shrinks every time one of them
 * gets a message.
 */
export async function messagesReceivedFrom(
  db: Db,
  conversation: Conversation,
  userId: string,
): Promise<number> {
  const other = conversation.participants.find((id) => id !== userId)
  if (!other) return 0
  if (conversation.messageCountBy) return conversation.messageCountBy[other] ?? 0
  return db
    .collection<Message>(COLLECTIONS.messages)
    .countDocuments({ conversationId: conversation._id, senderId: other })
}

/**
 * Refuses a photo or a voice note from somebody who has not yet received
 * `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES` messages from the other person.
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
 * `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES`.
 */
export async function assertMediaUnlocked(
  db: Db,
  conversation: Conversation,
  senderId: string,
): Promise<void> {
  const received = await messagesReceivedFrom(db, conversation, senderId)
  if (received >= MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES) return
  throw new ApiError(
    ERROR_CODES.MEDIA_LOCKED,
    `Photos and voice notes unlock after ${MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES} messages from them`,
    { max: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES },
  )
}
