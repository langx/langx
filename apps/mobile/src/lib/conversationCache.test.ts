import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { ConversationDto } from '../api/queries'
import { applyIncomingMessage, type ConversationPageDto } from './conversationCache'

const ME = 'me'
const THEM = 'them'

function conversation(id: string, unreadForMe = 0): ConversationDto {
  return {
    _id: id,
    participants: [ME, THEM],
    lastMessage: { body: `old ${id}`, senderId: THEM, createdAt: '2026-08-01T00:00:00.000Z' },
    // A number, not a map: `toConversationView` resolves it server-side so the
    // other person's count never reaches the client.
    unread: unreadForMe,
    pinned: false,
    archived: false,
    unreplied: true,
    bothSpoke: true,
    mediaLockedFor: 0,
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

function pages(
  groups: ConversationDto[][],
  pinned: ConversationDto[] = [],
): InfiniteData<ConversationPageDto> {
  return {
    pages: groups.map((items, i) => ({
      items,
      // The whole pinned set rides on every page, so only page one is read.
      pinned: i === 0 ? pinned : [],
      nextCursor: i === groups.length - 1 ? null : 'c',
    })),
    pageParams: groups.map((_, i) => (i === 0 ? '' : 'c')),
  }
}

const incoming = {
  conversationId: 'c3',
  body: 'hello',
  senderId: THEM,
  createdAt: '2026-08-28T12:00:00.000Z',
  forUserId: ME,
}

describe('applyIncomingMessage', () => {
  it('moves the conversation to the head, even from a later page', () => {
    const data = pages([[conversation('c1'), conversation('c2')], [conversation('c3')]])
    const next = applyIncomingMessage(data, incoming)

    expect(next?.pages[0]?.items.map((c) => c._id)).toEqual(['c3', 'c1', 'c2'])
    expect(next?.pages[1]?.items).toEqual([])
  })

  it('carries the new last message', () => {
    const next = applyIncomingMessage(pages([[conversation('c3')]]), incoming)
    expect(next?.pages[0]?.items[0]?.lastMessage).toEqual({
      body: 'hello',
      senderId: THEM,
      createdAt: incoming.createdAt,
    })
  })

  it('increments my unread count when someone else wrote', () => {
    const next = applyIncomingMessage(pages([[conversation('c3', 2)]]), incoming)
    expect(next?.pages[0]?.items[0]?.unread).toBe(3)
  })

  /** The echo reaches the sender too; their own message is not unread. */
  it('leaves the count alone when the message is mine', () => {
    const next = applyIncomingMessage(pages([[conversation('c3', 2)]]), {
      ...incoming,
      senderId: ME,
    })
    expect(next?.pages[0]?.items[0]?.unread).toBe(2)
  })

  /**
   * `bothSpoke` means "both have sent at least one message ever", which one
   * event cannot establish. Guessing it would be wrong in a way nothing
   * refetches away.
   */
  it('does not guess bothSpoke', () => {
    const data = pages([[{ ...conversation('c3'), bothSpoke: false }]])
    const next = applyIncomingMessage(data, incoming)
    expect(next?.pages[0]?.items[0]?.bothSpoke).toBe(false)
  })

  /** The caller's signal to fall back to invalidating. */
  it('returns undefined for a conversation outside the loaded pages', () => {
    expect(applyIncomingMessage(pages([[conversation('c1')]]), incoming)).toBeUndefined()
  })

  it('passes an empty cache straight through', () => {
    expect(applyIncomingMessage(undefined, incoming)).toBeUndefined()
  })
})

describe('pinned threads', () => {
  /**
   * The regression this exists to stop. `moveToHead` was unconditional, so a
   * message in an *unpinned* thread put it above every pin — undoing the one
   * thing pinning does.
   */
  it('does not float an unpinned thread above the pins', () => {
    const pin = { ...conversation('p1'), pinned: true }
    const data = pages([[conversation('c3')]], [pin])

    const next = applyIncomingMessage(data, incoming)

    expect(next?.pages[0]?.pinned.map((c) => c._id)).toEqual(['p1'])
    expect(next?.pages[0]?.items.map((c) => c._id)).toEqual(['c3'])
  })

  it('re-sorts a pinned thread within the pins, not out of them', () => {
    const first = { ...conversation('p1'), pinned: true }
    const second = { ...conversation('p2'), pinned: true }
    const data = pages([[conversation('c1')]], [first, second])

    const next = applyIncomingMessage(data, { ...incoming, conversationId: 'p2' })

    expect(next?.pages[0]?.pinned.map((c) => c._id)).toEqual(['p2', 'p1'])
    // And it does not appear in the unpinned list as well.
    expect(next?.pages[0]?.items.map((c) => c._id)).toEqual(['c1'])
  })

  it('flips `unreplied` by who sent it, not by the unread count', () => {
    const data = pages([[conversation('c3')]])

    const theirs = applyIncomingMessage(data, incoming)
    expect(theirs?.pages[0]?.items[0]?.unreplied).toBe(true)

    const mine = applyIncomingMessage(data, { ...incoming, senderId: ME })
    expect(mine?.pages[0]?.items[0]?.unreplied).toBe(false)
    // Mine does not bump my own unread either.
    expect(mine?.pages[0]?.items[0]?.unread).toBe(0)
  })
})
