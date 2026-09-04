import { describe, expect, it } from 'vitest'
import {
  SWIPE_ACTIVATE_PX,
  SWIPE_MAX_PX,
  swipeReleased,
  swipeToReplyEnabled,
  swipeTranslation,
} from './swipeToReply'

describe('swipeTranslation', () => {
  it('follows the finger up to the limit', () => {
    expect(swipeTranslation(40)).toBe(40)
    expect(swipeTranslation(SWIPE_MAX_PX)).toBe(SWIPE_MAX_PX)
  })

  it('resists past it rather than stopping dead', () => {
    const overshoot = swipeTranslation(SWIPE_MAX_PX + 100)
    expect(overshoot).toBeGreaterThan(SWIPE_MAX_PX)
    expect(overshoot).toBeLessThan(SWIPE_MAX_PX + 100)
  })

  it('does not follow a leftward drag', () => {
    expect(swipeTranslation(-30)).toBe(0)
  })
})

describe('swipeReleased', () => {
  it('fires at the activation distance and not before', () => {
    expect(swipeReleased(SWIPE_ACTIVATE_PX - 1)).toBe(false)
    expect(swipeReleased(SWIPE_ACTIVATE_PX)).toBe(true)
  })
})

describe('swipeToReplyEnabled', () => {
  it('is on wherever there is a finger', () => {
    expect(swipeToReplyEnabled('ios', true)).toBe(true)
    expect(swipeToReplyEnabled('android', true)).toBe(true)
    expect(swipeToReplyEnabled('web', true)).toBe(true)
  })

  /** A phone always has one; the flag is only ever consulted on the web. */
  it('is on natively even when the touch flag says otherwise', () => {
    expect(swipeToReplyEnabled('ios', false)).toBe(true)
  })

  it('is off in a browser driven by a mouse, where it would fight text selection', () => {
    expect(swipeToReplyEnabled('web', false)).toBe(false)
  })
})
