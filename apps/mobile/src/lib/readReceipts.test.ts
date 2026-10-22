import { QueryClient, type InfiniteData } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationDto, MessageDto } from '../api/queries'
import type { ConversationPageDto } from './conversationCache'
import type { MessagePageDto } from './messageCache'
import {
  applyConversationRead,
  applyReadAt,
  clearConversationUnread,
  createKeyedDebounce,
  incomingMayMoveTokens,
  TESTIMONIAL_RECHECK_MS,
  testimonialRecheckDue,
} from './readReceipts'

const ME = 'me'
const THEM = 'them'
const READ_AT = '2026-10-21T12:00:05.000Z'

function message(
  id: string,
  senderId: string,
  extra: Partial<MessageDto> = {},
  createdAt = '2026-10-21T12:00:00.000Z',
): MessageDto {
  return { _id: id, conversationId: 'c1', senderId, type: 'text', body: id, createdAt, ...extra }
}

function thread(...groups: MessageDto[][]): InfiniteData<MessagePageDto> {
  return {
    pages: groups.map((items) => ({
      items,
      nextCursor: null,
      prevCursor: null,
      pinned: null,
      participants: [ME, THEM],
      mediaLockedFor: 0,
    })),
    pageParams: groups.map((_, i) => (i === 0 ? '' : 'c')),
  }
}

function conversation(id: string, unread: number): ConversationDto {
  return {
    _id: id,
    participants: [ME, THEM],
    lastMessage: { body: 'hi', senderId: THEM, createdAt: '2026-10-21T12:00:00.000Z' },
    unread,
    pinned: false,
    archived: false,
    muted: false,
    unreplied: true,
    bothSpoke: true,
    mediaLockedFor: 0,
    updatedAt: '2026-10-21T12:00:00.000Z',
  }
}

function list(items: ConversationDto[], pinned: ConversationDto[] = []) {
  return {
    pages: [{ items, pinned, nextCursor: null }],
    pageParams: [''],
  } satisfies InfiniteData<ConversationPageDto>
}

describe('applyReadAt', () => {
  it('stamps the messages sent to the reader, and only those', () => {
    const data = thread([message('a', ME), message('b', ME), message('c', THEM)])
    const next = applyReadAt(data, { readBy: THEM, readAt: READ_AT })
    const items = next?.pages[0]?.items
    expect(items?.[0]?.readAt).toBe(READ_AT)
    expect(items?.[1]?.readAt).toBe(READ_AT)
    expect(items?.[2]?.readAt).toBeUndefined()
  })

  it('implies delivery but keeps an earlier delivery time', () => {
    const delivered = '2026-10-21T12:00:01.000Z'
    const data = thread([message('a', ME, { deliveredAt: delivered }), message('b', ME)])
    const items = applyReadAt(data, { readBy: THEM, readAt: READ_AT })?.pages[0]?.items
    expect(items?.[0]?.deliveredAt).toBe(delivered)
    expect(items?.[1]?.deliveredAt).toBe(READ_AT)
  })

  it('keeps an existing read time, as the server does', () => {
    const earlier = '2026-10-21T11:00:00.000Z'
    const data = thread([message('a', ME, { readAt: earlier })])
    expect(applyReadAt(data, { readBy: THEM, readAt: READ_AT })).toBe(data)
  })

  it('leaves a message newer than the read unread', () => {
    const data = thread([message('a', ME, {}, '2026-10-21T12:00:09.000Z')])
    expect(applyReadAt(data, { readBy: THEM, readAt: READ_AT })).toBe(data)
  })

  it('returns the same object when nothing changed, page by page', () => {
    const data = thread([message('new', ME)], [message('old', ME, { readAt: READ_AT })])
    const next = applyReadAt(data, { readBy: THEM, readAt: READ_AT })
    expect(next).not.toBe(data)
    expect(next?.pages[1]).toBe(data.pages[1])
    expect(applyReadAt(undefined, { readBy: THEM, readAt: READ_AT })).toBeUndefined()
  })

  it('reaches every page, not only the newest', () => {
    const data = thread([message('new', ME)], [message('old', ME)])
    const next = applyReadAt(data, { readBy: THEM, readAt: READ_AT })
    expect(next?.pages[1]?.items[0]?.readAt).toBe(READ_AT)
  })
})

describe('applyConversationRead', () => {
  it('zeroes the count in items and pinned', () => {
    const data = list([conversation('c1', 3)], [conversation('c2', 1)])
    const items = applyConversationRead(data, 'c1')
    expect(items.found).toBe(true)
    expect((items.data as typeof data).pages[0]?.items[0]?.unread).toBe(0)
    const pinned = applyConversationRead(data, 'c2')
    expect((pinned.data as typeof data).pages[0]?.pinned[0]?.unread).toBe(0)
  })

  it('reports found but changes nothing when the count is already zero', () => {
    const data = list([conversation('c1', 0)])
    expect(applyConversationRead(data, 'c1')).toEqual({ data, found: true })
  })

  it('says when no page holds the thread', () => {
    const data = list([conversation('c1', 2)])
    expect(applyConversationRead(data, 'c9')).toEqual({ data, found: false })
  })

  it('patches the single-conversation cache', () => {
    const one = conversation('c1', 4)
    expect(applyConversationRead(one, 'c1')).toEqual({ data: { ...one, unread: 0 }, found: true })
    expect(applyConversationRead(one, 'c2')).toEqual({ data: one, found: false })
  })

  it('ignores shapes it does not know', () => {
    expect(applyConversationRead(undefined, 'c1')).toEqual({ data: undefined, found: false })
  })
})

describe('clearConversationUnread', () => {
  it('patches without a refetch when a cache holds the thread', () => {
    const client = new QueryClient()
    client.setQueryData(['conversations', 'all'], list([conversation('c1', 2)]))
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    clearConversationUnread(client, 'c1')
    expect(invalidate).not.toHaveBeenCalled()
    const data = client.getQueryData<InfiniteData<ConversationPageDto>>(['conversations', 'all'])
    expect(data?.pages[0]?.items[0]?.unread).toBe(0)
  })

  it('falls back to invalidating when nothing holds it', () => {
    const client = new QueryClient()
    client.setQueryData(['conversations', 'all'], list([conversation('c1', 2)]))
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    clearConversationUnread(client, 'c9')
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})

describe('incomingMayMoveTokens', () => {
  it('asks after my own sends', () => {
    expect(incomingMayMoveTokens({ mine: true, bothSpoke: true })).toBe(true)
  })

  it('skips their message in a thread already two-way', () => {
    expect(incomingMayMoveTokens({ mine: false, bothSpoke: true })).toBe(false)
  })

  it('asks when their message may be the reply that pays both sides', () => {
    expect(incomingMayMoveTokens({ mine: false, bothSpoke: false })).toBe(true)
    expect(incomingMayMoveTokens({ mine: false, bothSpoke: undefined })).toBe(true)
  })
})

describe('createKeyedDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs once per key after the burst settles', () => {
    const debounce = createKeyedDebounce(1000)
    const run = vi.fn()
    debounce.schedule('c1', run)
    vi.advanceTimersByTime(600)
    debounce.schedule('c1', run)
    vi.advanceTimersByTime(600)
    debounce.schedule('c1', run)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('keeps keys apart', () => {
    const debounce = createKeyedDebounce(1000)
    const a = vi.fn()
    const b = vi.fn()
    debounce.schedule('c1', a)
    debounce.schedule('c2', b)
    vi.advanceTimersByTime(1000)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('flushes one key now and leaves the others waiting', () => {
    const debounce = createKeyedDebounce(1000)
    const a = vi.fn()
    const b = vi.fn()
    debounce.schedule('c1', a)
    debounce.schedule('c2', b)
    debounce.flush('c1')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    // Flushed, so its timer does not run it a second time.
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    debounce.flush('c1')
    expect(a).toHaveBeenCalledTimes(1)
  })

  it('flushes everything pending', () => {
    const debounce = createKeyedDebounce(1000)
    const a = vi.fn()
    const b = vi.fn()
    debounce.schedule('c1', a)
    debounce.schedule('c2', b)
    debounce.flushAll()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(a).toHaveBeenCalledTimes(1)
  })

  it('cancels everything pending', () => {
    const debounce = createKeyedDebounce(1000)
    const run = vi.fn()
    debounce.schedule('c1', run)
    debounce.cancelAll()
    vi.advanceTimersByTime(2000)
    expect(run).not.toHaveBeenCalled()
  })
})

describe('testimonialRecheckDue', () => {
  const locked = { unlocked: false, written: false }

  it('asks while the state is present and still locked', () => {
    expect(testimonialRecheckDue(locked, undefined, 0)).toBe(true)
  })

  it('asks at most once a minute', () => {
    expect(testimonialRecheckDue(locked, 0, TESTIMONIAL_RECHECK_MS - 1)).toBe(false)
    expect(testimonialRecheckDue(locked, 0, TESTIMONIAL_RECHECK_MS)).toBe(true)
  })

  it('never asks once unlocked, or where there is no state', () => {
    expect(testimonialRecheckDue({ unlocked: true, written: false }, undefined, 0)).toBe(false)
    expect(testimonialRecheckDue(undefined, undefined, 0)).toBe(false)
  })
})
