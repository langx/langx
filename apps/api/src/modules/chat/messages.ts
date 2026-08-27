import { ERROR_CODES, type SendCorrectionInput, type SendTextMessageInput } from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { ApiError } from '../../lib/ApiError'
import { assertConversationAccess } from './access'
import type { Conversation, Message } from './conversations'

export interface SendResult {
  message: Message
  conversation: Conversation
}

/**
 * Every send (text or correction) is: write the message, then update the
 * conversation's denormalized `lastMessage`/`unread`/`bothSpoke` — same two
 * writes regardless of type, factored here so `sendTextMessage` and
 * `sendCorrection` can't drift on what "sending a message" means for the
 * conversation document.
 */
async function recordMessage(
  db: Db,
  conversation: Conversation,
  message: Message,
): Promise<Conversation> {
  await db.collection<Message>(COLLECTIONS.messages).insertOne(message)

  const recipientId = conversation.participants.find((id) => id !== message.senderId)
  const bothSpoke = conversation.bothSpoke || message.senderId !== conversation.firstMessageBy

  const updated = await db.collection<Conversation>(COLLECTIONS.conversations).findOneAndUpdate(
    { _id: conversation._id },
    {
      $set: {
        lastMessage: {
          body: message.body,
          senderId: message.senderId,
          createdAt: message.createdAt,
        },
        updatedAt: message.createdAt,
        bothSpoke,
      },
      ...(recipientId ? { $inc: { [`unread.${recipientId}`]: 1 } } : {}),
    },
    { returnDocument: 'after' },
  )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')
  return updated
}

export async function sendTextMessage(
  db: Db,
  senderId: string,
  input: SendTextMessageInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'text',
    body: input.body,
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

/**
 * Unlimited on both tiers by design — see `PLAN_LIMITS.correctionsPer24h`'s
 * doc comment. No quota call anywhere in this path.
 */
export async function sendCorrection(
  db: Db,
  senderId: string,
  input: SendCorrectionInput,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  let targetId: ObjectId
  try {
    targetId = new ObjectId(input.targetMessageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed target message id')
  }

  const target = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne({ _id: targetId, conversationId: conversation._id })
  if (!target) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Target message not found in this conversation')
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'correction',
    body: input.corrected,
    correction: {
      targetMessageId: targetId,
      original: target.body,
      corrected: input.corrected,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

export interface MessagePage {
  items: Message[]
  nextCursor: string | null
}

/**
 * Newest page first, but each page's `items` come back oldest-first — a chat
 * UI appends `nextCursor`'s page above what's already rendered without
 * needing to reverse anything itself.
 */
export async function listMessages(
  db: Db,
  userId: string,
  conversationId: string,
  query: { cursor?: string | undefined; limit: number },
): Promise<MessagePage> {
  const conversation = await assertConversationAccess(db, conversationId, userId)
  const messages = db.collection<Message>(COLLECTIONS.messages)

  const filter: Document = { conversationId: conversation._id }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  const page = await messages
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const items = hasMore ? page.slice(0, query.limit) : page
  const oldest = items.at(-1)
  const nextCursor = hasMore && oldest ? encodeDateIdCursor(oldest.createdAt, oldest._id) : null

  return { items: items.reverse(), nextCursor }
}

export async function markConversationRead(
  db: Db,
  userId: string,
  conversationId: string,
): Promise<Conversation> {
  const conversation = await assertConversationAccess(db, conversationId, userId)

  const updated = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .findOneAndUpdate(
      { _id: conversation._id },
      { $set: { [`unread.${userId}`]: 0 } },
      { returnDocument: 'after' },
    )
  await db
    .collection<Message>(COLLECTIONS.messages)
    .updateMany(
      { conversationId: conversation._id, senderId: { $ne: userId }, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    )

  return updated ?? conversation
}

export interface ConversationPage {
  items: Conversation[]
  nextCursor: string | null
}

export async function listConversations(
  db: Db,
  userId: string,
  query: { cursor?: string | undefined; limit: number },
): Promise<ConversationPage> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  const filter: Document = { participants: userId }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [
      { 'lastMessage.createdAt': { $lt: date } },
      { 'lastMessage.createdAt': date, _id: { $lt: id } },
    ]
  }

  const page = await conversations
    .find(filter)
    .sort({ 'lastMessage.createdAt': -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const items = hasMore ? page.slice(0, query.limit) : page
  const last = items.at(-1)
  const nextCursor =
    hasMore && last ? encodeDateIdCursor(last.lastMessage.createdAt, last._id) : null

  return { items, nextCursor }
}
