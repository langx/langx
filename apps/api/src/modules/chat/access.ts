import { ERROR_CODES, MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { isSuspended } from '../moderation/suspension'
import { isOfficialId } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
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
  /*
   * A call's row is not a message they sent. It carries the caller as its
   * `senderId`, and counting it would let somebody unlock photos — and calls
   * themselves — by ringing a thread that predates the map: five unanswered
   * calls would read as five messages received by the person who ignored
   * them. The map never has this problem, because `recordCallLog` does not
   * increment it.
   */
  return db
    .collection<Message>(COLLECTIONS.messages)
    .countDocuments({ conversationId: conversation._id, senderId: other, type: { $ne: 'call' } })
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

/**
 * Refuses a message to somebody who cannot read it: an account that was
 * deleted, then one that is suspended.
 *
 * A suspended account cannot sign in to read what arrives, and the person
 * writing is owed that answer rather than a thread that looks alive and never
 * replies. A deleted one is the same and asked first — `deletedAt` wins over
 * a suspension, as it does in `accountStatus`. Its sessions were destroyed
 * when it was written, and a purged account, whose profile is gone and whose
 * threads are left behind, is the same answer a month later. The deleted half
 * used to be missing, and a message to somebody who had left showed "Sent"
 * and never an answer.
 *
 * Not part of `assertConversationAccess`, which reads as well as writes: the
 * history stays readable, only the next message is refused. The suspended
 * side needs no check of its own — `requireAuth` and the socket handshake
 * already refuse everything it asks.
 *
 * `recordMessage` asks on every send, so nothing gets past it. The media
 * paths ask again *before* the bytes: the upload URL, and the unit and the
 * upload claim in `message:media` — a refusal after the claim left the file in
 * the bucket with nothing left to name it or sweep it.
 *
 * Our own accounts are exempt. A receipt or a note from @langx is not what a
 * suspension protects anybody from, and the panel's one message to a person
 * is how somebody we suspended can be told something before a lift.
 */
export async function assertRecipientReachable(
  db: Db,
  conversation: Conversation,
  senderId: string,
): Promise<void> {
  if (isOfficialId(senderId)) return
  const recipientId = conversation.participants.find((id) => id !== senderId)
  if (recipientId === undefined) return
  // One keyed read, projected to the two fields: unlike `acceptsMessages`,
  // both are decided while the recipient's thread is open.
  const recipient = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: recipientId }, { projection: { suspension: 1, deletedAt: 1 } })
  if (!recipient || recipient.deletedAt) {
    throw new ApiError(ERROR_CODES.RECIPIENT_DELETED, 'This account was deleted')
  }
  if (isSuspended(recipient)) {
    throw new ApiError(ERROR_CODES.RECIPIENT_SUSPENDED, 'This account is suspended')
  }
}
