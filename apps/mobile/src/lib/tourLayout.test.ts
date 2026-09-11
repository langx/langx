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
    expect(hole).toEqual({ x: 94, y: 194, width: 92, height: 52 })
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

  /** Four panels, no gaps, nothing negative — the dim has to be a dim. */
  it('covers everything but the hole', () => {
    const { hole, panels } = tourLayout({
      anchor: { x: 40, y: 300, width: 120, height: 60 },
      screen,
      insets,
    })
    for (const panel of panels) {
      expect(panel.width).toBeGreaterThanOrEqual(0)
      expect(panel.height).toBeGreaterThanOrEqual(0)
    }
    const [top, bottom, left, right] = panels
    expect(top!.height).toBe(hole.y)
    expect(bottom!.y).toBe(hole.y + hole.height)
    expect(bottom!.y + bottom!.height).toBe(screen.height)
    expect(left!.width).toBe(hole.x)
    expect(right!.x).toBe(hole.x + hole.width)
    expect(right!.x + right!.width).toBe(screen.width)
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
