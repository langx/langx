import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { ThreadTestimonialState } from '@langx/shared'
import type { ConversationDto } from '../api/queries'
import type { ConversationPageDto } from './conversationCache'
import type { MessagePageDto } from './messageCache'

/**
 * `conversation:read` applied to the caches instead of refetching them.
 *
 * The event used to invalidate the thread, the chat list and the unread total
 * on both phones. In a live conversation every incoming message is marked read
 * at once, so each message became a read, and each read refetched every loaded
 * page of the thread on both sides — about a dozen requests per message, at
 * ~220 ms each, for a change the event already describes in full.
 */

type MessagePages = InfiniteData<MessagePageDto> | undefined

/**
 * Stamps `readAt` on the messages `readBy` has now read.
 *
 * Mirrors the server's `markConversationRead`: every message *to* the reader
 * with no `readAt` yet, and nothing of their own. A read also proves delivery
 * (the server stamps that in the same call and sends no separate event), so
 * an undelivered message picks up `deliveredAt` too. Messages newer than the
 * read are left alone: the server's update ran at `readAt` and cannot have
 * reached a row that did not exist yet.
 *
 * Returns the input itself when nothing changed, so `setQueriesData` leaves
 * the cache — and every screen reading it — untouched.
 */
export function applyReadAt(
  data: MessagePages,
  input: { readBy: string; readAt: string },
): MessagePages {
  if (!data) return data
  const readAtMs = Date.parse(input.readAt)
  let changed = false
  const pages = data.pages.map((page) => {
    let pageChanged = false
    const items = page.items.map((message) => {
      if (message.senderId === input.readBy || message.readAt) return message
      if (Number.isFinite(readAtMs) && Date.parse(message.createdAt) > readAtMs) return message
      pageChanged = true
      return {
        ...message,
        readAt: input.readAt,
        deliveredAt: message.deliveredAt ?? input.readAt,
      }
    })
    if (!pageChanged) return page
    changed = true
    return { ...page, items }
  })
  return changed ? { ...data, pages } : data
}

/**
 * The reader's own unread count for one thread, cleared in whatever shape of
 * `['conversations', …]` cache holds it: a page of the chat list (items and
 * pinned) or the single conversation `keys.conversation(id)` caches.
 *
 * `found` says whether any cache held the thread at all. A thread that has
 * scrolled out of every loaded page is the one case this cannot patch, and the
 * caller falls back to invalidating — the same contract as
 * `applyIncomingMessage`.
 */
export function applyConversationRead(
  data: unknown,
  conversationId: string,
): { data: unknown; found: boolean } {
  if (isConversation(data)) {
    if (data._id !== conversationId) return { data, found: false }
    return { data: data.unread === 0 ? data : { ...data, unread: 0 }, found: true }
  }
  if (!isPagedList(data)) return { data, found: false }
  let found = false
  let changed = false
  const clear = (list: ConversationDto[]): ConversationDto[] => {
    let listChanged = false
    const next = list.map((c) => {
      if (c._id !== conversationId) return c
      found = true
      if (c.unread === 0) return c
      listChanged = true
      return { ...c, unread: 0 }
    })
    if (!listChanged) return list
    changed = true
    return next
  }
  const pages = data.pages.map((page) => {
    const items = clear(page.items)
    const pinned = clear(page.pinned)
    return items === page.items && pinned === page.pinned ? page : { ...page, items, pinned }
  })
  return { data: changed ? { ...data, pages } : data, found }
}

/**
 * This reader's count for one thread, zeroed in every `['conversations']`
 * cache — and the list sent back to the server only when no cache held the
 * thread, which is the one case a patch cannot cover.
 */
export function clearConversationUnread(client: QueryClient, conversationId: string): void {
  let found = false
  client.setQueriesData({ queryKey: ['conversations'] }, (old: unknown) => {
    const next = applyConversationRead(old, conversationId)
    if (next.found) found = true
    return next.data
  })
  if (!found) void client.invalidateQueries({ queryKey: ['conversations'] })
}

/**
 * Whether a `message:new` can have moved this account's token balance.
 *
 * The event carries the message view only — a send's award travels in the
 * sender's ack or REST body, never in the broadcast — so the client has to
 * reason it out rather than read it. Two cases can pay:
 *
 * - **My own message**, echoed back. Whatever the send earned is credited by
 *   now, and the echo is the one signal every send path (text, photo, voice,
 *   correction) has in common.
 * - **Their message in a thread that was not yet two-way.** The first reply
 *   pays the reciprocity bonus to *both* sides (`awardForSend`), so the
 *   recipient's balance moves on a message they did not send. `bothSpoke`
 *   undefined means the thread is not cached, which is a reason to ask.
 *
 * Everything else — their message in a conversation already under way, the
 * steady state of any live chat — pays the recipient nothing, and used to
 * refetch the balance anyway.
 */
export function incomingMayMoveTokens(input: {
  mine: boolean
  bothSpoke: boolean | undefined
}): boolean {
  return input.mine || input.bothSpoke !== true
}

/**
 * A trailing debounce per key: `schedule(key, run)` runs the latest `run` for
 * that key once `delayMs` has passed without another call for the same key.
 *
 * For the read the socket posts while a thread is open. A partner who types in
 * bursts sends three messages in two seconds; each was its own POST and its own
 * `conversation:read` round on both phones. One read after the burst settles
 * says the same thing.
 */
export function createKeyedDebounce(delayMs: number): {
  schedule: (key: string, run: () => void) => void
  /** Runs this key's pending call now, if there is one. */
  flush: (key: string) => void
  /** Runs every pending call now. */
  flushAll: () => void
  cancelAll: () => void
} {
  const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>()
  const flush = (key: string): void => {
    const pending = timers.get(key)
    if (!pending) return
    clearTimeout(pending.timer)
    timers.delete(key)
    pending.run()
  }
  return {
    schedule(key, run) {
      const pending = timers.get(key)
      if (pending !== undefined) clearTimeout(pending.timer)
      timers.set(key, { timer: setTimeout(() => flush(key), delayMs), run })
    },
    flush,
    flushAll() {
      for (const key of [...timers.keys()]) flush(key)
    },
    cancelAll() {
      for (const pending of timers.values()) clearTimeout(pending.timer)
      timers.clear()
    },
  }
}

/** At most this often per thread does a read go back for the testimonial state. */
export const TESTIMONIAL_RECHECK_MS = 60_000

/**
 * Whether a read of my own should refetch the thread to learn if the
 * testimonial has unlocked. Only while the state is present and still locked
 * — once it is unlocked, or on a thread that never carries it, there is
 * nothing to learn — and no more than once per `TESTIMONIAL_RECHECK_MS`.
 */
export function testimonialRecheckDue(
  testimonial: ThreadTestimonialState | undefined,
  lastCheckedAt: number | undefined,
  now: number,
): boolean {
  if (!testimonial || testimonial.unlocked) return false
  return lastCheckedAt === undefined || now - lastCheckedAt >= TESTIMONIAL_RECHECK_MS
}

function isPagedList(data: unknown): data is InfiniteData<ConversationPageDto> {
  return Array.isArray((data as { pages?: unknown } | undefined)?.pages)
}

function isConversation(data: unknown): data is ConversationDto {
  const candidate = data as Partial<ConversationDto> | undefined
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate._id === 'string' &&
    typeof candidate.unread === 'number'
  )
}
