import type { InfiniteData } from '@tanstack/react-query'
import type { MessageDto } from '../api/queries'

export interface MessagePageDto {
  items: MessageDto[]
  /** Older than this page; null at the beginning of history. */
  nextCursor: string | null
  /** Newer than this page; null means the page already reaches the live tail. */
  prevCursor: string | null
  participants: string[]
  pinned: { messageId: string; byUserId: string; at: string } | null
  /** Only a jump window has one — the message it was opened on. */
  anchorId?: string
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
  // A jump window that has not paged forward to the tail is a slice out of the
  // middle of the thread. Appending to it would splice a message sent seconds
  // ago in after one from last year. Live pages never carry `prevCursor`, so
  // this is a no-op for them.
  if (first.prevCursor) return data
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
 * Newest first, which is the order an `inverted` list draws bottom-up.
 *
 * Two reversals, not one. The pages already run newest → oldest, but the items
 * *inside* each page run oldest → newest, so flattening while reversing only
 * the outer level interleaves the thread in blocks of the wrong order — which
 * reads as data corruption rather than as a paging bug. The name carries the
 * direction because the cache's own shape does not, and because this function
 * used to return the opposite.
 */
export function messagesNewestFirst(data: Pages): MessageDto[] {
  if (!data) return []
  // `hidden` is filtered here rather than on the server: dropping rows from a
  // keyset page would make a page of 30 arrive as 12, and the paging would
  // have to compensate for a number only the viewer knows.
  return data.pages.flatMap((page) => [...page.items].reverse().filter((m) => !m.hidden))
}

/**
 * A message that already exists has changed — a reaction, a withdrawal, and
 * later an edit or a star.
 *
 * Replaced wholesale rather than merged. The server sends the message's entire
 * new state as that viewer is allowed to see it, and merging would resurrect
 * exactly the fields the projection took away: the `media` of a message that
 * was just deleted, most obviously.
 *
 * Not found is a no-op, not an insert. An update for a message outside the
 * loaded pages means the reader has not scrolled to it, and the page will
 * carry the right state whenever they do.
 */
export function applyMessageUpdate(data: Pages, message: MessageDto): Pages {
  if (!data) return data
  let changed = false
  const pages = data.pages.map((page) => ({
    ...page,
    items: page.items.map((existing) => {
      if (!sameId(existing, message)) return existing
      changed = true
      return message
    }),
  }))
  return changed ? { ...data, pages } : data
}

function sameId(a: MessageDto, b: MessageDto): boolean {
  return String(a._id) === String(b._id)
}

/**
 * The pin is on the conversation, not on a message, but it rides in on every
 * page — so a change has to be written to every page rather than to one row.
 *
 * Same `changed`-guard discipline as the rest: a re-emit of the pin already
 * held returns the identical object and re-renders nothing.
 */
export function applyPinned(data: Pages, pinned: MessagePageDto['pinned']): Pages {
  if (!data) return data
  const same = (a: MessagePageDto['pinned'], b: MessagePageDto['pinned']): boolean =>
    a?.messageId === b?.messageId && a?.byUserId === b?.byUserId
  if (data.pages.every((page) => same(page.pinned, pinned))) return data
  return { ...data, pages: data.pages.map((page) => ({ ...page, pinned })) }
}
