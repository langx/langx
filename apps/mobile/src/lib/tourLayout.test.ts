import { describe, expect, it } from 'vitest'
import { tourLayout } from './tourLayout'

const screen = { width: 390, height: 844 }
const insets = { top: 59, bottom: 34 }

describe('tourLayout', () => {
  it('grows the hole past the element so the ring does not clip it', () => {
    const { hole } = tourLayout({
      anchor: { x: 100, y: 200, width: 80, height: 40 },
      screen,
      insets,
    })
    expect(hole).toEqual({ x: 94, y: 194, width: 92, height: 52, radius: 0 })
  })

  it('keeps the hole inside the screen when the element touches an edge', () => {
    const { hole } = tourLayout({
      anchor: { x: 0, y: 0, width: screen.width, height: 30 },
      screen,
      insets,
    })
    expect(hole.x).toBe(0)
    expect(hole.y).toBe(0)
    expect(hole.x + hole.width).toBeLessThanOrEqual(screen.width)
  })

  /**
   * The dim is one bordered box whose hollow middle is the hole, so two things
   * have to hold: its border reaches past every edge of the screen, and the
   * inner radius the platform derives (`borderRadius - borderWidth`) is the
   * hole's own corner. Get the second wrong and the corners of the hole are
   * undimmed — which is exactly what four panels did.
   */
  it('covers everything but the hole, with the hole rounded as asked', () => {
    const { hole, mask, border } = tourLayout({
      anchor: { x: 40, y: 300, width: 120, height: 60 },
      screen,
      insets,
    })
    expect(mask.left + border.width).toBe(hole.x)
    expect(mask.top + border.width).toBe(hole.y)
    expect(mask.width - border.width * 2).toBe(hole.width)
    expect(mask.height - border.width * 2).toBe(hole.height)
    expect(border.radius - border.width).toBe(hole.radius)
    expect(mask.left).toBeLessThan(0)
    expect(mask.top).toBeLessThan(0)
    expect(mask.left + mask.width).toBeGreaterThan(screen.width)
    expect(mask.top + mask.height).toBeGreaterThan(screen.height)
  })

  it('is square unless the element asks for a corner, and bounds that to a pill', () => {
    const square = tourLayout({
      anchor: { x: 20, y: 700, width: 50, height: 50, radius: 999 },
      screen,
      insets,
    })
    // 50 + two 6-point pads is 62 across, so the pill's radius is 31.
    expect(square.hole.radius).toBe(31)

    const plain = tourLayout({ anchor: { x: 20, y: 300, width: 200, height: 40 }, screen, insets })
    expect(plain.hole.radius).toBe(0)
  })

  it('puts the bubble under an element in the top half', () => {
    const { hole, bubble } = tourLayout({
      anchor: { x: 20, y: 120, width: 200, height: 40 },
      screen,
      insets,
    })
    expect(bubble.placement).toBe('below')
    expect(bubble.top).toBe(hole.y + hole.height + 12)
    expect(bubble.bottom).toBeUndefined()
  })

  it('puts the bubble over an element in the bottom half', () => {
    const { bubble } = tourLayout({
      anchor: { x: 20, y: 700, width: 200, height: 40 },
      screen,
      insets,
    })
    expect(bubble.placement).toBe('above')
    expect(bubble.top).toBeUndefined()
    expect(bubble.bottom).toBeGreaterThan(0)
  })

  it('centres the bubble on the element but keeps it on screen', () => {
    const trailing = tourLayout({
      anchor: { x: 340, y: 120, width: 34, height: 34 },
      screen,
      insets,
    })
    expect(trailing.bubble.left).toBe(12)
    expect(trailing.bubble.left + trailing.bubble.width).toBeLessThanOrEqual(screen.width)

    const wide = tourLayout({
      anchor: { x: 400, y: 120, width: 40, height: 40 },
      screen: { width: 1200, height: 900 },
      insets,
    })
    // 420 wide, centred on 420 → its left edge lands at 210.
    expect(wide.bubble.width).toBe(420)
    expect(wide.bubble.left).toBe(210)
  })

  /** A bubble taller than the room it has scrolls; it never runs off the screen. */
  it('never offers a negative height to grow into', () => {
    for (const y of [0, 400, 843]) {
      const { bubble } = tourLayout({ anchor: { x: 0, y, width: 390, height: 1 }, screen, insets })
      expect(bubble.maxHeight).toBeGreaterThanOrEqual(0)
    }
  })
})
