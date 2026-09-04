import type { MessageMedia } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { pairKeyFor, type Conversation, type Message } from '../chat/conversations'
import type { LegacyProfile } from './legacyProfiles'

/**
 * One v1 chat thread, staged by the message ETL.
 *
 * Kept apart from `legacyProfiles` because it is consumed *pairwise*: a thread
 * cannot be imported when one of its two people comes back, only when the
 * second one does. So this record has to outlive any single restore, and the
 * thing that decides its fate is the pair, not the person.
 */
export interface LegacyRoom {
  /** The v1 room document id. */
  _id: string
  /** Both v1 (Appwrite) user ids. Multikey-indexed — this is the lookup. */
  participants: [string, string]
  counts: { text: number; image: number; audio: number }
  lastMessageAt?: Date
  migratedAt: Date
  /** Set once both sides were back and the thread was written into `conversations`. */
  importedAt?: Date
  importedConversationId?: string
}

/**
 * One v1 message. `media.url` already points into *our* bucket, not
 * Appwrite's: the ETL copies the bytes when it stages the row, because v1's
 * storage is being switched off and the ETL is the only moment those files can
 * still be read. Fetching them lazily at import time would work right up until
 * the day it silently didn't.
 */
export interface LegacyMessage {
  /** The v1 message document id, carried onto the imported message as `legacyId`. */
  _id: string
  roomId: string
  /** v1 (Appwrite) user id — mapped to a v2 id at import. */
  senderId: string
  type: 'text' | 'image' | 'audio'
  body: string
  media?: MessageMedia
  /** v1's own read flag. Mirrored rather than flattened — see `importRoom`. */
  seen: boolean
  createdAt: Date
}

export interface ImportSummary {
  /** Threads whose other side has not come back yet. Nothing was written. */
  waitingOnPeer: number
  conversationsImported: number
  messagesImported: number
}

const EMPTY: ImportSummary = { waitingOnPeer: 0, conversationsImported: 0, messagesImported: 0 }

/**
 * Brings back every v1 thread this user had **whose other participant has also
 * returned**, and only those.
 *
 * That condition is the whole design. A v1 conversation is two people's words,
 * and importing it because one of them came back would republish the other's
 * messages into an account they never opened. So the thread waits, possibly
 * forever, until both sides have a v2 account. Nothing here is a bulk one-off;
 * it is a per-pair event that happens whenever the second person returns.
 *
 * Called after every successful restore, from either side — whoever is second
 * finds the first already marked, so the ordering takes care of itself and no
 * separate "both are ready now" bookkeeping is needed.
 *
 * Historical by construction: no token is awarded, no quota consumed, no
 * streak advanced. These messages were already paid for in v1 (and converted
 * into the balance the restore credits); paying again would mint tokens from
 * the same work twice.
 */
export async function importLegacyConversations(
  db: Db,
  userId: string,
  legacyId: string,
): Promise<ImportSummary> {
  const rooms = await db
    .collection<LegacyRoom>(COLLECTIONS.legacyRooms)
    .find({ participants: legacyId, importedAt: { $exists: false } })
    .toArray()
  if (rooms.length === 0) return EMPTY

  const summary: ImportSummary = { ...EMPTY }

  for (const room of rooms) {
    const peerLegacyId = room.participants.find((id) => id !== legacyId)
    if (!peerLegacyId) continue

    const peer = await db
      .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
      .findOne({ _id: peerLegacyId })
    const peerUserId = peer?.restoredBy
    if (!peerUserId) {
      summary.waitingOnPeer++
      continue
    }
    if (peerUserId === userId) continue // a v1 note-to-self; there is no thread to build

    const imported = await importRoom(db, room, {
      [legacyId]: userId,
      [peerLegacyId]: peerUserId,
    })
    if (imported === null) continue

    summary.conversationsImported++
    summary.messagesImported += imported
  }

  return summary
}

/**
 * The backstop.
 *
 * The restore hook is the fast path — a returning user gets their threads in
 * the same request. But that hook deliberately swallows its errors so a
 * restore failure can never fail a sign-in, which means a thread lost to a
 * transient error there would otherwise never be looked at again: neither side
 * is going to restore a second time. This asks the same question on a timer,
 * so an import that failed once is retried rather than dropped, the same
 * self-healing shape as the pool and purge sweeps.
 *
 * `limit` bounds a tick; whatever is left is picked up by the next one.
 */
export async function sweepLegacyImports(
  db: Db,
  options: { limit?: number } = {},
): Promise<ImportSummary> {
  const rooms = await db
    .collection<LegacyRoom>(COLLECTIONS.legacyRooms)
    .find({ importedAt: { $exists: false } })
    .limit(options.limit ?? 200)
    .toArray()
  if (rooms.length === 0) return { ...EMPTY }

  const legacyIds = [...new Set(rooms.flatMap((room) => room.participants))]
  const restored = await db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .find({ _id: { $in: legacyIds }, restoredBy: { $exists: true } })
    .project<{ _id: string; restoredBy: string }>({ restoredBy: 1 })
    .toArray()
  const userIdByLegacyId = new Map(restored.map((row) => [row._id, row.restoredBy]))

  const summary: ImportSummary = { ...EMPTY }
  for (const room of rooms) {
    const [a, b] = room.participants
    const userA = userIdByLegacyId.get(a)
    const userB = userIdByLegacyId.get(b)
    if (!userA || !userB) {
      summary.waitingOnPeer++
      continue
    }
    if (userA === userB) continue

    const imported = await importRoom(db, room, { [a]: userA, [b]: userB })
    if (imported === null) continue
    summary.conversationsImported++
    summary.messagesImported += imported
  }

  return summary
}

/**
 * Writes one thread. Returns the number of messages inserted, or `null` if
 * there was nothing to write.
 *
 * Order matters and is the opposite of the intuitive one: **messages first,
 * then mark the room done.** Marking first would mean a crash halfway through
 * leaves a room flagged as imported with only part of its history in it, and
 * nothing would ever look at it again. This way a crash leaves the room
 * unclaimed, the next restore or the catch-up sweep replays it, and
 * `messages.legacy_id_unique` rejects everything already written — the same
 * "let the unique index decide" shape the token ledger uses.
 */
async function importRoom(
  db: Db,
  room: LegacyRoom,
  userIdByLegacyId: Record<string, string>,
): Promise<number | null> {
  const staged = await db
    .collection<LegacyMessage>(COLLECTIONS.legacyMessages)
    .find({ roomId: room._id })
    .sort({ createdAt: 1 })
    .toArray()
  if (staged.length === 0) {
    // An empty thread is still resolved, or it would be re-examined on every
    // future restore of either participant.
    await markImported(db, room._id, null)
    return null
  }

  const participants = Object.values(userIdByLegacyId).sort() as [string, string]
  const pairKey = pairKeyFor(participants[0], participants[1])

  const first = staged[0]!
  const last = staged.at(-1)!
  const firstMessageBy = userIdByLegacyId[first.senderId]
  if (!firstMessageBy) return null

  const unread: Record<string, number> = { [participants[0]]: 0, [participants[1]]: 0 }
  for (const message of staged) {
    if (message.seen) continue
    const recipient = participants.find((id) => id !== userIdByLegacyId[message.senderId])
    if (recipient) unread[recipient] = (unread[recipient] ?? 0) + 1
  }

  const senders = new Set(staged.map((message) => userIdByLegacyId[message.senderId]))
  // Per sender as well as in total, so a restored thread opens the media gate
  // for the side that has genuinely been written to.
  const messageCountBy: Record<string, number> = {}
  for (const message of staged) {
    const senderId = userIdByLegacyId[message.senderId]
    if (senderId) messageCountBy[senderId] = (messageCountBy[senderId] ?? 0) + 1
  }
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  const seed: Conversation = {
    _id: new ObjectId(),
    pairKey,
    participants,
    lastMessage: {
      body: last.body || previewFor(last.type),
      senderId: userIdByLegacyId[last.senderId] ?? firstMessageBy,
      createdAt: last.createdAt,
    },
    unread,
    firstMessageBy,
    firstMessageAt: first.createdAt,
    bothSpoke: senders.size > 1,
    // Imported history counts. A restored thread with two years of messages in
    // it is not a stranger's opening move, and the media gate reads this.
    messageCount: staged.length,
    messageCountBy,
    // The thread is as old as its first message. Dating it "now" would sort a
    // 2023 conversation above everything the user has actually been doing.
    createdAt: first.createdAt,
    updatedAt: last.createdAt,
  }

  const upsert = await conversations.updateOne(
    { pairKey },
    { $setOnInsert: seed },
    { upsert: true },
  )
  const conversationId = upsert.upsertedId ?? (await conversations.findOne({ pairKey }))?._id
  if (!conversationId) return null

  const documents: Message[] = staged.map((message) => {
    const senderId = userIdByLegacyId[message.senderId] ?? firstMessageBy
    const document: Message = {
      _id: new ObjectId(),
      conversationId,
      senderId,
      type: message.type,
      body: message.body,
      legacyId: message._id,
      createdAt: message.createdAt,
    }
    if (message.media) document.media = message.media
    // v1's read state is mirrored, not flattened to "all read". Someone who
    // left a message unanswered in v1 should find it still waiting — that is
    // a real thing they never saw, and marking the whole thread read to keep
    // the badge tidy would hide it for good. We do not know *when* it was
    // read, so the message's own timestamp stands in.
    if (message.seen) document.readAt = message.createdAt
    return document
  })

  const inserted = await insertIgnoringReplays(db, documents)

  if (!upsert.upsertedId) {
    // The two of them had already started talking in v2 before both restores
    // landed. Merge into that thread rather than refusing: the history still
    // belongs there, it just sorts underneath what they have said since.
    await mergeIntoExisting(db, pairKey, seed, unread)
  }

  await markImported(db, room._id, conversationId)
  return inserted
}

function previewFor(type: LegacyMessage['type']): string {
  if (type === 'image') return '📷 Photo'
  if (type === 'audio') return '🎤 Voice message'
  return ''
}

/**
 * `ordered: false` so one already-imported message does not abandon the rest
 * of the batch, and a duplicate-key error is the *expected* outcome of a
 * replay rather than a failure — it means that message is already there.
 */
async function insertIgnoringReplays(db: Db, documents: Message[]): Promise<number> {
  if (documents.length === 0) return 0
  try {
    const result = await db
      .collection<Message>(COLLECTIONS.messages)
      .insertMany(documents, { ordered: false })
    return result.insertedCount
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return (
        (error as MongoServerError & { result?: { insertedCount?: number } }).result
          ?.insertedCount ?? 0
      )
    }
    throw error
  }
}

/**
 * Folds an imported thread into a conversation that already existed.
 *
 * `firstMessageBy`/`firstMessageAt` move back to the v1 opening message
 * because that is when the conversation genuinely started. That pair also
 * backs the rolling-24h initiation quota, and moving it *backwards* can only
 * release a slot the user already spent — never take one.
 */
async function mergeIntoExisting(
  db: Db,
  pairKey: string,
  seed: Conversation,
  unread: Record<string, number>,
): Promise<void> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)
  const existing = await conversations.findOne({ pairKey })
  if (!existing) return

  const update: Record<string, unknown> = { bothSpoke: existing.bothSpoke || seed.bothSpoke }
  if (seed.firstMessageAt < existing.firstMessageAt) {
    update.firstMessageAt = seed.firstMessageAt
    update.firstMessageBy = seed.firstMessageBy
    update.createdAt = seed.createdAt
  }
  // Only if the imported tail really is newer, which it normally is not —
  // history sits underneath whatever they have said in v2 since.
  if (seed.lastMessage.createdAt > existing.lastMessage.createdAt) {
    update.lastMessage = seed.lastMessage
    update.updatedAt = seed.updatedAt
  }

  const increments: Record<string, number> = {}
  for (const [participantId, count] of Object.entries(unread)) {
    if (count > 0) increments[`unread.${participantId}`] = count
  }
  // The imported messages are additional to whatever the v2 thread already
  // holds, so this is an increment like `unread` and not a `$set` like the
  // rest. A conversation from before the counter existed stays absent here and
  // is counted on demand — see `messagesInThread`.
  if (seed.messageCount && typeof existing.messageCount === 'number') {
    increments.messageCount = seed.messageCount
  }
  if (seed.messageCountBy && existing.messageCountBy) {
    for (const [senderId, count] of Object.entries(seed.messageCountBy)) {
      if (count > 0) increments[`messageCountBy.${senderId}`] = count
    }
  }

  await conversations.updateOne(
    { pairKey },
    {
      $set: update,
      ...(Object.keys(increments).length > 0 ? { $inc: increments } : {}),
    },
  )
}

/** Conditional, like `markRestored`: whoever gets there first owns the room. */
async function markImported(
  db: Db,
  roomId: string,
  conversationId: ObjectId | null,
): Promise<void> {
  await db.collection<LegacyRoom>(COLLECTIONS.legacyRooms).updateOne(
    { _id: roomId, importedAt: { $exists: false } },
    {
      $set: {
        importedAt: new Date(),
        ...(conversationId ? { importedConversationId: conversationId.toHexString() } : {}),
      },
    },
  )
}
