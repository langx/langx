import type { InfiniteData } from '@tanstack/react-query'
import type { ConversationDto } from '../api/queries'

export interface ConversationPageDto {
  items: ConversationDto[]
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
  if (!data) return data
  const found = findConversation(data, input.conversationId)
  if (!found) return undefined

  const patched: ConversationDto = {
    ...found.conversation,
    lastMessage: {
      body: input.body,
      senderId: input.senderId,
      createdAt: input.createdAt,
    },
    unread:
      input.senderId === input.forUserId
        ? found.conversation.unread
        : {
            ...found.conversation.unread,
            [input.forUserId]: (found.conversation.unread[input.forUserId] ?? 0) + 1,
          },
    // `bothSpoke` is deliberately left alone. It means "both participants
    // have sent at least one message ever", which one socket event cannot
    // establish — the sender may well have spoken before. Guessing it here
    // would be wrong in a way nothing refetches away.
    updatedAt: input.createdAt,
  }

  return moveToHead(data, input.conversationId, patched)
}

function findConversation(
  data: InfiniteData<ConversationPageDto>,
  conversationId: string,
): { conversation: ConversationDto } | null {
  for (const page of data.pages) {
    const conversation = page.items.find((c) => c._id === conversationId)
    if (conversation) return { conversation }
  }
  return null
}

/**
 * The server sorts by `lastMessage.createdAt` descending, so a conversation
 * that just received a message belongs at the very top — whichever page it
 * was sitting on.
 */
function moveToHead(
  data: InfiniteData<ConversationPageDto>,
  conversationId: string,
  patched: ConversationDto,
): InfiniteData<ConversationPageDto> {
  const pages = data.pages.map((page) => ({
    ...page,
    items: page.items.filter((c) => c._id !== conversationId),
  }))
  const [first, ...rest] = pages
  if (!first) return data
  return { ...data, pages: [{ ...first, items: [patched, ...first.items] }, ...rest] }
}
