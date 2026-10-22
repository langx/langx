import type { FeedPost } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { findFeedPost } from './postFromFeed'

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
