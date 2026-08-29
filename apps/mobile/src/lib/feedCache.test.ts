import type { InfiniteData } from '@tanstack/react-query'
import type { FeedPage, FeedPost, PostCorrection } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { applyCorrection } from './feedCache'

const author = { _id: 'u2', handle: 'teacher', displayName: 'Teacher' }

function correction(id: string): PostCorrection {
  return { _id: id, author, corrected: 'Yo tengo hambre.', createdAt: '2026-08-29T12:00:00.000Z' }
}

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    _id: 'p1',
    author: { _id: 'u1', handle: 'learner', displayName: 'Learner' },
    body: 'Yo tener hambre.',
    language: 'es',
    level: 'intermediate',
    correctionCount: 0,
    topCorrection: null,
    correctedByViewer: false,
    createdAt: '2026-08-29T11:00:00.000Z',
    ...overrides,
  }
}

function pages(...items: FeedPost[][]): InfiniteData<FeedPage> {
  return {
    pages: items.map((page) => ({ items: page, nextCursor: null })),
    pageParams: items.map(() => ''),
  }
}

describe('applyCorrection', () => {
  it('counts the correction and marks the post answered by the viewer', () => {
    const patched = applyCorrection(pages([post()]), 'p1', correction('c1'))
    const first = patched?.pages[0]?.items[0]
    expect(first?.correctionCount).toBe(1)
    expect(first?.correctedByViewer).toBe(true)
  })

  it('fills topCorrection only when the post had no answer', () => {
    const fresh = applyCorrection(pages([post()]), 'p1', correction('c1'))
    expect(fresh?.pages[0]?.items[0]?.topCorrection?._id).toBe('c1')

    // The top correction is the oldest, and somebody already answered — yours
    // is not it.
    const answered = pages([post({ correctionCount: 1, topCorrection: correction('c0') })])
    const patched = applyCorrection(answered, 'p1', correction('c1'))
    expect(patched?.pages[0]?.items[0]?.topCorrection?._id).toBe('c0')
    expect(patched?.pages[0]?.items[0]?.correctionCount).toBe(2)
  })

  it('patches a post on a later page', () => {
    const patched = applyCorrection(pages([post()], [post({ _id: 'p2' })]), 'p2', correction('c1'))
    expect(patched?.pages[1]?.items[0]?.correctionCount).toBe(1)
    expect(patched?.pages[0]?.items[0]?.correctionCount).toBe(0)
  })

  it('returns the identical object when the post is not loaded', () => {
    // Identity, not equality: a new object here re-renders every card in the
    // list for a post that is not even on screen.
    const data = pages([post()])
    expect(applyCorrection(data, 'missing', correction('c1'))).toBe(data)
    expect(applyCorrection(undefined, 'p1', correction('c1'))).toBeUndefined()
  })
})
