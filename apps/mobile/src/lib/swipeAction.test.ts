import { describe, expect, it } from 'vitest'
import {
  ACTION_ACTIVATE_PX,
  ACTION_LOCK_PX,
  ACTION_MAX_PX,
  rowReleased,
  rowSwipeEnabled,
  rowTranslation,
  shouldCaptureRowSwipe,
} from './swipeAction'

describe('shouldCaptureRowSwipe', () => {
  it('ignores movement that has not committed yet', () => {
    expect(shouldCaptureRowSwipe(ACTION_LOCK_PX, 0)).toBe(false)
    expect(shouldCaptureRowSwipe(-ACTION_LOCK_PX, 0)).toBe(false)
  })

  it('takes a clear horizontal drag either way', () => {
    expect(shouldCaptureRowSwipe(40, 5)).toBe(true)
    expect(shouldCaptureRowSwipe(-40, 5)).toBe(true)
  })

  /**
   * The whole answer to "why does the list not scroll any more". A flick down a
   * long list is never perfectly vertical.
   */
  it('leaves a diagonal flick to the list', () => {
    expect(shouldCaptureRowSwipe(30, 30)).toBe(false)
    expect(shouldCaptureRowSwipe(-30, 25)).toBe(false)
  })
})

describe('rowTranslation', () => {
  it('follows the finger up to the limit, in both directions', () => {
    expect(rowTranslation(50)).toBe(50)
    expect(rowTranslation(-50)).toBe(-50)
    expect(rowTranslation(ACTION_MAX_PX)).toBe(ACTION_MAX_PX)
  })

  it('resists past the limit rather than stopping dead', () => {
    const over = rowTranslation(ACTION_MAX_PX + 100)
    expect(over).toBeGreaterThan(ACTION_MAX_PX)
    expect(over).toBeLessThan(ACTION_MAX_PX + 100)
    expect(rowTranslation(-(ACTION_MAX_PX + 100))).toBe(-over)
  })
})

describe('rowReleased', () => {
  it('names the direction once it has gone far enough', () => {
    expect(rowReleased(ACTION_ACTIVATE_PX)).toBe('right')
    expect(rowReleased(-ACTION_ACTIVATE_PX)).toBe('left')
  })

  /** A short swipe springs back and does nothing — no accidental archiving. */
  it('is null for a swipe that stopped short', () => {
    expect(rowReleased(ACTION_ACTIVATE_PX - 1)).toBeNull()
    expect(rowReleased(-(ACTION_ACTIVATE_PX - 1))).toBeNull()
    expect(rowReleased(0)).toBeNull()
  })
})

describe('rowSwipeEnabled', () => {
  it('is on natively and on a touchscreen browser', () => {
    expect(rowSwipeEnabled('ios', false)).toBe(true)
    expect(rowSwipeEnabled('android', false)).toBe(true)
    expect(rowSwipeEnabled('web', true)).toBe(true)
  })

  /** A mouse drag across a row is also text selection; the two fight. */
  it('is off in a browser driven by a mouse', () => {
    expect(rowSwipeEnabled('web', false)).toBe(false)
  })
})
