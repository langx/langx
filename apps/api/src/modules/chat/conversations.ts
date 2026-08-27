import { ERROR_CODES, type StartConversationInput } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'

export interface Conversation {
  _id: ObjectId
  pairKey: string
  participants: [string, string]
  lastMessage: { body: string; senderId: string; createdAt: Date }
  unread: Record<string, number>
  firstMessageBy: string
  firstMessageAt: Date
  bothSpoke: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  _id: ObjectId
  conversationId: ObjectId
  senderId: string
  type: 'text' | 'correction'
  body: string
  correction?: { targetMessageId: ObjectId; original: string; corrected: string; note?: string }
  readAt?: Date
  createdAt: Date
}

/** `<minId>_<maxId>` — the same two people can never open a second conversation. */
function pairKeyFor(a: string, b: string): string {
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
export async function startConversation(
  db: Db,
  viewerId: string,
  input: StartConversationInput,
): Promise<Conversation> {
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
    participants: [viewerId, input.toUserId],
    lastMessage: { body: input.body, senderId: viewerId, createdAt: now },
    unread: { [viewerId]: 0, [input.toUserId]: 1 },
    firstMessageBy: viewerId,
    firstMessageAt: now,
    bothSpoke: false,
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

  await db.collection<Message>(COLLECTIONS.messages).insertOne({
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId: viewerId,
    type: 'text',
    body: input.body,
    createdAt: now,
  })

  return conversation
}
