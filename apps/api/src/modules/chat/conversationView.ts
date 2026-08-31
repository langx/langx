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
  updatedAt: Date
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
    updatedAt: conversation.updatedAt,
  }
}
