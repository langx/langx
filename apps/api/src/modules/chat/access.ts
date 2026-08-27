import { ERROR_CODES } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Conversation } from './conversations'

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
