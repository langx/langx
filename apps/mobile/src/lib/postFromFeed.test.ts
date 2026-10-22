import type { FeedPost } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { findFeedPost, postGone, postOnScreen } from './postFromFeed'

const post = (id: string) => ({ _id: id, body: id }) as unknown as FeedPost

describe('findFeedPost', () => {
  it('finds a post on any page of any list', () => {
    const wanted = post('b2')
    const entries = [
      [['feed', 'timeline'], { pages: [{ items: [post('a1')] }, { items: [wanted] }] }],
      [['feed', 'mine'], { pages: [{ items: [post('c1')] }] }],
    ] as const
    expect(findFeedPost(entries, 'b2')).toBe(wanted)
  })

  it('returns the first copy when two lists hold the post', () => {
    const first = post('x')
    const second = post('x')
    const entries = [
      [['feed', 'timeline'], { pages: [{ items: [first] }] }],
      [['feed', 'mine'], { pages: [{ items: [second] }] }],
    ] as const
    expect(findFeedPost(entries, 'x')).toBe(first)
  })

  it('is undefined when no list holds it', () => {
    expect(findFeedPost([[['feed'], { pages: [{ items: [post('a')] }] }]], 'z')).toBeUndefined()
    expect(findFeedPost([], 'z')).toBeUndefined()
  })

  it('skips entries that are not infinite feed pages', () => {
    const wanted = post('y')
    const entries = [
      [['feed', 'old'], undefined],
      [['feed', 'odd'], { pages: 'nope' }],
      [['feed', 'odder'], { pages: [null, { items: 3 }, { items: [null] }] }],
      [['feed', 'timeline'], { pages: [{ items: [wanted] }] }],
    ] as const
    expect(findFeedPost(entries, 'y')).toBe(wanted)
  })
})

describe('postOnScreen', () => {
  const fetched = post('p1')
  const fromFeed = post('p1')

  it('draws the post’s own answer over the feed’s copy', () => {
    expect(postOnScreen(fetched, fromFeed, false)).toBe(fetched)
  })

  it('draws the feed’s copy while the post’s own answer is on its way', () => {
    expect(postOnScreen(undefined, fromFeed, false)).toBe(fromFeed)
  })

  it('draws nothing once the post is gone, even with its own answer cached', () => {
    // Opened once, deleted by its author, reopened: the refetch 404s and
    // keeps the old answer.
    expect(postOnScreen(fetched, fromFeed, true)).toBeUndefined()
  })
})

describe('postGone', () => {
  const opened = 1_000
  const notFound = 2_000

  it('is gone while the latest answer is a 404', () => {
    expect(postGone(true, notFound, opened)).toBe(true)
  })

  /**
   * The 404 is the latest error only until the next refetch fails for some
   * other reason — a tunnel, a 503 — and then the cached answer from before
   * the deletion was drawn as the live post again.
   */
  it('stays gone when a later refetch fails for another reason', () => {
    expect(postGone(false, notFound, opened)).toBe(true)
  })

  it('is back once the post answers again after its 404', () => {
    expect(postGone(false, notFound, 3_000)).toBe(false)
  })

  it('is not gone when it never answered 404', () => {
    expect(postGone(false, undefined, opened)).toBe(false)
  })
})
