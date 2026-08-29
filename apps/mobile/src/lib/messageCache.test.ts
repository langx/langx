import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import {
  appendIncomingMessage,
  applyDeliveredAt,
  applyMessageUpdate,
  applyPinned,
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
      pinned: null,
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

describe('applyMessageUpdate', () => {
  it('replaces the message wholesale rather than merging into it', () => {
    const data = pages([{ ...message('a'), body: 'before' }])
    const withdrawn = { ...message('a'), body: '', deleted: true }
    const next = applyMessageUpdate(data, withdrawn)

    expect(next?.pages[0]?.items[0]).toEqual(withdrawn)
  })

  /**
   * A merge would resurrect exactly what the server's projection took away —
   * the attachment of a message that was just deleted, most obviously.
   */
  it('does not carry a dropped field through from the old copy', () => {
    const withMedia = {
      ...message('a'),
      media: { url: 'https://cdn/x.jpg', contentType: 'image/jpeg', sizeBytes: 1 },
    }
    const next = applyMessageUpdate(pages([withMedia]), { ...message('a'), deleted: true })
    expect(next?.pages[0]?.items[0]?.media).toBeUndefined()
  })

  it('finds the message on any page', () => {
    const data = pages([message('new1')], [message('old1')])
    const next = applyMessageUpdate(data, { ...message('old1'), body: 'edited' })
    expect(next?.pages[1]?.items[0]?.body).toBe('edited')
  })

  /** An update for something not loaded is not an invitation to insert it. */
  it('is a no-op for a message outside the loaded pages', () => {
    const data = pages([message('a')])
    expect(applyMessageUpdate(data, message('elsewhere'))).toBe(data)
  })
})

describe('messagesNewestFirst and hidden messages', () => {
  /**
   * Filtered here rather than on the server: dropping rows from a keyset page
   * would make a page of 30 arrive as 12, and the paging would have to
   * compensate for a number only this viewer knows.
   */
  it('drops the ones this reader hid, and keeps the rest', () => {
    const data = pages([message('a'), { ...message('b'), hidden: true }, message('c')])
    expect(messagesNewestFirst(data).map((m) => m._id)).toEqual(['c', 'a'])
  })

  it('keeps a message withdrawn for everyone, which still occupies its place', () => {
    const data = pages([{ ...message('a'), deleted: true, body: '' }])
    expect(messagesNewestFirst(data).map((m) => m._id)).toEqual(['a'])
  })
})

describe('applyPinned', () => {
  const pin = { messageId: 'a', byUserId: ME, at: '2026-08-29T09:00:00.000Z' }

  /** The pin rides in on every page, so a change has to reach every page. */
  it('writes the pin to all of them, not just the newest', () => {
    const next = applyPinned(pages([message('a')], [message('b')]), pin)
    expect(next?.pages.map((p) => p.pinned?.messageId)).toEqual(['a', 'a'])
  })

  it('clears it', () => {
    const withPin = applyPinned(pages([message('a')]), pin)
    expect(applyPinned(withPin, null)?.pages[0]?.pinned).toBeNull()
  })

  /** A re-emit of the pin already held must not re-render the thread. */
  it('returns the same object when nothing moved', () => {
    const data = pages([message('a')])
    expect(applyPinned(data, null)).toBe(data)
    const withPin = applyPinned(data, pin)
    expect(applyPinned(withPin, pin)).toBe(withPin)
  })
})
