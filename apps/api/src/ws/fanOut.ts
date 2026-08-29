import type { FastifyInstance } from 'fastify'
import type { ObjectId } from 'mongodb'
import type { Message } from '../modules/chat/conversations'
import { toMessageView } from '../modules/chat/messageView'
import { markDelivered } from '../modules/chat/messages'
import { sendPush, tokensFor } from '../modules/push/devices'
import { userRoom, type AppServer } from './types'

/** The parts of a conversation this needs; `Conversation` itself carries far more. */
interface FannedConversation {
  _id: ObjectId
  participants: readonly string[]
}

/**
 * The whole document, because the emit is now a per-viewer projection rather
 * than the raw row — see `toMessageView`. Narrowing this to the three fields
 * the push notification needs is what let per-user state reach the wire.
 */
type FannedMessage = Message

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
    // Projected per participant: two people are sent two different objects
    // from the same row, because what each is allowed to see differs.
    for (const participantId of conversation.participants) {
      io.to(userRoom(participantId)).emit('message:new', toMessageView(message, participantId))
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

/**
 * A message that already exists has changed.
 *
 * One event for every mutation — reaction, withdrawal, and later edit, star and
 * pin — carrying the message's whole new state rather than a description of
 * what changed. A client that applies "the message is now this" cannot drift;
 * one that applies a patch has to be right about the order they arrive in.
 *
 * Withdrawal is not a separate event either: a deleted message is a
 * `message:updated` whose body the projection has emptied.
 *
 * Synchronous and silent — no delivery stamping, no push. Nothing about a
 * reaction is worth waking a phone for.
 */
export function fanOutMessageUpdate(
  io: AppServer,
  conversation: FannedConversation,
  message: Message,
  audience: 'both' | 'actor',
  actorId: string,
): void {
  // `actor` is per-user state — a hide, or later a star. It goes to the
  // actor's own room only, so their other devices converge and the other
  // person is told nothing whatsoever.
  const recipients = audience === 'actor' ? [actorId] : conversation.participants

  for (const participantId of recipients) {
    io.to(userRoom(participantId)).emit('message:updated', toMessageView(message, participantId))
  }
}
