import type { MessageType } from '@langx/shared'
import type { Message } from './conversations'

/**
 * A message as one particular person is allowed to see it.
 *
 * `listMessages` used to return raw documents, which was fine while every
 * field on a message was mutual. It stops being fine the moment per-user state
 * lands on the same document: `hiddenFor` says who has hidden it and
 * `starredBy` will say who starred it, and shipping either one raw tells the
 * other person things they have no business knowing. One projection, applied
 * everywhere a message leaves the server, is the only way that stays true as
 * fields keep being added.
 *
 * It is also where the tombstone is enforced. A deleted message keeps its row
 * — it is half of someone else's thread and the timeline would otherwise close
 * over the gap — so the emptying has to happen on the way out rather than in
 * the database, where a later reader could still find the body.
 */
export interface MessageView {
  _id: string
  conversationId: string
  senderId: string
  type: MessageType
  body: string
  media?: Message['media']
  correction?: {
    targetMessageId: string
    original: string
    corrected: string
    note?: string
  }
  replyTo?: { messageId: string; senderId: string; preview: string }
  /** Mutual by design: a reaction is meant to be seen. */
  reactions?: Record<string, string[]>
  /** Which one is the viewer's own, so the strip can show it selected. */
  myReaction?: string
  deleted?: boolean
  /** The viewer deleted it for themselves; the client drops the row. */
  hidden?: boolean
  /** The viewer starred it. Who else did is nobody's business. */
  starred?: boolean
  editedAt?: string
  /** Someone has corrected this sentence, so it can no longer be edited. */
  corrected?: boolean
  deliveredAt?: string
  readAt?: string
  createdAt: string
  /**
   * Echoed back only to the sender, so a client holding a "not sent" row can
   * retire it when the message it gave up on turns out to have arrived. Nobody
   * else's client has any use for it.
   */
  clientId?: string
}

export function toMessageView(message: Message, viewerId: string): MessageView {
  const deleted = Boolean(message.deletedAt)
  const hidden = Boolean(message.hiddenFor?.includes(viewerId))
  const myReaction = Object.entries(message.reactions ?? {}).find(([, users]) =>
    users.includes(viewerId),
  )?.[0]

  const view: MessageView = {
    _id: message._id.toHexString(),
    conversationId: message.conversationId.toHexString(),
    senderId: message.senderId,
    type: message.type,
    // A tombstone carries no body, no attachment and no correction. The client
    // draws "This message was deleted" from the flag alone.
    body: deleted ? '' : message.body,
    createdAt: message.createdAt.toISOString(),
  }

  if (deleted) view.deleted = true
  if (hidden) view.hidden = true
  if (message.starredBy?.includes(viewerId)) view.starred = true
  // Only to its author: it is their retry key, and it says nothing to anyone
  // else. `toMessageView` builds by naming fields, so this is the only way in.
  if (message.clientId && message.senderId === viewerId) view.clientId = message.clientId
  if (!deleted && message.editedAt) view.editedAt = message.editedAt.toISOString()
  if (!deleted && message.correctedAt) view.corrected = true
  if (!deleted && message.media) view.media = message.media
  if (!deleted && message.correction) {
    view.correction = {
      targetMessageId: message.correction.targetMessageId.toHexString(),
      original: message.correction.original,
      corrected: message.correction.corrected,
      ...(message.correction.note !== undefined ? { note: message.correction.note } : {}),
    }
  }
  // The quote survives the deletion of *this* message's target, and of this
  // message itself only insofar as the tombstone keeps nothing.
  if (!deleted && message.replyTo) {
    view.replyTo = {
      messageId: message.replyTo.messageId.toHexString(),
      senderId: message.replyTo.senderId,
      preview: message.replyTo.preview,
    }
  }
  // `$pull` leaves the key behind with an empty array; an emoji nobody has
  // chosen is not a reaction, and shipping it would draw an empty badge.
  const reactions = Object.fromEntries(
    Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0),
  )
  if (!deleted && Object.keys(reactions).length > 0) view.reactions = reactions
  if (!deleted && myReaction) view.myReaction = myReaction
  if (message.deliveredAt) view.deliveredAt = message.deliveredAt.toISOString()
  if (message.readAt) view.readAt = message.readAt.toISOString()

  return view
}
