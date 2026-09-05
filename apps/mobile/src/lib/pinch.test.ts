import { describe, expect, it } from 'vitest'
import {
  DOUBLE_TAP_MS,
  MAX_SCALE,
  MIN_SCALE,
  PAGE_SWIPE_PX,
  PAGE_SWIPE_VX,
  TAP_SLOP_PX,
  clampOffset,
  clampScale,
  distanceBetween,
  fittedSize,
  isDoubleTap,
  midpointOf,
  offsetForFocus,
  swipeStep,
} from './pinch'

const FRAME = { width: 400, height: 800 }

describe('distanceBetween / midpointOf', () => {
  it('measures the spread of two fingers', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('is zero for two fingers in the same place', () => {
    expect(distanceBetween({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0)
  })

  it('finds the point between them', () => {
    expect(midpointOf({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })
})

describe('clampScale', () => {
  it('holds the picture between its two limits', () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE)
    expect(clampScale(2.5)).toBe(2.5)
    expect(clampScale(99)).toBe(MAX_SCALE)
  })

  /** Two fingers landing in the same pixel divide by zero somewhere upstream. */
  it('falls back to life size rather than passing NaN into a transform', () => {
    expect(clampScale(Number.NaN)).toBe(MIN_SCALE)
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(MIN_SCALE)
  })
})

describe('fittedSize', () => {
  it('letterboxes a tall picture in a wide frame', () => {
    expect(fittedSize({ width: 100, height: 400 }, { width: 400, height: 800 })).toEqual({
      width: 200,
      height: 800,
    })
  })

  it('pillarboxes a wide picture in a tall frame', () => {
    expect(fittedSize({ width: 400, height: 100 }, FRAME)).toEqual({ width: 400, height: 100 })
  })

  /** `onLoad` has not landed yet, or the decode failed. */
  it('falls back to the frame when the natural size is unknown', () => {
    expect(fittedSize({ width: 0, height: 0 }, FRAME)).toEqual(FRAME)
  })
})

describe('clampOffset', () => {
  const content = { width: 400, height: 400 }

  it('pins the picture still while it fits', () => {
    expect(clampOffset({ x: 50, y: 50 }, 1, FRAME, content)).toEqual({ x: 0, y: 0 })
  })

  /**
   * At 2x a 400-wide picture is 800 wide in a 400 frame, so 400 hangs off —
   * 200 each side, and not one pixel further.
   */
  it('allows exactly the part that is off-screen', () => {
    expect(clampOffset({ x: 999, y: 0 }, 2, FRAME, content)).toEqual({ x: 200, y: 0 })
    expect(clampOffset({ x: -999, y: 0 }, 2, FRAME, content)).toEqual({ x: -200, y: 0 })
  })

  /** The axis that still fits stays locked even while the other one moves. */
  it('locks the axis that has not overflowed', () => {
    expect(clampOffset({ x: 999, y: 999 }, 2, FRAME, { width: 400, height: 100 })).toEqual({
      x: 200,
      y: 0,
    })
  })

  it('leaves an offset inside the bounds alone', () => {
    expect(clampOffset({ x: 40, y: -30 }, 3, FRAME, content)).toEqual({ x: 40, y: -30 })
  })

  /**
   * A square picture at 2x is exactly as tall as this frame, so there is
   * nothing hanging off the top or bottom to drag into view — the axis is
   * locked even though the picture is zoomed.
   */
  it('locks an axis that zooming filled exactly', () => {
    expect(clampOffset({ x: 0, y: -30 }, 2, FRAME, content).y).toBe(0)
  })
})

describe('offsetForFocus', () => {
  it('is no movement at all when the tap was the centre', () => {
    expect(offsetForFocus({ x: 0, y: 0 }, 2)).toEqual({ x: 0, y: 0 })
  })

  /**
   * The point the finger is on has to end up where the finger still is: at 2x
   * a point 100 right of centre would be drawn 200 right, so the picture moves
   * 100 back the other way.
   */
  it('walks the tapped point back under the finger', () => {
    expect(offsetForFocus({ x: 100, y: -50 }, 2)).toEqual({ x: -100, y: 50 })
  })

  it('is no movement at life size', () => {
    expect(offsetForFocus({ x: 100, y: 100 }, 1)).toEqual({ x: 0, y: 0 })
  })
})

describe('isDoubleTap', () => {
  it('is the second tap soon after the first', () => {
    expect(isDoubleTap({ at: 1000 }, 1000 + DOUBLE_TAP_MS, 0)).toBe(true)
  })

  it('is not a first tap', () => {
    expect(isDoubleTap(null, 1000, 0)).toBe(false)
  })

  it('is not a tap that came too late', () => {
    expect(isDoubleTap({ at: 1000 }, 1000 + DOUBLE_TAP_MS + 1, 0)).toBe(false)
  })

  /** A drag that happens to end near where it started is still a drag. */
  it('is not a gesture that travelled', () => {
    expect(isDoubleTap({ at: 1000 }, 1100, TAP_SLOP_PX + 1)).toBe(false)
  })
})

describe('swipeStep', () => {
  it('pages forward on a drag to the left', () => {
    expect(swipeStep(-PAGE_SWIPE_PX, 0, 0)).toBe(1)
  })

  it('pages back on a drag to the right', () => {
    expect(swipeStep(PAGE_SWIPE_PX, 5, 0)).toBe(-1)
  })

  it('accepts a short flick when it is fast enough', () => {
    expect(swipeStep(-20, 0, -PAGE_SWIPE_VX)).toBe(1)
  })

  it('ignores a short, slow nudge', () => {
    expect(swipeStep(PAGE_SWIPE_PX - 1, 0, PAGE_SWIPE_VX / 2)).toBe(0)
  })

  /** A diagonal belongs to the dismissal, which reads the vertical axis. */
  it('ignores a drag that is more vertical than sideways', () => {
    expect(swipeStep(-80, 90, -1)).toBe(0)
  })
})
