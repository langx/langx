import { IN_APP_NOTIFICATION_KINDS } from '@langx/shared'
import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  markPagesRead,
  notificationCopy,
  notificationHref,
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
  it('words one person and a collapsed pile differently', () => {
    for (const kind of ['like', 'postComment', 'postCorrection', 'pronunciationAnswer'] as const) {
      expect(notificationCopy(row({ kind, actor: SOFIA })).key, kind).toBe(`inbox.${kind}`)

      const many = notificationCopy(row({ kind, actor: SOFIA, count: 3 }))
      expect(many.key, kind).toBe(`inbox.${kind}Others`)
      // The plural selects on the number of *others*, never on the total —
      // the sentence already names the first one.
      expect(many.params, kind).toEqual({ name: 'Sofia', count: 3 })
    }
  })

  /**
   * The server sends `count` only when somebody else joined the pile, so a
   * zero should never arrive — but if one did, "and 0 others" is the sentence
   * it would produce, and English has no plural category that avoids it.
   */
  it('treats a zero count as nobody else', () => {
    expect(notificationCopy(row({ kind: 'like', actor: SOFIA, count: 0 })).key).toBe('inbox.like')
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

describe('markPagesRead', () => {
  const twoPages = () =>
    ({
      pageParams: ['', 'c1'],
      pages: [{ items: [{ _id: 'a', read: false }] }, { items: [{ _id: 'b', read: false }] }],
    }) as InfiniteData<{ items: { _id: string; read: boolean }[] }>

  const flat = (data: ReturnType<typeof twoPages> | undefined) =>
    data?.pages.flatMap((page) => page.items) ?? []

  it('stamps every loaded page when the button was pressed', () => {
    expect(flat(markPagesRead(twoPages())).every((item) => item.read)).toBe(true)
  })

  /**
   * A tap is not the button. Clearing the rest of the list because somebody
   * opened one row is the behaviour this whole design exists to avoid.
   */
  it('stamps only the row that was opened', () => {
    const next = flat(markPagesRead(twoPages(), 'b'))
    expect(next.find((item) => item._id === 'b')?.read).toBe(true)
    expect(next.find((item) => item._id === 'a')?.read).toBe(false)
  })

  it('leaves an empty cache alone', () => {
    expect(markPagesRead(undefined)).toBeUndefined()
  })
})
