import { describe, expect, it } from 'vitest'
import {
  MAX_OVERZOOM,
  MAX_SCALE,
  MIN_OVERZOOM,
  MIN_SCALE,
  OVERSCROLL_RESISTANCE,
  PAGE_SWIPE_PX,
  PAGE_SWIPE_VX,
  albumSlots,
  clampOffset,
  clampScale,
  fittedSize,
  offsetForFocus,
  resist,
  resistScaleChange,
  settleZoom,
  swipeStep,
  zoomAbout,
} from './pinch'

const FRAME = { width: 400, height: 800 }

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

describe('zoomAbout', () => {
  /** Where a point of the picture is drawn, measured from the frame's centre. */
  function drawnAt(
    point: { x: number; y: number },
    offset: { x: number; y: number },
    scale: number,
  ) {
    return { x: offset.x + point.x * scale, y: offset.y + point.y * scale }
  }

  it('matches offsetForFocus for a pinch that starts at life size', () => {
    const focus = { x: 100, y: -50 }
    const { offset, scale } = zoomAbout({ x: 0, y: 0 }, 1, focus, 2)
    expect(scale).toBe(2)
    expect(offset).toEqual(offsetForFocus(focus, 2))
  })

  /**
   * The regression: a second pinch on a picture already zoomed and panned used
   * to recompute the offset from the focus alone and jump. The content point
   * under the fingers when the pinch began has to stay under them.
   */
  it('keeps the pinched point under the fingers on an already-zoomed picture', () => {
    const start = { offset: { x: -120, y: 80 }, scale: 2 }
    const focus = { x: 60, y: -300 }
    const underFingers = {
      x: (focus.x - start.offset.x) / start.scale,
      y: (focus.y - start.offset.y) / start.scale,
    }
    let state = start
    for (const change of [1.05, 1.1, 1.02, 0.97, 1.2]) {
      state = zoomAbout(state.offset, state.scale, focus, change)
      const drawn = drawnAt(underFingers, state.offset, state.scale)
      expect(drawn.x).toBeCloseTo(focus.x)
      expect(drawn.y).toBeCloseTo(focus.y)
    }
  })

  it('does not move the picture when the spread does not change', () => {
    expect(zoomAbout({ x: -40, y: 25 }, 2, { x: 150, y: 150 }, 1)).toEqual({
      offset: { x: -40, y: 25 },
      scale: 2,
    })
  })

  it('stops at the overzoom limits either way', () => {
    expect(zoomAbout({ x: 0, y: 0 }, MAX_OVERZOOM, { x: 0, y: 0 }, 2).scale).toBe(MAX_OVERZOOM)
    expect(zoomAbout({ x: 0, y: 0 }, MIN_OVERZOOM, { x: 0, y: 0 }, 0.5).scale).toBe(MIN_OVERZOOM)
  })

  it('ignores a change that is not a real spread', () => {
    const before = { offset: { x: 10, y: 10 }, scale: 2 }
    expect(zoomAbout(before.offset, before.scale, { x: 0, y: 0 }, Number.NaN)).toEqual(before)
    expect(zoomAbout(before.offset, before.scale, { x: 0, y: 0 }, 0)).toEqual(before)
  })
})

describe('resistScaleChange', () => {
  it('passes a change through inside the limits', () => {
    expect(resistScaleChange(2, 1.1)).toBe(1.1)
  })

  it('damps a pinch that pushes further past a limit', () => {
    expect(resistScaleChange(MAX_SCALE + 0.5, 1.1)).toBeCloseTo(1 + 0.1 * OVERSCROLL_RESISTANCE)
    expect(resistScaleChange(MIN_SCALE - 0.2, 0.9)).toBeCloseTo(1 - 0.1 * OVERSCROLL_RESISTANCE)
  })

  it('lets a pinch heading back inside go at full speed', () => {
    expect(resistScaleChange(MAX_SCALE + 0.5, 0.9)).toBe(0.9)
    expect(resistScaleChange(MIN_SCALE - 0.2, 1.1)).toBe(1.1)
  })
})

describe('resist', () => {
  it('passes a drag through inside the limit', () => {
    expect(resist(50, 10, 100)).toBe(10)
    expect(resist(-50, -10, 100)).toBe(-10)
  })

  it('damps a drag that pushes further past the edge', () => {
    expect(resist(100, 10, 100)).toBeCloseTo(10 * OVERSCROLL_RESISTANCE)
    expect(resist(-130, -10, 100)).toBeCloseTo(-10 * OVERSCROLL_RESISTANCE)
  })

  it('lets a drag back towards the middle go at full speed', () => {
    expect(resist(130, -10, 100)).toBe(-10)
  })

  /** A letterboxed axis has a limit of zero, and still gives a little. */
  it('gives, rather than stops, on an axis that cannot move at all', () => {
    expect(resist(0, 10, 0)).toBeCloseTo(10 * OVERSCROLL_RESISTANCE)
  })
})

describe('settleZoom', () => {
  const content = { width: 400, height: 300 }

  it('comes back to dead centre from a pinch below life size', () => {
    expect(settleZoom({ x: 30, y: -20 }, 0.7, FRAME, content)).toEqual({
      scale: MIN_SCALE,
      offset: { x: 0, y: 0 },
    })
  })

  it('comes back down to the largest scale, shrinking about the centre', () => {
    const settled = settleZoom({ x: -500, y: 0 }, MAX_SCALE * 1.25, FRAME, content)
    expect(settled.scale).toBe(MAX_SCALE)
    expect(settled.offset.x).toBeCloseTo(-400)
  })

  it('pulls a picture dragged past its edge back against it', () => {
    // At 2x the 400-wide picture is 800 wide in a 400 frame: 200 each way.
    expect(settleZoom({ x: 260, y: 90 }, 2, FRAME, content)).toEqual({
      scale: 2,
      offset: { x: 200, y: 0 },
    })
  })

  it('leaves a picture at rest where it is', () => {
    expect(settleZoom({ x: -120, y: 0 }, 2, FRAME, content)).toEqual({
      scale: 2,
      offset: { x: -120, y: 0 },
    })
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

describe('albumSlots', () => {
  it('leaves a single picture without neighbours', () => {
    expect(albumSlots(0, 1).map((slot) => slot.at)).toEqual([null, 0, null])
  })

  it('wraps at both ends of the album', () => {
    expect(albumSlots(0, 6).map((slot) => slot.at)).toEqual([5, 0, 1])
    expect(albumSlots(5, 6).map((slot) => slot.at)).toEqual([4, 5, 0])
    expect(albumSlots(2, 6).map((slot) => slot.at)).toEqual([1, 2, 3])
  })

  it('keys a slot by the picture in it, so a turn moves the view', () => {
    expect(albumSlots(2, 6).map((slot) => slot.key)).toEqual(['1', '2', '3'])
  })

  it('never hands out the same key twice, even when both neighbours are one picture', () => {
    for (const total of [1, 2, 3, 6]) {
      for (let index = 0; index < total; index += 1) {
        const keys = albumSlots(index, total).map((slot) => slot.key)
        expect(new Set(keys).size).toBe(3)
      }
    }
    expect(albumSlots(0, 2).map((slot) => slot.at)).toEqual([1, 0, 1])
    expect(albumSlots(0, 2)[2]?.key).toBe('1')
  })
})
