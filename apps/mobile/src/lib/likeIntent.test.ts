import { describe, expect, it } from 'vitest'
import {
  catchUpLike,
  IDLE_LIKE,
  settleLike,
  shownCount,
  shownLiked,
  tapLike,
  type LikeIntent,
} from './likeIntent'

describe('likeIntent', () => {
  it('follows the props while idle', () => {
    expect(shownLiked(IDLE_LIKE, true)).toBe(true)
    expect(shownCount(IDLE_LIKE, true, 4)).toBe(4)
  })

  it('fills the heart and counts the like at once, and sends it', () => {
    const step = tapLike(IDLE_LIKE, false)
    expect(step.send).toBe(true)
    expect(shownLiked(step.intent, false)).toBe(true)
    expect(shownCount(step.intent, false, 4)).toBe(5)
  })

  it('never shows a negative count', () => {
    const step = tapLike(IDLE_LIKE, true)
    expect(shownCount(step.intent, true, 0)).toBe(0)
  })

  it('sends nothing for taps while a request is out', () => {
    const first = tapLike(IDLE_LIKE, false)
    const second = tapLike(first.intent, false)
    expect(second.send).toBeNull()
    expect(shownLiked(second.intent, false)).toBe(false)
  })

  it('re-sends the last wish when the server recorded an earlier one', () => {
    // like, then unlike before the like came back
    const first = tapLike(IDLE_LIKE, false)
    const second = tapLike(first.intent, false)
    const settled = settleLike(second.intent, true)
    expect(settled.send).toBe(false)
    expect(settled.intent.inFlight).toBe(true)
    // the follow-up lands where the last tap left it
    const done = settleLike(settled.intent, false)
    expect(done.send).toBeNull()
    expect(done.intent.inFlight).toBe(false)
  })

  it('sends nothing more when a burst ends where the server already is', () => {
    // like, unlike, like: the first request recorded the like
    let intent: LikeIntent = tapLike(IDLE_LIKE, false).intent
    intent = tapLike(intent, false).intent
    intent = tapLike(intent, false).intent
    const settled = settleLike(intent, true)
    expect(settled.send).toBeNull()
    expect(shownLiked(settled.intent, false)).toBe(true)
  })

  it('springs back to the props when the request fails', () => {
    const step = tapLike(IDLE_LIKE, false)
    const failed = settleLike(step.intent, null)
    expect(failed.intent).toEqual(IDLE_LIKE)
    expect(shownLiked(failed.intent, false)).toBe(false)
  })

  it('hands back to the props once they agree and nothing is out', () => {
    const settled = settleLike(tapLike(IDLE_LIKE, false).intent, true).intent
    // props not caught up yet: keep the wish
    expect(catchUpLike(settled, false)).toBe(settled)
    // props caught up
    expect(catchUpLike(settled, true)).toEqual(IDLE_LIKE)
    // still in flight: keep it even if the props happen to agree
    const flying = tapLike(IDLE_LIKE, false).intent
    expect(catchUpLike(flying, true)).toBe(flying)
  })

  it('still sends the follow-up when the settle arrives after the button has gone', () => {
    // like, then unlike, then the card scrolls away before the like is answered:
    // the settle runs from the ref with nothing mounted, and must still undo it
    const first = tapLike(IDLE_LIKE, false)
    const second = tapLike(first.intent, false)
    const settled = settleLike(second.intent, true)
    expect(settled.send).toBe(false)
    const done = settleLike(settled.intent, false)
    expect(done.send).toBeNull()
    expect(done.intent).toEqual({ desired: false, inFlight: false })
  })
})
