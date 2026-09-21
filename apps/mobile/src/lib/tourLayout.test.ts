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
   * Two things have to hold of the four panels, and neither survives being
   * reasoned about: every point outside the hole is covered, and no point is
   * covered twice. The second is the one that bites — the dim is translucent,
   * so an overlap is a visibly darker seam rather than a harmless mistake.
   */
  it('covers everything outside the hole, and covers nothing twice', () => {
    const { hole, dim } = tourLayout({
      anchor: { x: 40, y: 300, width: 120, height: 60 },
      screen,
      insets,
    })
    const covers = (panel: (typeof dim)[number], x: number, y: number): boolean =>
      x >= panel.left &&
      x < panel.left + panel.width &&
      y >= panel.top &&
      y < panel.top + panel.height

    // Sampled on half-points so no probe ever lands exactly on an edge, where
    // "inside" is a question about the rounding rather than about the layout.
    for (let x = 0.5; x < screen.width; x += 3) {
      for (let y = 0.5; y < screen.height; y += 3) {
        const lit = x > hole.x && x < hole.x + hole.width && y > hole.y && y < hole.y + hole.height
        expect(dim.filter((panel) => covers(panel, x, y))).toHaveLength(lit ? 0 : 1)
      }
    }
  })

  /**
   * The corner pieces are the whole of the difference between a square hole
   * and a round one: each is a square of the radius, in a corner of the hole,
   * with the corner pointing inwards rounded away by the renderer.
   */
  it('fills the hole back in at the corners, and only when it is round', () => {
    const { hole, corners } = tourLayout({
      anchor: { x: 20, y: 700, width: 50, height: 50, radius: 14 },
      screen,
      insets,
    })
    expect(corners.map((corner) => corner.at)).toEqual([
      'topLeft',
      'topRight',
      'bottomLeft',
      'bottomRight',
    ])
    for (const corner of corners) {
      expect(corner.size).toBe(hole.radius)
      expect(corner.left === hole.x || corner.left === hole.x + hole.width - hole.radius).toBe(true)
      expect(corner.top === hole.y || corner.top === hole.y + hole.height - hole.radius).toBe(true)
    }

    const square = tourLayout({ anchor: { x: 20, y: 300, width: 200, height: 40 }, screen, insets })
    expect(square.corners).toEqual([])
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
  })

  /**
   * The two-pane case, which is the whole reason the rule exists: the tour
   * explains a 360-point column while the other half of the window holds an
   * empty panel, and a bubble centred on the anchor would cover the list it
   * is describing rather than stand in the room next to it.
   */
  it('stands beside the element when a half of the window is free', () => {
    const wide = tourLayout({
      anchor: { x: 24, y: 120, width: 160, height: 34 },
      screen: { width: 1200, height: 900 },
      insets,
    })
    // The hole ends at 190; the bubble starts one gap later and lines its top
    // up with the hole's rather than clearing it.
    expect(wide.bubble.left).toBe(202)
    expect(wide.bubble.width).toBe(420)
    expect(wide.bubble.placement).toBe('below')
    expect(wide.bubble.top).toBe(114)
  })

  /** A phone has no such room: 390 wide, and the bubble stays over the screen. */
  it('stays over the element when there is no room beside it', () => {
    const phone = tourLayout({
      anchor: { x: 24, y: 120, width: 160, height: 34 },
      screen,
      insets,
    })
    expect(phone.bubble.left).toBe(12)
    expect(phone.bubble.top).toBe(172)
  })

  /** A bubble taller than the room it has scrolls; it never runs off the screen. */
  it('never offers a negative height to grow into', () => {
    for (const y of [0, 400, 843]) {
      const { bubble } = tourLayout({ anchor: { x: 0, y, width: 390, height: 1 }, screen, insets })
      expect(bubble.maxHeight).toBeGreaterThanOrEqual(0)
    }
  })
})
