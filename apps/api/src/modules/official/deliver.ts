import { MongoServerError, ObjectId, type Db } from 'mongodb'
import type { OfficialHandle } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import {
  findConversationBetween,
  pairKeyFor,
  type Conversation,
  type Message,
} from '../chat/conversations'
import { recordMessage } from '../chat/messages'
import { officialIds } from './accounts'

export interface OfficialDelivery {
  conversation: Conversation
  message: Message
}

export interface DeliverInput {
  fromHandle: OfficialHandle
  toUserId: string
  body: string
  /**
   * What makes a send safe to repeat. `messages.sender_client_id_unique` is a
   * real unique index, so a second write with the same id is refused by the
   * database rather than by a prior read — which is the only version that
   * holds when two boots, or a half-finished announcement and its re-run,
   * race each other.
   *
   * That is the whole idempotency story: no "already sent" flag, no second
   * collection to keep in step.
   */
  clientId?: string
}

/**
 * A message from an account nobody is signed in to.
 *
 * Deliberately not `startConversation` + `sendTextMessage`: those two are the
 * *user's* path and carry a user's rules — quota, the block check, a refusal
 * to open a second thread. None of them mean anything for a sender that is a
 * program. What this shares with them is the part that must not diverge, the
 * write itself, which is `recordMessage`.
 *
 * Returns `null` when the account does not exist, which happens when a real
 * user holds the handle. Nothing that calls this is important enough to fail
 * an onboarding or a script over.
 */
export async function deliverOfficialMessage(
  db: Db,
  input: DeliverInput,
): Promise<OfficialDelivery | null> {
  const senderId = officialIds().get(input.fromHandle)
  if (!senderId) return null
  if (senderId === input.toUserId) return null

  const messages = db.collection<Message>(COLLECTIONS.messages)
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  if (input.clientId) {
    const already = await messages.findOne({ senderId, clientId: input.clientId })
    if (already) {
      const conversation = await conversations.findOne({ _id: already.conversationId })
      return conversation ? { conversation, message: already } : null
    }
  }

  const now = new Date()
  const message: Message = {
    _id: new ObjectId(),
    conversationId: new ObjectId(),
    senderId,
    type: 'text',
    body: input.body,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    createdAt: now,
  }

  let conversation = await findConversationBetween(db, senderId, input.toUserId)
  if (!conversation) {
    // The counters start at zero and `recordMessage` moves them, unlike
    // `startConversation`, which writes its opening message inline because it
    // also has to charge quota. There is no quota here, so there is no reason
    // to duplicate the arithmetic.
    const fresh: Conversation = {
      _id: new ObjectId(),
      pairKey: pairKeyFor(senderId, input.toUserId),
      participants: [senderId, input.toUserId],
      lastMessage: { body: input.body, senderId, createdAt: now },
      unread: { [senderId]: 0, [input.toUserId]: 0 },
      firstMessageBy: senderId,
      firstMessageAt: now,
      bothSpoke: false,
      messageCount: 0,
      messageCountBy: { [senderId]: 0, [input.toUserId]: 0 },
      createdAt: now,
      updatedAt: now,
    }
    try {
      await conversations.insertOne(fresh)
      conversation = fresh
    } catch (error) {
      // `pair_key_unique`: the person wrote to the assistant at the same
      // moment it wrote to them. Their conversation stands and this message
      // joins it.
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error
      conversation = await findConversationBetween(db, senderId, input.toUserId)
      if (!conversation) throw error
    }
  }

  message.conversationId = conversation._id
  try {
    const updated = await recordMessage(db, conversation, message)
    return { conversation: updated, message }
  } catch (error) {
    // The clientId index caught a repeat that the read above missed, which is
    // exactly what it is for. Whatever is already there is the answer.
    if (error instanceof MongoServerError && error.code === 11000 && input.clientId) {
      const already = await messages.findOne({ senderId, clientId: input.clientId })
      const current = await conversations.findOne({ _id: conversation._id })
      if (already && current) return { conversation: current, message: already }
    }
    throw error
  }
}
