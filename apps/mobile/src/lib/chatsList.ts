import { dedupeById } from './dedupeById'
import { waitingThreads, type HomeThread } from './homePlan'

/** The slice of a chat-list row the redesign's list is laid out from. */
export interface ChatsThread extends HomeThread {
  /** Both of them have written at least once. */
  bothSpoke: boolean
  lastMessage: { createdAt: string }
}

/** One page of the chat list, as `/conversations` sends it. */
export interface ChatsPage<T> {
  /** The pinned threads, whole, on every page — see `listConversations`. */
  pinned: readonly T[]
  items: readonly T[]
}

/**
 * What the redesign's chat list draws, in order: the people waiting on you
 * as colour blocks, then everyone else as rows.
 *
 * A heading over each half only when there are two halves — a list with
 * nobody waiting is just the list, and one with nobody else is just the
 * blocks.
 */
export type ChatsListItem<T> =
  | { kind: 'heading'; heading: 'waiting' | 'others' }
  | { kind: 'waiting'; thread: T }
  | { kind: 'row'; thread: T }

/**
 * The blocks and the rows, from the pages in hand.
 *
 * **Waiting is read off the first page only**, and that is what keeps the
 * list still. The list is paged newest first, so a thread further down that
 * is also waiting would, if every loaded page were searched, jump from a row
 * near the bottom to a block at the top the moment its page arrived — under a
 * thumb that was scrolling. Those threads stay rows, and a row says "your
 * turn" by itself (its reply arrow), as it always did. The first page is also
 * what Home's next step reads, so the two tabs lead with the same person.
 *
 * Pinned threads count as first-page ones, since every page carries them.
 * The blocks are newest first whatever is pinned: pinning keeps a row at the
 * top of the rows, and a block is not a row.
 *
 * Who counts as waiting is Home's `waitingThreads`: they wrote last, the
 * thread is not archived, and they are a person who can read a reply.
 */
export function chatsListItems<T extends ChatsThread>(
  pages: readonly ChatsPage<T>[],
): ChatsListItem<T>[] {
  const first = pages[0]
  if (!first) return []
  const waiting = waitingThreads(dedupeById([...first.pinned, ...first.items])).sort(
    (a, b) => Date.parse(b.lastMessage.createdAt) - Date.parse(a.lastMessage.createdAt),
  )
  const waitingIds = new Set(waiting.map((thread) => thread._id))
  // Deduped: a keyset cursor over a moving sort key can hand back a thread
  // already seen on an earlier page.
  const rows = dedupeById([...first.pinned, ...pages.flatMap((page) => page.items)]).filter(
    (thread) => !waitingIds.has(thread._id),
  )

  const items: ChatsListItem<T>[] = []
  if (waiting.length > 0) {
    items.push({ kind: 'heading', heading: 'waiting' })
    for (const thread of waiting) items.push({ kind: 'waiting', thread })
    if (rows.length > 0) items.push({ kind: 'heading', heading: 'others' })
  }
  for (const thread of rows) items.push({ kind: 'row', thread })
  return items
}

/**
 * A key per item that stays the same while the item does. The kind is in it,
 * so a thread that stops waiting — you replied — is a new row rather than a
 * block's cell reused for a different shape.
 */
export function chatsListKey(item: ChatsListItem<{ _id: string }>): string {
  switch (item.kind) {
    case 'heading':
      return `heading:${item.heading}`
    case 'waiting':
      return `waiting:${item.thread._id}`
    case 'row':
      return `row:${item.thread._id}`
  }
}

/**
 * The thread the coach card's Show me opens: somewhere with a message from
 * the other person in it, since a correction is of their words. The first
 * block if there is one — the person waiting has just written — and otherwise
 * the newest row with a person in it who has written at least once.
 * `undefined` when there is none, and the card is then not shown at all: a
 * button that cannot do what it says is worse than no card.
 */
export function coachThread<T extends ChatsThread>(
  items: readonly ChatsListItem<T>[],
): T | undefined {
  for (const item of items) {
    if (item.kind === 'waiting') return item.thread
  }
  for (const item of items) {
    if (item.kind !== 'row') continue
    const { thread } = item
    const person =
      thread.partner !== undefined &&
      thread.partner.official !== true &&
      thread.partner.accountStatus === 'active'
    if (person && !thread.archived && (thread.unreplied || thread.bothSpoke)) return thread
  }
  return undefined
}
