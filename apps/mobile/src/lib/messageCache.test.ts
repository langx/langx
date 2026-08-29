import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import {
  appendIncomingMessage,
  applyDeliveredAt,
  messagesNewestFirst,
  type MessagePageDto,
} from './messageCache'

const ME = 'me'
const THEM = 'them'

function message(id: string, senderId = THEM, deliveredAt?: string): MessageDto {
  return {
    _id: id,
    conversationId: 'c1',
    senderId,
    type: 'text',
    body: id,
    createdAt: '2026-08-28T12:00:00.000Z',
    ...(deliveredAt ? { deliveredAt } : {}),
  }
}

function pages(...groups: MessageDto[][]): InfiniteData<MessagePageDto> {
  return {
    pages: groups.map((items) => ({
      items,
      nextCursor: null,
      prevCursor: null,
      participants: [ME, THEM],
    })),
    pageParams: groups.map((_, i) => (i === 0 ? '' : 'c')),
  }
}

describe('messagesNewestFirst', () => {
  /**
   * `pages[0]` is the *newest* page (the cursor walks backwards into history)
   * but the items inside a page run oldest → newest. Both levels have to flip,
   * and only a fixture whose pages hold more than one message can tell the
   * difference — reversing just the outer level passes a single-item fixture.
   */
  it('draws newest first, and reverses within each page', () => {
    const data = pages([message('new1'), message('new2')], [message('old1'), message('old2')])
    expect(messagesNewestFirst(data).map((m) => m._id)).toEqual(['new2', 'new1', 'old2', 'old1'])
  })

  it('is empty for an empty cache', () => {
    expect(messagesNewestFirst(undefined)).toEqual([])
  })
})

describe('appendIncomingMessage', () => {
  it('appends to the newest page, not the oldest', () => {
    const data = pages([message('new1')], [message('old1')])
    const next = appendIncomingMessage(data, message('fresh'))
    expect(next?.pages[0]?.items.map((m) => m._id)).toEqual(['new1', 'fresh'])
    expect(next?.pages[1]?.items.map((m) => m._id)).toEqual(['old1'])
  })

  /**
   * The pairing that actually matters: `appendIncomingMessage` writes to the
   * *end* of `pages[0]` while the list reads newest *first*, so the two only
   * agree because of the within-page reversal above.
   */
  it('puts an incoming message at the head of the rendered thread', () => {
    const data = pages([message('new1')], [message('old1')])
    const next = appendIncomingMessage(data, message('fresh'))
    expect(messagesNewestFirst(next).map((m) => m._id)).toEqual(['fresh', 'new1', 'old1'])
  })

  /**
   * A window opened mid-history is a slice, not the tail. Splicing a message
   * sent seconds ago in after one from last year is the failure this prevents,
   * and `prevCursor` is the only thing that distinguishes the two caches.
   */
  it('refuses to append to a window that has not reached the tail', () => {
    const data = pages([message('old1')])
    const windowed = {
      ...data,
      pages: [{ ...data.pages[0]!, prevCursor: 'newer-than-this' }],
    }
    expect(appendIncomingMessage(windowed, message('fresh'))).toBe(windowed)
  })

  /** The sender appended optimistically and the socket echoes to both. */
  it('ignores a message already in any page', () => {
    const data = pages([message('new1')], [message('old1')])
    expect(appendIncomingMessage(data, message('old1'))).toBe(data)
  })
})

describe('applyDeliveredAt', () => {
  const at = '2026-08-28T13:00:00.000Z'

  it('stamps my undelivered messages across every page', () => {
    const data = pages([message('a', ME)], [message('b', ME)])
    const next = applyDeliveredAt(data, { deliveredTo: THEM, deliveredAt: at })
    expect(next?.pages[0]?.items[0]?.deliveredAt).toBe(at)
    expect(next?.pages[1]?.items[0]?.deliveredAt).toBe(at)
  })

  it('leaves the recipient`s own messages alone', () => {
    const data = pages([message('a', THEM)])
    expect(applyDeliveredAt(data, { deliveredTo: THEM, deliveredAt: at })).toBe(data)
  })

  /** Delivery is a moment, not a flag — re-stamping drags it forward. */
  it('does not overwrite a timestamp already there', () => {
    const earlier = '2026-08-28T11:00:00.000Z'
    const data = pages([message('a', ME, earlier)])
    const next = applyDeliveredAt(data, { deliveredTo: THEM, deliveredAt: at })
    expect(next?.pages[0]?.items[0]?.deliveredAt).toBe(earlier)
  })
})
