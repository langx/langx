import {
  ERROR_CODES,
  type MessageMedia,
  type MessageType,
  type StartConversationInput,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import { awardForSend } from '../tokens/awards'

export interface Conversation {
  _id: ObjectId
  pairKey: string
  participants: [string, string]
  lastMessage: { body: string; senderId: string; createdAt: Date; deleted?: boolean }
  unread: Record<string, number>
  /**
   * Per-user, and a **map keyed by user id** rather than an array of ids.
   *
   * `participants` is already a multikey field, and MongoDB refuses to compound
   * two array fields in one index — so `{ participants: 1, archivedBy: 1 }`
   * cannot exist. A map's dotted path (`archivedBy.<uid>`) is a scalar and can,
   * which is the same reason `unread` above is shaped this way.
   *
   * Not to be confused with `pinned` below, which is a pinned *message* and is
   * shared by both sides.
   */
  pinnedBy?: Record<string, true>
  archivedBy?: Record<string, true>
  /**
   * "I deleted this chat." A map for the same reason the two above are, and
   * per-user because a thread is half of somebody else's: their copy, and
   * every message in it, is untouched.
   *
   * Cleared when the next message arrives, so the thread comes back — empty on
   * this side, because the messages it used to hold are in their `hiddenFor`.
   */
  deletedBy?: Record<string, true>
  /** One per conversation, replaced rather than appended — see `MAX_PINNED_PER_CONVERSATION`. */
  pinned?: { messageId: ObjectId; byUserId: string; at: Date }
  firstMessageBy: string
  firstMessageAt: Date
  bothSpoke: boolean
  /**
   * Messages in this thread, both sides together. Denormalized because the
   * media gate reads it on a path that must not pay for a `countDocuments` —
   * and it costs nothing to keep, since `recordMessage` already issues a
   * `findOneAndUpdate` on this document for `lastMessage` and `unread`.
   *
   * Optional, and the absence means something specific: the conversation
   * predates the counter. Those threads are the ones with history, so
   * `messagesInThread` counts them rather than treating a missing field as
   * zero and locking a two-year-old conversation out of sending a photo. The
   * cost decays to nothing as old threads get their next message.
   */
  messageCount?: number
  /**
   * The same count split by sender, keyed by user id. The media gate reads
   * the *other* participant's entry — how many messages you have received —
   * because a shared total let one person clear a gate meant to need two.
   *
   * Optional for the same reason as `messageCount`, and absent means the same
   * thing: written before the map existed. `messagesReceivedFrom` counts on
   * demand for those; it never reads absence as zero.
   */
  messageCountBy?: Record<string, number>
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  _id: ObjectId
  conversationId: ObjectId
  senderId: string
  type: MessageType
  /** Caption for an attachment, the whole message for text, the fix for a correction. */
  body: string
  /**
   * A snapshot of the message this one answers, not a live join.
   *
   * Same shape and same reason as `correction.original`: the target can be
   * deleted, and a quote that empties itself would rewrite what the
   * conversation looks like it said. `messageId` is kept so tapping the quote
   * can still jump, and that jump is allowed to find nothing.
   */
  replyTo?: {
    messageId: ObjectId
    senderId: string
    preview: string
  }
  correction?: { targetMessageId: ObjectId; original: string; corrected: string; note?: string }
  /**
   * Everything attached to this message, in the order it was picked.
   *
   * Read through `attachmentsOf`, never directly: a v1-imported message and
   * anything sent by an installed binary has `media` and no `attachments`, and
   * the two must look the same to everything downstream.
   */
  attachments?: MessageMedia[]
  /** The first of `attachments`, repeated for builds that predate the list. */
  media?: MessageMedia
  /**
   * The v1 message id this was imported from — absent on everything sent in
   * v2. Carried so `messages.legacy_id_unique` can refuse a second import of
   * the same message, which is what lets the importer be replayed safely.
   */
  /**
   * Emoji → the users who chose it. A dot path (`reactions.👍`) is safe here
   * only because the keys come from `MESSAGE_REACTIONS`; an open set would let
   * a `.` or `$` in a key rewrite the document.
   */
  reactions?: Record<string, string[]>
  /**
   * "Delete for me": the row stays, because it is half of someone else's
   * thread, but it is projected away for these users.
   */
  hiddenFor?: string[]
  /** "Delete for everyone": a tombstone, not a removal. */
  deletedAt?: Date
  deletedBy?: string
  /** Private to each user — projected away, never shipped as a list. */
  /**
   * The client's id for the attempt that created this message, when it sent
   * one. Only ever read to refuse a duplicate — see `sender_client_id_unique`.
   */
  clientId?: string
  starredBy?: string[]
  editedAt?: Date
  /**
   * Stamped when someone writes a correction of this message.
   *
   * Kept on the target rather than derived, so the edit rule is a field read
   * instead of a query: `sendCorrection` already loads this document, so the
   * stamp is free where a lookup would not be.
   */
  correctedAt?: Date
  legacyId?: string
  /**
   * When the message reached the recipient's device — the second tick. Set by
   * `markDelivered` either as the message goes out over an open socket, or on
   * the sweep that runs when the recipient next connects. Absent on everything
   * that predates the feature, which is why `deliveryStateOf` treats `readAt`
   * as proof of delivery rather than requiring both.
   */
  deliveredAt?: Date
  readAt?: Date
  createdAt: Date
  /** Set when the sender's account was purged; the body is cleared, the row stays. */
  deletedWithAccount?: boolean
}

export interface StartResult {
  conversation: Conversation
  message: Message
}

/** `<minId>_<maxId>` — the same two people can never open a second conversation. */
export function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join('_')
}

function isDuplicateKeyError(error: unknown, indexName: string): boolean {
  return (
    error instanceof MongoServerError && error.code === 11000 && error.message.includes(indexName)
  )
}

/**
 * There's no match gate, so "start a conversation" and "send its first
 * message" are one request (see conversations.pairKey's unique index — the
 * thing that used to be `matches.pairKey`'s job). Quota is charged here
 * because this is, by construction, always the first message the caller has
 * ever sent this recipient — replying to an existing conversation is a
 * different, quota-free endpoint (Faz 5).
 */
/**
 * The conversation these two already have, if any.
 *
 * Read by the profile screen, which otherwise offers a "send a message" box to
 * somebody you are already talking to — and sending from it fails, because
 * `startConversation` refuses a second one. The answer belongs to the viewer,
 * so it is computed per request rather than stored on either profile.
 */
export async function findConversationBetween(
  db: Db,
  viewerId: string,
  otherId: string,
): Promise<Conversation | null> {
  return db
    .collection<Conversation>(COLLECTIONS.conversations)
    .findOne({ pairKey: pairKeyFor(viewerId, otherId) })
}

export async function startConversation(
  db: Db,
  viewerId: string,
  input: StartConversationInput,
): Promise<StartResult> {
  if (input.toUserId === viewerId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Cannot start a conversation with yourself')
  }

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const [viewer, recipient] = await Promise.all([
    profiles.findOne({ _id: viewerId }),
    profiles.findOne({ _id: input.toUserId }),
  ])
  if (!viewer) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  if (!recipient) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Recipient not found')

  const blocks = db.collection<{ blockerId: string; blockedId: string }>(COLLECTIONS.blocks)
  const blocked = await blocks.findOne({
    $or: [
      { blockerId: viewerId, blockedId: input.toUserId },
      { blockerId: input.toUserId, blockedId: viewerId },
    ],
  })
  if (blocked) throw new ApiError(ERROR_CODES.BLOCKED, 'Cannot message a blocked user')

  const pairKey = pairKeyFor(viewerId, input.toUserId)
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  // Cheap pre-check so a client retrying against an existing conversation
  // (the common case) never costs a quota slot — the unique index below is
  // what still catches the genuine race (both sides messaging at once).
  const existing = await conversations.findOne({ pairKey })
  if (existing) {
    throw new ApiError(
      ERROR_CODES.CONVERSATION_EXISTS,
      'A conversation with this user already exists',
    )
  }

  const quota = await consumeQuota(db, viewerId, effectiveTier(viewer), 'initiations')
  if (!quota.consumed) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      'Daily new-conversation limit reached',
      quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
    )
  }

  const now = new Date()
  const conversation: Conversation = {
    _id: new ObjectId(),
    pairKey,
    participants: [viewerId, recipient._id],
    lastMessage: { body: input.body, senderId: viewerId, createdAt: now },
    /**
     * The recipient's id is read off the profile that was just loaded, not off
     * the request that named it — even though the two are equal by the time
     * execution reaches here, since `findOne` above threw NOT_FOUND otherwise.
     *
     * It matters because this one is used as a *property name*, and a property
     * name whose provenance is a request body is a shape worth not having:
     * proving it safe means re-reading forty lines up every time, and it is
     * what CodeQL's `js/remote-property-injection` flags (alert 12). Taking it
     * from the record removes the question rather than answering it.
     */
    unread: { [viewerId]: 0, [recipient._id]: 1 },
    firstMessageBy: viewerId,
    firstMessageAt: now,
    bothSpoke: false,
    // One, because this call writes the opening message itself rather than
    // going through `recordMessage`. Set here so no conversation created from
    // now on can have an absent count — which is what lets `messagesInThread`
    // read an absent one as "predates the counter" instead of as zero.
    messageCount: 1,
    // Built off the participants pair rather than with `viewerId` as a
    // literal key, for the same reason `unread` reads the recipient off the
    // record: a property name whose provenance is a request is the shape
    // CodeQL's `js/remote-property-injection` flags, and the pair is the
    // record's own.
    messageCountBy: Object.fromEntries(
      [viewerId, recipient._id].map((id) => [id, id === viewerId ? 1 : 0]),
    ),
    createdAt: now,
    updatedAt: now,
  }

  try {
    await conversations.insertOne(conversation)
  } catch (error) {
    if (isDuplicateKeyError(error, 'pair_key_unique')) {
      // The quota slot consumed above is not refunded here — the plan
      // accepts this as the rare cost of the true concurrent-race case
      // (both sides messaging each other at the same instant), rather than
      // adding a second round-trip to every request to guard against it.
      throw new ApiError(
        ERROR_CODES.CONVERSATION_EXISTS,
        'A conversation with this user already exists',
      )
    }
    throw error
  }

  const message: Message = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId: viewerId,
    type: 'text',
    body: input.body,
    createdAt: now,
  }
  await db.collection<Message>(COLLECTIONS.messages).insertOne(message)

  // This path writes its own message rather than going through
  // `recordMessage`, so it has to pay out itself. `becameMutual` is always
  // false here by construction — only one side has spoken.
  await awardForSend(db, { conversation, message, becameMutual: false })

  // The message comes back as well as the conversation because the caller has
  // to fan it out, and it is the only thing that holds it: this path does not
  // go through `recordMessage`, so nothing else ever sees the first message of
  // a thread. Returning just the conversation is what let it go unannounced.
  return { conversation, message }
}
