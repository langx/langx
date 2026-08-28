import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import {
  appendIncomingMessage,
  applyDeliveredAt,
  flattenMessagePages,
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
    pages: groups.map((items) => ({ items, nextCursor: null, participants: [ME, THEM] })),
    pageParams: groups.map((_, i) => (i === 0 ? '' : 'c')),
  }
}

describe('flattenMessagePages', () => {
  /**
   * `pages[0]` is the *newest* page: the cursor walks backwards into history.
   * Getting this wrong shows a thread with its history in blocks of the wrong
   * order, which reads as corruption rather than as a paging bug.
   */
  it('puts the oldest page first and the newest last', () => {
    const data = pages([message('new1'), message('new2')], [message('old1'), message('old2')])
    expect(flattenMessagePages(data).map((m) => m._id)).toEqual(['old1', 'old2', 'new1', 'new2'])
  })

  it('is empty for an empty cache', () => {
    expect(flattenMessagePages(undefined)).toEqual([])
  })
})

describe('appendIncomingMessage', () => {
  it('appends to the newest page, not the oldest', () => {
    const data = pages([message('new1')], [message('old1')])
    const next = appendIncomingMessage(data, message('fresh'))
    expect(next?.pages[0]?.items.map((m) => m._id)).toEqual(['new1', 'fresh'])
    expect(next?.pages[1]?.items.map((m) => m._id)).toEqual(['old1'])
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
