import {
  WATCH_MAX_CONVERSATIONS,
  WATCH_MAX_MESSAGES_PER_CONVERSATION,
  WATCH_PAYLOAD_VERSION,
  type WatchConversation,
  type WatchPayload,
} from '@langx/shared'

/**
 * What the app already holds, in the shape its own queries hand it over —
 * the same idea as `CompanionSources`, and for the same reason: the call site
 * passes what it has, and the compiler notices when one of those shapes
 * changes underneath us.
 */
export interface WatchSources {
  /** The signed-in account, to decide whose side of a thread a message is on. */
  meId: string
  /** `GET /conversations`, already filtered to the unread ones by the caller. */
  conversations: {
    _id: string
    participants: readonly string[]
    unread: number
    lastMessage: { body: string; senderId: string; createdAt: Date | string }
    updatedAt: Date | string
  }[]
  /** Partner id → display name, from the same profile cache the chat list uses. */
  names: Record<string, string | undefined>
  /**
   * Whatever of each thread is *already cached*, newest last. Optional per
   * conversation and allowed to be missing entirely.
   *
   * The watch never causes a fetch. That is the same rule the widgets follow
   * and it is load-bearing here for a different reason: this payload is
   * rebuilt whenever the unread list changes, and a version that filled in
   * the missing threads would turn every arriving message into ten requests
   * on a phone that may be on cellular in somebody's pocket. So the thread
   * screen shows what the phone happened to know, which for an unread
   * conversation is always at least the message that made it unread.
   */
  threads?: Record<
    string,
    { _id: string; body: string; senderId: string; createdAt: Date | string }[]
  >
}

function iso(at: Date | string): string {
  return typeof at === 'string' ? new Date(at).toISOString() : at.toISOString()
}

/**
 * Assemble what the phone sends the watch. Pure: the caller transmits it.
 *
 * Ordering is the conversation list's own — most recently updated first —
 * rather than by unread count. A wrist is glanced at, and the question it
 * answers is "what just happened", not "who owes me the most".
 *
 * A conversation whose partner is not in the name cache is **dropped, not
 * labelled**. An unnamed row on a watch is a row nobody can act on, and the
 * cache is populated from the same list this is built from, so a miss means
 * the profile request has not landed yet — one more payload arrives a moment
 * later with the name in it.
 */
export function buildWatchPayload(sources: WatchSources, now: Date = new Date()): WatchPayload {
  const conversations: WatchConversation[] = []

  for (const conversation of sources.conversations) {
    if (conversations.length >= WATCH_MAX_CONVERSATIONS) break

    const partnerId = conversation.participants.find((p) => p !== sources.meId)
    const name = partnerId === undefined ? undefined : sources.names[partnerId]
    if (name === undefined || name.length === 0) continue

    const cached = sources.threads?.[conversation._id]
    /*
     * The thread if we have one, the list's own last message if we do not.
     * Never both — the last message is already the tail of the thread, and a
     * watch showing it twice looks like the other person repeated themselves.
     */
    const source =
      cached !== undefined && cached.length > 0
        ? cached
        : [
            {
              _id: `${conversation._id}:last`,
              body: conversation.lastMessage.body,
              senderId: conversation.lastMessage.senderId,
              createdAt: conversation.lastMessage.createdAt,
            },
          ]

    conversations.push({
      id: conversation._id,
      name,
      unread: conversation.unread,
      messages: source.slice(-WATCH_MAX_MESSAGES_PER_CONVERSATION).map((message) => ({
        id: message._id,
        body: message.body,
        mine: message.senderId === sources.meId,
        at: iso(message.createdAt),
      })),
    })
  }

  return {
    version: WATCH_PAYLOAD_VERSION,
    writtenAt: now.toISOString(),
    conversations,
  }
}
