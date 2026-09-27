import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { CommentRepliesPage, ThreadedComment, ThreadedCommentsPage } from '../api/types'
import {
  appendReply,
  appendToReplies,
  hiddenReplyCount,
  removeFromReplies,
  removeFromThread,
  repliesToShow,
  replyDraftFor,
} from './commentThread'

const SOFIA = { _id: 'u1', handle: 'sofia', displayName: 'Sofia' }
const DENIZ = { _id: 'u2', handle: 'deniz', displayName: 'Deniz' }

function comment(
  id: string,
  minute: number,
  overrides: Partial<ThreadedComment> = {},
): ThreadedComment {
  return {
    _id: id,
    author: SOFIA,
    body: `comment ${id}`,
    createdAt: `2026-09-27T10:${String(minute).padStart(2, '0')}:00.000Z`,
    ...overrides,
  }
}

function roots(...items: ThreadedComment[]): InfiniteData<ThreadedCommentsPage> {
  return { pages: [{ items, nextCursor: null }], pageParams: [''] }
}

function replies(
  items: ThreadedComment[],
  nextCursor: string | null = null,
): InfiniteData<CommentRepliesPage> {
  return { pages: [{ items, nextCursor }], pageParams: [''] }
}

describe('appendReply', () => {
  it('puts a reply under its root and counts it', () => {
    const root = comment('r1', 0, { replyCount: 0, replies: [] })
    const reply = comment('c1', 5, { parentId: 'r1' })
    const next = appendReply(roots(root), 'r1', reply)
    expect(next?.pages[0]?.items[0]?.replies).toEqual([reply])
    expect(next?.pages[0]?.items[0]?.replyCount).toBe(1)
  })

  it('does not draw the same reply twice', () => {
    const reply = comment('c1', 5, { parentId: 'r1' })
    const root = comment('r1', 0, { replyCount: 1, replies: [reply] })
    const data = roots(root)
    expect(appendReply(data, 'r1', reply)).toBe(data)
  })

  it('leaves a cache without that root untouched', () => {
    const data = roots(comment('r1', 0))
    expect(appendReply(data, 'r9', comment('c1', 5))).toBe(data)
    expect(appendReply(undefined, 'r1', comment('c1', 5))).toBeUndefined()
  })
})

describe('appendToReplies', () => {
  it('adds to a fully loaded list', () => {
    const next = appendToReplies(replies([comment('c1', 1)]), comment('c2', 2))
    expect(next?.pages[0]?.items.map((item) => item._id)).toEqual(['c1', 'c2'])
  })

  it('waits for the last page when there is more to load', () => {
    // The reply is newer than every row still to come, so it arrives by itself.
    const data = replies([comment('c1', 1)], 'cursor')
    expect(appendToReplies(data, comment('c2', 2))).toBe(data)
  })
})

describe('removeFromThread', () => {
  it('turns a root with replies into a tombstone, keeping the replies', () => {
    const reply = comment('c1', 5, { parentId: 'r1' })
    const next = removeFromThread(
      roots(comment('r1', 0, { replyCount: 1, replies: [reply] })),
      'r1',
    )
    const root = next?.pages[0]?.items[0]
    expect(root?.deleted).toBe(true)
    expect(root?.replies).toEqual([reply])
  })

  it('removes a root with no replies outright', () => {
    const next = removeFromThread(
      roots(comment('r1', 0, { replyCount: 0 }), comment('r2', 1)),
      'r1',
    )
    expect(next?.pages[0]?.items.map((item) => item._id)).toEqual(['r2'])
  })

  it('takes a reply off its root and counts one fewer', () => {
    const a = comment('c1', 5, { parentId: 'r1' })
    const b = comment('c2', 6, { parentId: 'r1' })
    const next = removeFromThread(
      roots(comment('r1', 0, { replyCount: 3, replies: [a, b] })),
      'c1',
      'r1',
    )
    expect(next?.pages[0]?.items[0]?.replies).toEqual([b])
    expect(next?.pages[0]?.items[0]?.replyCount).toBe(2)
  })

  it('takes a tombstone with it when its last reply goes', () => {
    const a = comment('c1', 5, { parentId: 'r1' })
    const tomb = comment('r1', 0, { deleted: true, body: '', replyCount: 1, replies: [a] })
    const next = removeFromThread(roots(tomb, comment('r2', 1)), 'c1', 'r1')
    expect(next?.pages[0]?.items.map((item) => item._id)).toEqual(['r2'])
  })

  it('counts a reply beyond the preview, which is not in these pages', () => {
    const next = removeFromThread(
      roots(comment('r1', 0, { replyCount: 5, replies: [] })),
      'c9',
      'r1',
    )
    expect(next?.pages[0]?.items[0]?.replyCount).toBe(4)
  })
})

describe('removeFromReplies', () => {
  it('drops the row from an expanded list', () => {
    const next = removeFromReplies(replies([comment('c1', 1), comment('c2', 2)]), 'c1')
    expect(next?.pages[0]?.items.map((item) => item._id)).toEqual(['c2'])
  })
})

describe('repliesToShow and hiddenReplyCount', () => {
  const a = comment('c1', 1, { parentId: 'r1' })
  const b = comment('c2', 2, { parentId: 'r1' })
  const c = comment('c3', 3, { parentId: 'r1' })
  const mine = comment('c9', 9, { parentId: 'r1' })

  it('shows the preview until the root is expanded', () => {
    const root = comment('r1', 0, { replyCount: 4, replies: [a, b] })
    expect(repliesToShow(root, undefined)).toEqual([a, b])
    expect(hiddenReplyCount(root, 2)).toBe(2)
  })

  it('merges a reply just sent into the expanded list, oldest first', () => {
    const root = comment('r1', 0, { replyCount: 4, replies: [a, b, mine] })
    expect(repliesToShow(root, [a, b, c]).map((reply) => reply._id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c9',
    ])
  })

  it('never promises a negative number', () => {
    expect(hiddenReplyCount(comment('r1', 0, { replyCount: 1 }), 3)).toBe(0)
    // A flat read from an API without replies: no count, no preview.
    expect(hiddenReplyCount(comment('r1', 0), 0)).toBe(0)
  })
})

describe('replyDraftFor', () => {
  it('answers a root under itself, with no prefix', () => {
    expect(replyDraftFor(comment('r1', 0))).toEqual({ rootId: 'r1', prefill: '' })
  })

  it('answers a reply under the same root, naming who it answers', () => {
    expect(replyDraftFor(comment('c1', 1, { parentId: 'r1', author: DENIZ }))).toEqual({
      rootId: 'r1',
      prefill: '@deniz ',
    })
  })
})
