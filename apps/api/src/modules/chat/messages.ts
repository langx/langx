import {
  ERROR_CODES,
  MAX_PINNED_CONVERSATIONS,
  REPLY_PREVIEW_MAX_LENGTH,
  type ConversationFilter,
  type SendCorrectionInput,
  type SendMediaMessageInput,
  type SendTextMessageInput,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { ApiError } from '../../lib/ApiError'
import { assertMediaAllowed } from '../media/assertMedia'
import { blockedUserIds } from '../moderation/blocks'
import { awardForSend } from '../tokens/awards'
import { assertConversationAccess, assertMediaUnlocked } from './access'
import { toMessageView, type MessageView } from './messageView'
import type { Conversation, Message } from './conversations'
import { mediaLockedFor, toConversationView, type ConversationView } from './conversationView'

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

/**
 * The quoted message, resolved once at send time.
 *
 * Scoped to the conversation exactly the way `sendCorrection` scopes its
 * target: an id from another thread must read as "not found" rather than as a
 * permission error, because the two are indistinguishable to someone guessing
 * ids and only one of them confirms the message exists.
 */
async function resolveReplyTo(
  db: Db,
  conversation: Conversation,
  replyToMessageId: string | undefined,
): Promise<Message['replyTo'] | undefined> {
  if (!replyToMessageId) return undefined

  let targetId: ObjectId
  try {
    targetId = new ObjectId(replyToMessageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed reply target id')
  }

  const target = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne({ _id: targetId, conversationId: conversation._id })
  if (!target) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Reply target not found in this conversation')
  }

  return {
    messageId: target._id,
    senderId: target.senderId,
    preview: (target.body || previewFor(target.type)).slice(0, REPLY_PREVIEW_MAX_LENGTH),
  }
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
      // Riding the write that was already happening. The media gate reads this
      // and must not pay for a `countDocuments` on the send path.
      $inc: { messageCount: 1, ...(recipientId ? { [`unread.${recipientId}`]: 1 } : {}) },
      /*
       * A new message brings a deleted thread back, on both sides. Deleting is
       * "I am done with this conversation", not "block me from it" — the other
       * person knows nothing about it and writing again has to reach somebody.
       *
       * It comes back empty for whoever deleted it: the messages it used to
       * hold carry their id in `hiddenFor`, and only the new one does not.
       * Unconditional because `$unset` on an absent key is free, which is
       * cheaper than reading the document to decide.
       */
      $unset: Object.fromEntries(conversation.participants.map((id) => [`deletedBy.${id}`, ''])),
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
  const replyTo = await resolveReplyTo(db, conversation, input.replyToMessageId)

  /**
   * A send whose ack was lost looks exactly like one that never arrived, so the
   * client retries it. `sender_client_id_unique` is what makes that safe: the
   * second write is refused by the index rather than by a prior read, which is
   * the only version that holds under a race.
   */
  if (input.clientId) {
    const already = await db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ senderId, clientId: input.clientId })
    if (already) return { message: already, conversation }
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: 'text',
    body: input.body,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(replyTo ? { replyTo } : {}),
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

  /**
   * The target is already loaded, so stamping it costs nothing — and it is
   * what makes `canEditMessage` a field read rather than a second query. The
   * sentence someone has just taught about must stop being editable, or the
   * `original` snapshot above ends up quoting something that no longer exists.
   */
  await db
    .collection<Message>(COLLECTIONS.messages)
    .updateOne({ _id: target._id }, { $set: { correctedAt: message.createdAt } })

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
  // The belt to the upload URL's braces. A URL signed a moment before the
  // fifth message was deleted would otherwise still land, and any future
  // transport that forgets the first check lands here instead of nowhere.
  await assertMediaUnlocked(db, conversation)

  // Shared with the feed — see `assertMediaAllowed`. The ceilings are the real
  // cost control, and there must be exactly one copy of them.
  assertMediaAllowed(input.media, storagePublicBaseUrl, input.kind)

  const replyTo = await resolveReplyTo(db, conversation, input.replyToMessageId)

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    type: input.kind,
    body: input.body ?? '',
    media: input.media,
    ...(replyTo ? { replyTo } : {}),
    createdAt: new Date(),
  }

  const updatedConversation = await recordMessage(db, conversation, message)
  return { message, conversation: updatedConversation }
}

export interface MessagePage {
  /**
   * Projected, never raw. Per-user state lives on the same document now, so a
   * page has to be built for the person asking for it — see `toMessageView`.
   */
  items: MessageView[]
  /** Feed to `cursor` for the page *before* this one. Null at the beginning of history. */
  nextCursor: string | null
  /**
   * Feed to `after` for the page *after* this one. Null means this page
   * already reaches the live tail, which is what lets a client know whether a
   * newly arrived message belongs in it.
   */
  prevCursor: string | null
  participants: string[]
  /**
   * The pinned message, on the page for the same reason `participants` is: the
   * thread's banner needs it before anything else has loaded, and the client
   * never fetches the conversation document on its own.
   */
  pinned: { messageId: string; byUserId: string; at: string } | null
  /**
   * How many more messages before an attachment is allowed here, or 0. On the
   * page for the same reason `participants` and `pinned` are: the composer
   * needs it before anything else has loaded, and the client never fetches the
   * conversation document on its own.
   */
  mediaLockedFor: number
  /** Set only by `listMessagesAround`, so a client knows what to scroll to. */
  anchorId?: string
}

/**
 * Newest page first, but each page's `items` come back oldest-first.
 *
 * `cursor` walks backwards into history and `after` walks forwards toward the
 * newest; only one of the two, and neither means "the newest page". Forwards
 * exists for `listMessagesAround`'s window, which starts in the middle of a
 * thread and has to be able to page in both directions to reach the tail.
 */
export async function listMessages(
  db: Db,
  userId: string,
  conversationId: string,
  query: { cursor?: string | undefined; after?: string | undefined; limit: number },
): Promise<MessagePage> {
  if (query.cursor && query.after) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Pass cursor or after, not both')
  }
  const conversation = await assertConversationAccess(db, conversationId, userId)
  const messages = db.collection<Message>(COLLECTIONS.messages)

  const forwards = Boolean(query.after)
  const filter: Document = { conversationId: conversation._id }
  const boundary = query.after ?? query.cursor
  if (boundary) {
    const { date, id } = decodeDateIdCursor(boundary)
    filter.$or = forwards
      ? [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: id } }]
      : [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  const direction = forwards ? 1 : -1
  const page = await messages
    .find(filter)
    .sort({ createdAt: direction, _id: direction })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const window = hasMore ? page.slice(0, query.limit) : page
  // Descending queries come back newest-first; the wire format is oldest-first.
  const items = forwards ? window : window.reverse()

  const oldest = items[0]
  const newest = items.at(-1)
  return {
    items: items.map((message) => toMessageView(message, userId)),
    // Only the direction actually being paged reports more: the caller already
    // holds everything on the side it came from, and claiming otherwise would
    // have an infinite query walk back over pages it has.
    nextCursor:
      !forwards && hasMore && oldest ? encodeDateIdCursor(oldest.createdAt, oldest._id) : null,
    prevCursor:
      forwards && hasMore && newest ? encodeDateIdCursor(newest.createdAt, newest._id) : null,
    // The thread header needs the counterpart even before anyone has replied,
    // and a one-sided thread has no message to read a partner id off.
    participants: conversation.participants,
    mediaLockedFor: mediaLockedFor(conversation),
    pinned: conversation.pinned
      ? {
          messageId: conversation.pinned.messageId.toHexString(),
          byUserId: conversation.pinned.byUserId,
          at: conversation.pinned.at.toISOString(),
        }
      : null,
  }
}

/**
 * A window centred on one message, for jumping to it.
 *
 * Two queries rather than one because a keyset cursor only walks one way: the
 * anchor's neighbours on either side are two different scans off the same
 * `(createdAt, _id)` key. Both cursors come back, so the window can then be
 * paged in either direction until it meets the tail.
 *
 * Used by a reply's quote, and later by the pinned banner and the starred
 * list — all three are "show me this message in its context".
 */
export async function listMessagesAround(
  db: Db,
  userId: string,
  conversationId: string,
  query: { around: string; limit: number },
): Promise<MessagePage> {
  const conversation = await assertConversationAccess(db, conversationId, userId)
  const messages = db.collection<Message>(COLLECTIONS.messages)

  let anchorId: ObjectId
  try {
    anchorId = new ObjectId(query.around)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed message id')
  }

  const anchor = await messages.findOne({ _id: anchorId, conversationId: conversation._id })
  if (!anchor) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found in this conversation')
  }

  const half = Math.max(1, Math.floor(query.limit / 2))
  const [olderPage, newerPage] = await Promise.all([
    messages
      .find({
        conversationId: conversation._id,
        $or: [
          { createdAt: { $lt: anchor.createdAt } },
          { createdAt: anchor.createdAt, _id: { $lt: anchor._id } },
        ],
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(half + 1)
      .toArray(),
    messages
      .find({
        conversationId: conversation._id,
        $or: [
          { createdAt: { $gt: anchor.createdAt } },
          { createdAt: anchor.createdAt, _id: { $gt: anchor._id } },
        ],
      })
      .sort({ createdAt: 1, _id: 1 })
      .limit(half + 1)
      .toArray(),
  ])

  const hasOlder = olderPage.length > half
  const hasNewer = newerPage.length > half
  const older = (hasOlder ? olderPage.slice(0, half) : olderPage).reverse()
  const newer = hasNewer ? newerPage.slice(0, half) : newerPage

  const items = [...older, anchor, ...newer]
  const oldest = items[0]
  const newest = items.at(-1)

  return {
    items: items.map((message) => toMessageView(message, userId)),
    nextCursor: hasOlder && oldest ? encodeDateIdCursor(oldest.createdAt, oldest._id) : null,
    prevCursor: hasNewer && newest ? encodeDateIdCursor(newest.createdAt, newest._id) : null,
    participants: conversation.participants,
    mediaLockedFor: mediaLockedFor(conversation),
    pinned: conversation.pinned
      ? {
          messageId: conversation.pinned.messageId.toHexString(),
          byUserId: conversation.pinned.byUserId,
          at: conversation.pinned.at.toISOString(),
        }
      : null,
    anchorId: anchor._id.toHexString(),
  }
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
  items: ConversationView[]
  /** Always the whole set, never paginated — see the note in `listConversations`. */
  pinned: ConversationView[]
  nextCursor: string | null
}

export async function listConversations(
  db: Db,
  userId: string,
  query: { filter?: ConversationFilter | undefined; cursor?: string | undefined; limit: number },
): Promise<ConversationPage> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)
  const filter = query.filter ?? 'all'

  // A blocked counterpart's thread disappears from the list entirely.
  // `assertConversationAccess` already refuses to open it; without this the
  // thread would still sit in the list, unopenable — the worst of both.
  const hidden = await blockedUserIds(db, userId)
  // On an array field `$nin` means "contains none of these", so this reads as
  //: my threads, minus any whose participant list includes someone hidden.
  const base: Document = {
    participants: hidden.length > 0 ? { $eq: userId, $nin: hidden } : userId,
  }

  /*
   * Archiving is a per-tab bound, not a flag on a row: the archive tab is the
   * only place archived threads appear, and every other tab is defined by
   * their absence. Written as `$ne: true` rather than `$exists: false` so a
   * document that was archived and then un-archived — which leaves the key
   * unset — reads the same as one that never was.
   */
  const archivedPath = `archivedBy.${userId}`
  if (filter === 'archived') base[archivedPath] = true
  else base[archivedPath] = { $ne: true }

  // Deleted threads are gone from every tab, archive included — `$ne: true`
  // for the same reason as above, since coming back leaves the key unset.
  base[`deletedBy.${userId}`] = { $ne: true }

  // "They spoke last." See `toConversationView` for why this is not `unread`.
  if (filter === 'unreplied') base['lastMessage.senderId'] = { $ne: userId }

  const pinnedPath = `pinnedBy.${userId}`

  /*
   * Pinned threads are fetched whole and separately, and that is a deliberate
   * limit rather than an oversight.
   *
   * Pinning makes the sort compound — pinned first, then recency — and the
   * cursor is `<lastMessage.createdAt>|<_id>`, which cannot express "and also
   * this side of the pin boundary". Rather than widen the cursor for a set
   * that is small by construction, the pins come back in one un-paginated
   * query and the page below excludes them. `MAX_PINNED_CONVERSATIONS` is what
   * keeps "small by construction" true.
   */
  const pinned =
    filter === 'archived'
      ? []
      : await conversations
          .find({ ...base, [pinnedPath]: true })
          .sort({ 'lastMessage.createdAt': -1, _id: -1 })
          .limit(MAX_PINNED_CONVERSATIONS)
          .toArray()

  const pageFilter: Document = { ...base }
  if (filter !== 'archived') pageFilter[pinnedPath] = { $ne: true }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    pageFilter.$or = [
      { 'lastMessage.createdAt': { $lt: date } },
      { 'lastMessage.createdAt': date, _id: { $lt: id } },
    ]
  }

  const page = await conversations
    .find(pageFilter)
    .sort({ 'lastMessage.createdAt': -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const rows = hasMore ? page.slice(0, query.limit) : page
  const last = rows.at(-1)
  const nextCursor =
    hasMore && last ? encodeDateIdCursor(last.lastMessage.createdAt, last._id) : null

  return {
    items: rows.map((c) => toConversationView(c, userId)),
    pinned: pinned.map((c) => toConversationView(c, userId)),
    nextCursor,
  }
}
