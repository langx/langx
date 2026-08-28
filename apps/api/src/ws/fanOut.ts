import type { FastifyInstance } from 'fastify'
import type { ObjectId } from 'mongodb'
import { markDelivered } from '../modules/chat/messages'
import { sendPush, tokensFor } from '../modules/push/devices'
import { userRoom, type AppServer } from './types'

/** The parts of a conversation this needs; `Conversation` itself carries far more. */
interface FannedConversation {
  _id: ObjectId
  participants: readonly string[]
}

interface FannedMessage {
  senderId: string
  body: string
  conversationId: { toHexString: () => string }
}

/**
 * Everything that happens to a message once it is durably written: both
 * participants see it arrive, the sender's ticks advance, and the recipient's
 * phone buzzes if they were not there to receive it.
 *
 * One function because these three are a single sequence, not three
 * independent effects — the same reason `recordMessage` exists on the write
 * side. When they were separate, `POST /conversations` did none of them: the
 * first message of a thread was written and then simply sat there, invisible
 * until something else happened to refetch. Anything that creates a message
 * calls this, so a new message path cannot quietly ship without realtime again.
 *
 * Best-effort throughout: a failed emit, stamp or push must never fail a send
 * that has already been committed.
 *
 * `pushWhenAway` is false for corrections, which have never notified.
 */
export async function fanOutMessage(
  app: FastifyInstance,
  io: AppServer,
  conversation: FannedConversation,
  message: FannedMessage,
  { pushWhenAway }: { pushWhenAway: boolean },
): Promise<void> {
  try {
    for (const participantId of conversation.participants) {
      io.to(userRoom(participantId)).emit('message:new', message)
    }

    const recipientId = conversation.participants.find((id) => id !== message.senderId)
    if (!recipientId) return

    // Asked once and branched on, rather than asked again per effect: someone
    // holding a socket has just received the emit above and needs no
    // notification, someone away has nothing to deliver to. Two lookups would
    // only create room for the answer to change in between.
    const sockets = await io.in(userRoom(recipientId)).fetchSockets()
    if (sockets.length > 0) {
      const deliveredAt = await markDelivered(app.mongo.db, conversation._id, recipientId)
      if (deliveredAt) {
        io.to(userRoom(message.senderId)).emit('conversation:delivered', {
          conversationId: message.conversationId.toHexString(),
          deliveredTo: recipientId,
          deliveredAt: deliveredAt.toISOString(),
        })
      }
      return
    }
    if (!pushWhenAway) return

    const [sender, tokens] = await Promise.all([
      app.mongo.db
        .collection<{ displayName?: string; handle: string }>('profiles')
        .findOne({ _id: message.senderId as unknown as never }),
      tokensFor(app.mongo.db, recipientId),
    ])
    if (tokens.length === 0) return

    await sendPush(app.mongo.db, app.push, {
      to: tokens,
      title: sender?.displayName ?? sender?.handle ?? 'LangX',
      body: message.body.slice(0, 120),
      data: { kind: 'message', conversationId: message.conversationId.toHexString() },
    })
  } catch (error) {
    app.log.warn({ err: error }, 'post-send fan-out failed')
  }
}
