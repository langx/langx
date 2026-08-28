import {
  ERROR_CODES,
  isAudioContentType,
  isImageContentType,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  type SendCorrectionInput,
  type SendMediaMessageInput,
  type SendTextMessageInput,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { ApiError } from '../../lib/ApiError'
import { blockedUserIds } from '../moderation/blocks'
import { awardForSend } from '../tokens/awards'
import { assertConversationAccess } from './access'
import type { Conversation, Message } from './conversations'

export interface SendResult {
  message: Message
  conversation: Conversation
}

/**
 * Every send (text or correction) is: write the message, update the
 * conversation's denormalized `lastMessage`/`unread`/`bothSpoke`, then pay
 * out token and advance the streak — the same sequence regardless of type,
 * factored here so `sendTextMessage` and `sendCorrection` can't drift on what
 * "sending a message" means for the conversation document, and so the socket
 * transport earns tokens through exactly the same code REST does.
 */
function previewFor(type: Message['type']): string {
  if (type === 'image') return '📷 Photo'
  if (type === 'audio') return '🎤 Voice message'
  return ''
}

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
          // The chat list shows this verbatim, so an attachment needs a label
          // rather than the empty string a caption-less voice note carries.
          body: message.body || previewFor(message.type),
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

  await awardForSend(db, {
    conversation: updated,
    message,
    // The transition, not the state: `bothSpoke` stays true forever after, so
    // the reciprocity bonus has to fire on the send that flipped it.
    becameMutual: !conversation.bothSpoke && bothSpoke,
  })

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

/**
 * An image or a voice note. Restores v1 parity, and is what lets the message
 * migration bring a whole thread across instead of a text-only skeleton.
 *
 * The attachment is already in the bucket by the time this runs — the client
 * uploaded it through a presigned URL — so this validates that what it is
 * telling us matches what it asked to upload, and refuses anything else. The
 * checks are cheap and the alternative is a message pointing at a file we
 * never agreed to host.
 */
export async function sendMediaMessage(
  db: Db,
  senderId: string,
  input: SendMediaMessageInput,
  storagePublicBaseUrl: string | undefined,
): Promise<SendResult> {
  const conversation = await assertConversationAccess(db, input.conversationId, senderId)

  const typeMatches =
    input.kind === 'image'
      ? isImageContentType(input.media.contentType)
      : isAudioContentType(input.media.contentType)
  if (!typeMatches) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `${input.media.contentType} is not a supported ${input.kind} type`,
    )
  }

  const maxBytes = input.kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
  if (input.media.sizeBytes > maxBytes) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, `That ${input.kind} is too large`)
  }

  // A URL outside our own bucket would let a message embed an arbitrary host,
  // and would survive the account purge because we could never delete it.
  if (!storagePublicBaseUrl || !input.media.url.startsWith(storagePublicBaseUrl)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Attachment must point into our own storage bucket',
    )
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: input.kind,
    body: input.body ?? '',
    media: input.media,
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

export interface MessagePage {
  items: Message[]
  nextCursor: string | null
  participants: string[]
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

  // The thread header needs the counterpart even before anyone has replied,
  // and a one-sided thread has no message to read a partner id off.
  return { items: items.reverse(), nextCursor, participants: conversation.participants }
}

/**
 * The second tick: everything in this conversation that `recipientId` has not
 * received yet is now on their device. Returns the timestamp if anything
 * actually changed and `null` otherwise, so a caller does not emit a realtime
 * event announcing that nothing happened.
 *
 * `$exists: false` rather than a blanket `$set`, because delivery is a moment,
 * not a flag — re-stamping a message that arrived an hour ago would drag its
 * timestamp forward every time the recipient reconnects.
 */
export async function markDelivered(
  db: Db,
  conversationId: ObjectId,
  recipientId: string,
): Promise<Date | null> {
  const deliveredAt = new Date()
  const result = await db.collection<Message>(COLLECTIONS.messages).updateMany(
    {
      conversationId,
      senderId: { $ne: recipientId },
      deliveredAt: { $exists: false },
    },
    { $set: { deliveredAt } },
  )
  return result.modifiedCount > 0 ? deliveredAt : null
}

export interface DeliveredSweep {
  conversationId: string
  /** The counterpart — the one waiting to see a second tick appear. */
  senderId: string
  deliveredAt: Date
}

/**
 * What runs when someone connects: every message that was sent to them while
 * they were away is delivered now, in every thread at once.
 *
 * Without this, a message sent to an offline recipient would sit on one tick
 * forever — the send-time path can only mark what it can hand to an open
 * socket, and there may not be one.
 *
 * Scoped to conversations with a non-zero unread count rather than all of
 * them, which is sound because undelivered implies unread: a message cannot be
 * read before it arrives, so anything missing `deliveredAt` is still counted
 * in `unread[userId]`. That keeps a reconnect off a scan of the user's entire
 * history — reconnects are frequent and happen in bursts (a train tunnel, a
 * phone waking up), which is exactly when a full scan would hurt most.
 */
export async function markPendingDelivered(db: Db, userId: string): Promise<DeliveredSweep[]> {
  const pending = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find({ participants: userId, [`unread.${userId}`]: { $gt: 0 } })
    .toArray()

  const swept: DeliveredSweep[] = []
  for (const conversation of pending) {
    const deliveredAt = await markDelivered(db, conversation._id, userId)
    const senderId = conversation.participants.find((id) => id !== userId)
    if (!deliveredAt || !senderId) continue
    swept.push({ conversationId: conversation._id.toHexString(), senderId, deliveredAt })
  }
  return swept
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
  // Reading a thread proves the messages in it arrived, and this is the only
  // path that catches a reader who never held a socket — opening the app
  // straight from a push notification marks read over REST. No
  // `conversation:delivered` event follows, because the `conversation:read`
  // the caller emits already implies it.
  await markDelivered(db, conversation._id, userId)
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

  // A blocked counterpart's thread disappears from the list entirely.
  // `assertConversationAccess` already refuses to open it; without this the
  // thread would still sit in the list, unopenable — the worst of both.
  const hidden = await blockedUserIds(db, userId)
  // On an array field `$nin` means "contains none of these", so this reads as
  //: my threads, minus any whose participant list includes someone hidden.
  const filter: Document = {
    participants: hidden.length > 0 ? { $eq: userId, $nin: hidden } : userId,
  }
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
