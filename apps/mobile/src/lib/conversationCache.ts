import type { InfiniteData } from '@tanstack/react-query'
import type { ConversationDto } from '../api/queries'

export interface ConversationPageDto {
  items: ConversationDto[]
  /** Never paginated — the whole set, on every page. */
  pinned: ConversationDto[]
  nextCursor: string | null
}

type Pages = InfiniteData<ConversationPageDto> | undefined

/**
 * Socket events patched into the paged chat list instead of invalidating it.
 *
 * On an infinite query `invalidateQueries` refetches **every loaded page**,
 * sequentially. The chat list used to do that on every `message:new`, which
 * was one request while there was one page and is ten once someone has
 * scrolled. These return `undefined` when the conversation is not in any
 * loaded page, so the caller can fall back to invalidating — a conversation
 * that has scrolled off is not one this can patch.
 */
export function applyIncomingMessage(
  data: Pages,
  input: {
    conversationId: string
    body: string
    senderId: string
    createdAt: string
    /** Whose unread count to bump — the signed-in user. */
    forUserId: string
  },
): Pages {
  if (!isPagedList(data)) return data
  const found = findConversation(data, input.conversationId)
  if (!found) return undefined

  const patched: ConversationDto = {
    ...found.conversation,
    lastMessage: {
      body: input.body,
      senderId: input.senderId,
      createdAt: input.createdAt,
    },
    // A number now, not the map it is stored in — `toConversationView`
    // resolves it server-side, so the other person's count never arrives here.
    unread:
      input.senderId === input.forUserId
        ? found.conversation.unread
        : found.conversation.unread + 1,
    // The next move is theirs if they sent it, mine if I did.
    unreplied: input.senderId !== input.forUserId,
    // `bothSpoke` is deliberately left alone. It means "both participants
    // have sent at least one message ever", which one socket event cannot
    // establish — the sender may well have spoken before. Guessing it here
    // would be wrong in a way nothing refetches away.
    updatedAt: input.createdAt,
  }

  return moveToHead(data, input.conversationId, patched, found.pinned)
}

/**
 * One thread as the caches last saw it, from whichever entry under the
 * `['conversations']` prefix holds it — a tab's paged list, or the single row
 * `keys.conversation(id)` keeps for the chat header. Takes what
 * `getQueriesData` returns, so this file stays free of a query client.
 *
 * `undefined` when no entry holds it. A thread that has scrolled off every
 * loaded page is one the client knows nothing about, and the caller has to
 * decide what not knowing means.
 */
export function cachedConversation(
  entries: readonly (readonly [unknown, unknown])[],
  conversationId: string,
): ConversationDto | undefined {
  for (const [, data] of entries) {
    if (isPagedList(data)) {
      const found = findConversation(data, conversationId)
      if (found) return found.conversation
    } else if ((data as ConversationDto | undefined)?._id === conversationId) {
      return data as ConversationDto
    }
  }
  return undefined
}

/**
 * Whether this cache entry is the paged list, and not something else living
 * under the same key prefix.
 *
 * `useSocket` writes an arriving message with `setQueriesData` on the
 * `['conversations']` **prefix**, because the list is tabbed and several
 * caches hold the same thread. Two different shapes live under that prefix on
 * purpose: `keys.conversations(filter)` holds this paged list, and
 * `keys.conversation(id)` holds one plain `ConversationDto` — deliberately
 * there so every flag write invalidates it, see `queries.ts`.
 *
 * A `!data` guard passed the plain one straight through to a `for…of
 * data.pages`, which threw `data.pages is not iterable` on every message that
 * arrived while a chat screen was open — that screen is what puts the plain
 * entry in the cache. `useConversation`'s own `placeholderData` already
 * defends itself with `data?.pages ?? []`; this is the same defence, at the
 * one place that did not have it.
 */
function isPagedList(data: unknown): data is InfiniteData<ConversationPageDto> {
  return Array.isArray((data as { pages?: unknown } | undefined)?.pages)
}

function findConversation(
  data: InfiniteData<ConversationPageDto>,
  conversationId: string,
): { conversation: ConversationDto; pinned: boolean } | null {
  for (const page of data.pages) {
    const pinned = page.pinned.find((c) => c._id === conversationId)
    if (pinned) return { conversation: pinned, pinned: true }
    const conversation = page.items.find((c) => c._id === conversationId)
    if (conversation) return { conversation, pinned: false }
  }
  return null
}

/**
 * The server sorts by `lastMessage.createdAt` descending, so a conversation
 * that just received a message belongs at the very top — whichever page it
 * was sitting on.
 *
 * **Unless it is pinned.** Pinned threads are a separate list that sits above
 * the rest, and this used to move unconditionally: a message in an unpinned
 * thread would jump it above every pin, which is the one thing pinning is for.
 * A pinned thread is re-sorted within its own list instead.
 */
function moveToHead(
  data: InfiniteData<ConversationPageDto>,
  conversationId: string,
  patched: ConversationDto,
  isPinned: boolean,
): InfiniteData<ConversationPageDto> {
  if (isPinned) {
    const pages = data.pages.map((page, index) => ({
      ...page,
      pinned:
        index === 0
          ? [patched, ...page.pinned.filter((c) => c._id !== conversationId)]
          : page.pinned.filter((c) => c._id !== conversationId),
    }))
    return { ...data, pages }
  }
  const pages = data.pages.map((page) => ({
    ...page,
    items: page.items.filter((c) => c._id !== conversationId),
  }))
  const [first, ...rest] = pages
  if (!first) return data
  return { ...data, pages: [{ ...first, items: [patched, ...first.items] }, ...rest] }
}
