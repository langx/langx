import { IN_APP_NOTIFICATION_KINDS } from '@langx/shared'
import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  markPagesRead,
  notificationCopy,
  notificationHref,
  stickyUnread,
  type InboxItem,
} from './notificationInbox'

const SOFIA = { handle: 'sofia', displayName: 'Sofia' }
const HERE = '/(app)/notifications'
const FROM = `?from=${encodeURIComponent(HERE)}`

function row(overrides: Partial<InboxItem> & Pick<InboxItem, 'kind'>): InboxItem {
  return { _id: 'n1', ...overrides }
}

describe('notificationHref', () => {
  it('lands a follow on the person who did it', () => {
    expect(notificationHref(row({ kind: 'follow', actor: SOFIA }), HERE)).toBe(
      `/(app)/profile/sofia${FROM}`,
    )
  })

  it('lands every kind of feed reaction on the post it is about', () => {
    for (const kind of ['postComment', 'postCorrection', 'pronunciationAnswer', 'like'] as const) {
      expect(notificationHref(row({ kind, postId: 'p1', actor: SOFIA }), HERE)).toBe(
        `/(app)/post/p1${FROM}`,
      )
    }
  })

  it('lands the kinds nobody did on the screen that shows the thing', () => {
    expect(notificationHref(row({ kind: 'badgeEarned' }), HERE)).toBe('/(app)/badges')
    expect(notificationHref(row({ kind: 'walletPool' }), HERE)).toBe('/(app)/wallet/pool')
    expect(notificationHref(row({ kind: 'profileVisits' }), HERE)).toBe('/(app)/viewers')
  })

  /**
   * An older build against a newer server, or a post deleted between the list
   * being fetched and the tap. The row renders disabled — a button that opens
   * an empty screen is worse than one that does not offer itself.
   */
  it('refuses to route rather than opening nothing', () => {
    expect(notificationHref(row({ kind: 'postComment', actor: SOFIA }), HERE)).toBeNull()
    expect(notificationHref(row({ kind: 'follow' }), HERE)).toBeNull()
  })

  it('has an answer for every kind there is', () => {
    for (const kind of IN_APP_NOTIFICATION_KINDS) {
      expect(notificationHref(row({ kind, postId: 'p', actor: SOFIA }), HERE)).not.toBeNull()
    }
  })
})

describe('notificationCopy', () => {
  it('words one liker and several differently', () => {
    expect(notificationCopy(row({ kind: 'like', actor: SOFIA })).key).toBe('inbox.like')

    const many = notificationCopy(row({ kind: 'like', actor: SOFIA, count: 3 }))
    expect(many.key).toBe('inbox.likeOthers')
    // The plural selects on the number of *others*, never on the total — the
    // sentence already names the first one.
    expect(many.params).toEqual({ name: 'Sofia', count: 3 })
  })

  it('names nobody on a kind that has no actor', () => {
    expect(notificationCopy(row({ kind: 'walletPool', count: 40 })).params).toEqual({ count: 40 })
  })

  it('falls back to the handle when there is no display name', () => {
    const copy = notificationCopy(
      row({ kind: 'follow', actor: { handle: 'sofia', displayName: '' } }),
    )
    expect(copy.params).toEqual({ name: 'sofia' })
  })

  it('has a line for every kind there is', () => {
    for (const kind of IN_APP_NOTIFICATION_KINDS) {
      expect(notificationCopy(row({ kind, actor: SOFIA, count: 2 })).key).toMatch(/^inbox\./)
    }
  })
})

describe('stickyUnread', () => {
  it('remembers a row that arrived unread', () => {
    expect([...stickyUnread(new Set(), [row({ kind: 'follow', read: false })])]).toEqual(['n1'])
  })

  /**
   * The whole point. Opening the screen marks everything read and patches the
   * cache in the same breath, so a dot bound to `readAt` would blink out while
   * the reader was still looking at it.
   */
  it('keeps remembering once the server says it is read', () => {
    const first = stickyUnread(new Set(), [row({ kind: 'follow', read: false })])
    const second = stickyUnread(first, [row({ kind: 'follow', read: true })])
    expect([...second]).toEqual(['n1'])
  })

  it('never adds a row that was already read on arrival', () => {
    const seen = stickyUnread(new Set(), [row({ kind: 'follow', read: true })])
    expect(seen.size).toBe(0)
  })

  it('is idempotent, which is what makes it safe during render', () => {
    const items = [row({ kind: 'follow', read: false })]
    const once = stickyUnread(new Set(), items)
    expect([...stickyUnread(once, items)]).toEqual([...once])
  })
})

describe('markPagesRead', () => {
  it('stamps every loaded page, so coming back shows no dot', () => {
    const data = {
      pageParams: ['', 'c1'],
      pages: [{ items: [{ read: false }] }, { items: [{ read: false }] }],
    } as InfiniteData<{ items: { read: boolean }[] }>

    const next = markPagesRead(data)
    expect(next?.pages.flatMap((page) => page.items).every((item) => item.read)).toBe(true)
  })

  it('leaves an empty cache alone', () => {
    expect(markPagesRead(undefined)).toBeUndefined()
  })
})
