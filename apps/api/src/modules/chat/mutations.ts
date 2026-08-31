import {
  canDeleteForEveryone,
  MAX_PINNED_CONVERSATIONS,
  canEditMessage,
  ERROR_CODES,
  MESSAGE_REACTIONS,
  type DeleteMessageInput,
  type EditMessageInput,
  type PinMessageInput,
  type ReactToMessageInput,
  type StarMessageInput,
} from '@langx/shared'
import { ObjectId, type Db, type UpdateFilter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import { assertConversationAccess } from './access'
import type { Conversation, Message } from './conversations'
import { toConversationView, type ConversationView } from './conversationView'

export interface MessageMutationResult {
  message: Message
  conversation: Conversation
  /**
   * Who the change is addressed to.
   *
   * `both` for anything the two people share — a reaction, a withdrawal.
   * `actor` for per-user state, which is emitted only so the actor's *other*
   * devices converge: hiding a message on the phone has to hide it on the web
   * tab, and must tell the other person nothing at all.
   */
  audience: 'both' | 'actor'
}

/**
 * The single door every mutation goes through.
 *
 * `assertConversationAccess` first, then the message scoped to that
 * conversation — so an id from another thread reads as "not found" rather than
 * as a permission error, the same way `sendCorrection` handles its target. One
 * function rather than a check per mutation is what makes "socket events pass
 * through the same guards as REST" enforceable instead of aspirational: there
 * is one place to read, and adding a mutation cannot skip it by accident.
 */
export async function loadMutableMessage(
  db: Db,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<{ conversation: Conversation; message: Message }> {
  const conversation = await assertConversationAccess(db, conversationId, userId)

  let id: ObjectId
  try {
    id = new ObjectId(messageId)
  } catch {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed message id')
  }

  const message = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne({ _id: id, conversationId: conversation._id })
  if (!message) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found in this conversation')
  }

  return { conversation, message }
}

/**
 * One reaction per person: tapping the same emoji clears it, tapping a
 * different one moves it.
 *
 * Written as a pull from every emoji except the chosen one plus an add to that
 * one, which is a single update over disjoint paths. Rewriting the whole map
 * would have been simpler and wrong — it would clobber a reaction the other
 * person added between the read and the write.
 *
 * Deliberately not on the token path: `awardForSend` is never called, no
 * `dailyActivity` counter moves and the streak does not advance. A reaction
 * costs one tap, and anything that pays out for one tap is a farm.
 */
export async function reactToMessage(
  db: Db,
  userId: string,
  input: ReactToMessageInput,
): Promise<MessageMutationResult> {
  const { conversation, message } = await loadMutableMessage(
    db,
    userId,
    input.conversationId,
    input.messageId,
  )
  if (message.deletedAt) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That message was deleted')
  }

  const current = Object.entries(message.reactions ?? {}).find(([, users]) =>
    users.includes(userId),
  )?.[0]
  const next = input.emoji && input.emoji !== current ? input.emoji : null

  const pull: Record<string, string> = {}
  for (const emoji of MESSAGE_REACTIONS) {
    if (emoji !== next) pull[`reactions.${emoji}`] = userId
  }
  const update: UpdateFilter<Message> = { $pull: pull }
  if (next) update.$addToSet = { [`reactions.${next}`]: userId }

  const updated = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOneAndUpdate({ _id: message._id }, update, { returnDocument: 'after' })
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found')

  return { message: updated, conversation, audience: 'both' }
}

export async function deleteMessage(
  db: Db,
  userId: string,
  input: DeleteMessageInput,
  storage?: StorageProvider,
): Promise<MessageMutationResult> {
  const { conversation, message } = await loadMutableMessage(
    db,
    userId,
    input.conversationId,
    input.messageId,
  )
  const messages = db.collection<Message>(COLLECTIONS.messages)

  // "Delete for me" is a per-user filter and nothing more. It stays available
  // forever, on anyone's message, including one already withdrawn.
  if (input.scope === 'me') {
    const updated = await messages.findOneAndUpdate(
      { _id: message._id },
      { $addToSet: { hiddenFor: userId } },
      { returnDocument: 'after' },
    )
    if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found')
    return { message: updated, conversation, audience: 'actor' }
  }

  /**
   * Already withdrawn: succeed and change nothing.
   *
   * This has to come *before* the window check, because `canDeleteForEveryone`
   * refuses a message that is already a tombstone — correctly, since that is
   * what stops the menu offering the row twice. Without this branch a repeat
   * would raise "only within two days", which is both untrue and unactionable,
   * and the conditional update below — the actual concurrency design — would
   * never be reached.
   */
  if (message.deletedAt) {
    return { message, conversation, audience: 'both' }
  }

  if (!canDeleteForEveryone(message, userId, new Date())) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Only your own messages, and only within two days of sending them',
    )
  }

  const now = new Date()
  /**
   * The predicate lives in the filter, not in an `if` above it. Two devices
   * pressing delete at once both pass the check and both reach here; only the
   * first matches, and `modifiedCount` is what tells the second to stop before
   * it decrements `unread` a second time.
   */
  const result = await messages.updateOne(
    { _id: message._id, senderId: userId, deletedAt: { $exists: false } },
    {
      $set: { deletedAt: now, deletedBy: userId, body: '' },
      $unset: { media: '', correction: '', replyTo: '' },
    },
  )

  const updated = await messages.findOne({ _id: message._id })
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found')
  if (result.modifiedCount === 0) {
    return { message: updated, conversation, audience: 'both' }
  }

  await applyDeleteSideEffects(db, conversation, message)
  await deleteAttachment(message, storage)

  return { message: updated, conversation, audience: 'both' }
}

/**
 * What a withdrawal costs the conversation document.
 *
 * Both writes are conditional, and both conditions are in the filter rather
 * than in a read followed by a decision — a message arriving mid-delete has to
 * win, and it does, by making the filter stop matching.
 */
async function applyDeleteSideEffects(
  db: Db,
  conversation: Conversation,
  deleted: Message,
): Promise<void> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  /**
   * `lastMessage` is patched in place, not recomputed. Under a tombstone the
   * newest message is still this row, so there is no next survivor to find, no
   * empty-thread case, and no risk of `$unset`ing the field `listConversations`
   * sorts on. If a new message landed first, `recordMessage` has already moved
   * `lastMessage` on and this matches nothing — which is the right answer.
   */
  await conversations.updateOne(
    {
      _id: conversation._id,
      'lastMessage.createdAt': deleted.createdAt,
      'lastMessage.senderId': deleted.senderId,
    },
    { $set: { 'lastMessage.body': '', 'lastMessage.deleted': true } },
  )

  const recipientId = conversation.participants.find((id) => id !== deleted.senderId)
  if (!recipientId || deleted.readAt) return

  /**
   * `$inc: -1` rather than a recount, because it *commutes* with the `$inc: +1`
   * a concurrent send is doing. A `countDocuments` followed by a `$set` would
   * silently discard that send. `$gt: 0` is the floor.
   */
  await conversations.updateOne(
    { _id: conversation._id, [`unread.${recipientId}`]: { $gt: 0 } },
    { $inc: { [`unread.${recipientId}`]: -1 } },
  )
}

/**
 * Mongo first, bucket second, and never the other way round: unsetting the
 * reference after deleting the bytes leaves a window where the message points
 * at a 404. Best-effort, like the account purge — a storage failure must not
 * undo a deletion the user has already been told happened.
 */
async function deleteAttachment(message: Message, storage?: StorageProvider): Promise<void> {
  const url = message.media?.url
  if (!url || !storage || !supportsPut(storage)) return
  const key = storage.keyFromPublicUrl(url)
  if (!key) return
  try {
    await storage.deleteObject(key)
  } catch {
    // Swallowed on purpose: the row is already a tombstone.
  }
}

/**
 * Editing your own text, inside the window and only if nobody has corrected it.
 *
 * No new tokens. The message was already paid for when it was sent, and paying
 * again for changing a word would make editing a way to earn.
 */
export async function editMessage(
  db: Db,
  userId: string,
  input: EditMessageInput,
): Promise<MessageMutationResult> {
  const { conversation, message } = await loadMutableMessage(
    db,
    userId,
    input.conversationId,
    input.messageId,
  )

  if (
    !canEditMessage({ ...message, corrected: Boolean(message.correctedAt) }, userId, new Date())
  ) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      message.correctedAt
        ? 'That message has been corrected, so it can no longer be edited'
        : 'Only your own text messages, and only within two days of sending them',
    )
  }

  const now = new Date()
  const updated = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOneAndUpdate(
      { _id: message._id, senderId: userId },
      { $set: { body: input.body, editedAt: now } },
      { returnDocument: 'after' },
    )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found')

  /**
   * The chat list keeps a copy of the last message's text, so an edit to that
   * one has to reach it. Conditional on the same pair a withdrawal uses: if
   * something newer arrived, this is no longer the last message and the filter
   * correctly matches nothing.
   */
  await db.collection<Conversation>(COLLECTIONS.conversations).updateOne(
    {
      _id: conversation._id,
      'lastMessage.createdAt': message.createdAt,
      'lastMessage.senderId': message.senderId,
    },
    { $set: { 'lastMessage.body': input.body } },
  )

  return { message: updated, conversation, audience: 'both' }
}

/**
 * Starring is private and one-sided — a bookmark, not a signal. It is the
 * clearest case for `audience: 'actor'`: the emit exists only so the same
 * person's other devices agree, and the peer is told nothing.
 */
export async function starMessage(
  db: Db,
  userId: string,
  input: StarMessageInput,
): Promise<MessageMutationResult> {
  const { conversation, message } = await loadMutableMessage(
    db,
    userId,
    input.conversationId,
    input.messageId,
  )

  const updated = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOneAndUpdate(
      { _id: message._id },
      input.starred ? { $addToSet: { starredBy: userId } } : { $pull: { starredBy: userId } },
      { returnDocument: 'after' },
    )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Message not found')

  return { message: updated, conversation, audience: 'actor' }
}

export interface PinResult {
  conversation: Conversation
}

/**
 * One pin per conversation, and either person can set or clear it.
 *
 * Shared rather than personal, unlike a star: a pin is how the two of them
 * agree on what this thread is about. In a 1-1 conversation there is no
 * asymmetry to protect — letting only the pinner unpin would leave the other
 * person stuck with a banner they cannot dismiss.
 */
export async function pinMessage(
  db: Db,
  userId: string,
  input: PinMessageInput,
): Promise<PinResult> {
  if (input.messageId === null) {
    const cleared = await db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOneAndUpdate(
        { _id: (await assertConversationAccess(db, input.conversationId, userId))._id },
        { $unset: { pinned: '' } },
        { returnDocument: 'after' },
      )
    if (!cleared) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')
    return { conversation: cleared }
  }

  const { conversation, message } = await loadMutableMessage(
    db,
    userId,
    input.conversationId,
    input.messageId,
  )
  if (message.deletedAt) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That message was deleted')
  }

  // Replaced, not appended: `MAX_PINNED_PER_CONVERSATION` is one, and a second
  // pin would need an order and a way to see the list.
  const updated = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .findOneAndUpdate(
      { _id: conversation._id },
      { $set: { pinned: { messageId: message._id, byUserId: userId, at: new Date() } } },
      { returnDocument: 'after' },
    )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')

  return { conversation: updated }
}

/**
 * Everything this reader has starred, newest first.
 *
 * Backed by `messages.starred_created`; without that index this is a scan of
 * every message the user can see, which is the whole collection on a busy
 * account.
 */
export async function listStarredMessages(
  db: Db,
  userId: string,
  limit: number,
): Promise<Message[]> {
  return db
    .collection<Message>(COLLECTIONS.messages)
    .find({ starredBy: userId, deletedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}

/**
 * Pin or archive a thread, for one participant only.
 *
 * Written as a dotted path into a map keyed by user id — the same shape
 * `unread` uses, and for the same reason: `participants` is already a multikey
 * field and MongoDB refuses to compound two arrays in one index, so an
 * `archivedBy: string[]` could never be part of the index the list rides.
 *
 * Un-setting rather than storing `false`, so "never archived" and "archived
 * then un-archived" are the same document and the list's `$ne: true` reads
 * both the same way.
 */
export async function setConversationFlag(
  db: Db,
  conversationId: string,
  userId: string,
  flag: 'pinnedBy' | 'archivedBy',
  on: boolean,
): Promise<ConversationView> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)
  // Mirrors how `messageId` is parsed above: a malformed id is a 404, not a
  // 500 from the ObjectId constructor.
  let _id: ObjectId
  try {
    _id = new ObjectId(conversationId)
  } catch {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')
  }
  await assertConversationAccess(db, conversationId, userId)

  if (on && flag === 'pinnedBy') {
    /*
     * The cap exists because pinned threads are fetched whole rather than
     * paginated. Counted rather than trusted: the client hides the action at
     * the limit, and the client is not what enforces it.
     */
    const pinned = await conversations.countDocuments({
      participants: userId,
      [`pinnedBy.${userId}`]: true,
    })
    if (pinned >= MAX_PINNED_CONVERSATIONS) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_FAILED,
        `You can pin at most ${MAX_PINNED_CONVERSATIONS} chats`,
      )
    }
  }

  const path = `${flag}.${userId}`
  const updated = await conversations.findOneAndUpdate(
    { _id },
    on ? { $set: { [path]: true } } : { $unset: { [path]: '' } },
    { returnDocument: 'after' },
  )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')
  return toConversationView(updated, userId)
}
