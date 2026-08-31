import { MEDIA_UNLOCKS_AFTER_MESSAGES } from '@langx/shared'
import type { Conversation } from './conversations'

/**
 * What one participant is allowed to see of a conversation.
 *
 * `listConversations` used to return raw documents, which was fine while every
 * field on one was mutual — and stopped being fine the moment per-user state
 * landed on the same document. `unread` has always been a map keyed by user
 * id, so the list already shipped **the other person's unread count** to both
 * sides; `pinnedBy` and `archivedBy` would have shipped "they archived you",
 * which is worse.
 *
 * The same reasoning `messageView.ts` records for messages, applied one level
 * up: one projection, at the single point a conversation leaves the server, is
 * the only thing that stays true as fields keep being added.
 */
export interface ConversationView {
  _id: string
  participants: [string, string]
  lastMessage: { body: string; senderId: string; createdAt: Date; deleted?: boolean }
  /** This viewer's count, as a number — never the map it is stored in. */
  unread: number
  pinned: boolean
  archived: boolean
  /** They spoke last, so the next move is the viewer's. */
  unreplied: boolean
  bothSpoke: boolean
  /**
   * How many more messages before a photo or a voice note can be sent, or 0
   * once they can. A number rather than a boolean so the composer can say
   * *how many*, which is the difference between a rule and a broken button.
   */
  mediaLockedFor: number
  updatedAt: Date
}

/**
 * How many more messages before an attachment is allowed, or 0.
 *
 * One function, read by both projections. An absent `messageCount` means the
 * conversation predates the counter, never that it is empty — see
 * `messagesInThread`, which is the server's own reading of the same field.
 * Those threads have history, so the composer is unlocked rather than showing
 * a countdown that would be wrong; signing an upload URL still checks properly.
 */
export function mediaLockedFor(conversation: Conversation): number {
  const sent = conversation.messageCount ?? MEDIA_UNLOCKS_AFTER_MESSAGES
  return Math.max(0, MEDIA_UNLOCKS_AFTER_MESSAGES - sent)
}

export function toConversationView(conversation: Conversation, viewerId: string): ConversationView {
  return {
    _id: conversation._id.toHexString(),
    participants: conversation.participants,
    lastMessage: conversation.lastMessage,
    unread: conversation.unread?.[viewerId] ?? 0,
    pinned: conversation.pinnedBy?.[viewerId] === true,
    archived: conversation.archivedBy?.[viewerId] === true,
    /*
     * Read off `lastMessage.senderId`, not off the unread count. Opening a
     * thread clears the unread without answering it, so the two disagree
     * exactly for the threads somebody read and meant to come back to — which
     * are the ones this is for.
     */
    unreplied: conversation.lastMessage.senderId !== viewerId,
    bothSpoke: conversation.bothSpoke,
    mediaLockedFor: mediaLockedFor(conversation),
    updatedAt: conversation.updatedAt,
  }
}
