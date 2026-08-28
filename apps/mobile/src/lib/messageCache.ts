import type { InfiniteData } from '@tanstack/react-query'
import type { MessageDto } from '../api/queries'

export interface MessagePageDto {
  items: MessageDto[]
  nextCursor: string | null
  participants: string[]
}

type Pages = InfiniteData<MessagePageDto> | undefined

/**
 * A page's `items` run oldest → newest, but `nextCursor` walks *backwards*
 * into history (`listMessages` sorts descending, slices, then reverses). So
 * `pages[0]` is the newest page and `pages[n]` the oldest, and a new message
 * always belongs at the end of `pages[0]`.
 */
export function appendIncomingMessage(data: Pages, message: MessageDto): Pages {
  if (!data) return data
  const [first, ...rest] = data.pages
  if (!first) return data
  // The sender already appended this optimistically and the socket echoes to
  // *both* participants, so guard against a duplicate.
  if (data.pages.some((page) => page.items.some((m) => sameId(m, message)))) return data
  return { ...data, pages: [{ ...first, items: [...first.items, message] }, ...rest] }
}

/**
 * Everything the recipient had not received yet is now on their device.
 *
 * Mirrors the server's filter exactly: their own messages are not theirs to
 * mark, and an existing timestamp is the moment it actually arrived —
 * re-stamping would drag it forward on every reconnect.
 */
export function applyDeliveredAt(
  data: Pages,
  input: { deliveredTo: string; deliveredAt: string },
): Pages {
  if (!data) return data
  let changed = false
  const pages = data.pages.map((page) => ({
    ...page,
    items: page.items.map((message) => {
      if (message.senderId === input.deliveredTo || message.deliveredAt) return message
      changed = true
      return { ...message, deliveredAt: input.deliveredAt }
    }),
  }))
  return changed ? { ...data, pages } : data
}

/**
 * Newest last, which is the order the thread is drawn in.
 *
 * The reverse is the whole reason this is a function: getting it wrong shows
 * the conversation with its history in blocks of the wrong order, which looks
 * like data corruption rather than a paging bug.
 */
export function flattenMessagePages(data: Pages): MessageDto[] {
  if (!data) return []
  return [...data.pages].reverse().flatMap((page) => page.items)
}

function sameId(a: MessageDto, b: MessageDto): boolean {
  return String(a._id) === String(b._id)
}
