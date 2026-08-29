import { describe, expect, it } from 'vitest'
import {
  SWIPE_ACTIVATE_PX,
  SWIPE_MAX_PX,
  shouldCaptureSwipe,
  swipeReleased,
  swipeTranslation,
} from './swipeToReply'

describe('shouldCaptureSwipe', () => {
  it('ignores movement too small to have a direction yet', () => {
    expect(shouldCaptureSwipe(4, 0)).toBe(false)
  })

  it('takes a clearly horizontal drag to the right', () => {
    expect(shouldCaptureSwipe(40, 5)).toBe(true)
  })

  /** The case that decides whether the thread still scrolls. */
  it('leaves a diagonal flick to the list', () => {
    expect(shouldCaptureSwipe(30, 25)).toBe(false)
    expect(shouldCaptureSwipe(30, -25)).toBe(false)
  })

  it('never captures a leftward drag', () => {
    expect(shouldCaptureSwipe(-40, 2)).toBe(false)
  })
})

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
