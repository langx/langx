import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { V3_LABEL_MAX_SCALE, v3TabBarHeight } from './tabLabelScale'
import { v3Type } from './theme/tokens'
import type { TourRect } from './tour'
import { PAD, tourCornerPath, tourLayout, type TourCorner } from './tourLayout'

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
   * less the quarter disc round its inner corner (`tourCornerPath`).
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

  /**
   * The corner piece's outline, read back as geometry: where it starts, and
   * the centre of its arc as SVG would place it from the two end points, the
   * radius and the sweep flag. A piece must start at the hole's outer corner
   * and bite its quarter disc out round the inner one — the other way round is
   * the inside-out corner this builder replaced.
   */
  it('draws each corner piece round the corner that points into the hole', () => {
    const size = 10
    const expected = {
      topLeft: { outer: [0, 0], centre: [10, 10] },
      topRight: { outer: [10, 0], centre: [0, 10] },
      bottomLeft: { outer: [0, 10], centre: [10, 0] },
      bottomRight: { outer: [10, 10], centre: [0, 0] },
    } as const
    for (const at of Object.keys(expected) as TourCorner['at'][]) {
      const piece = readPiece(tourCornerPath(at, size))
      expect(piece.start).toEqual(expected[at].outer)
      expect(piece.radius).toBe(size)
      expect(piece.centre[0]).toBeCloseTo(expected[at].centre[0])
      expect(piece.centre[1]).toBeCloseTo(expected[at].centre[1])
    }
  })

  /**
   * The whole dim, panels and corner pieces together, against the shape the
   * ring draws: a rounded rectangle. Every point inside it lit, every point
   * outside it dimmed exactly once — for a square hole, a softly rounded one,
   * a tab's circle and a pill.
   */
  it('leaves exactly the rounded hole lit, whatever its shape', () => {
    const anchors = [
      { x: 40, y: 300, width: 120, height: 60 },
      { x: 40, y: 300, width: 120, height: 60, radius: 14 },
      { x: 20, y: 760, width: 50, height: 50, radius: 999 },
      { x: 30, y: 120, width: 300, height: 34, radius: 999 },
    ]
    for (const anchor of anchors) {
      const { hole, dim, corners } = tourLayout({ anchor, screen, insets })
      const pieces = corners.map((corner) => ({ corner, shape: readPiece(corner.path) }))
      const r = hole.radius
      const step = 1
      // Only the band round the hole: everywhere else the panels' own test holds.
      for (let x = hole.x - 4 + step / 2; x < hole.x + hole.width + 4; x += step) {
        for (let y = hole.y - 4 + step / 2; y < hole.y + hole.height + 4; y += step) {
          const cx = clamp(x, hole.x + r, hole.x + hole.width - r)
          const cy = clamp(y, hole.y + r, hole.y + hole.height - r)
          const inside =
            x > hole.x &&
            x < hole.x + hole.width &&
            y > hole.y &&
            y < hole.y + hole.height &&
            Math.hypot(x - cx, y - cy) <= r
          // Too near the arc to call either way, as a renderer's edge would be.
          if (r && Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.01) continue
          const panels = dim.filter(
            (panel) =>
              x >= panel.left &&
              x < panel.left + panel.width &&
              y >= panel.top &&
              y < panel.top + panel.height,
          ).length
          const filled = pieces.filter(({ corner, shape }) => {
            const px = x - corner.left
            const py = y - corner.top
            return (
              px >= 0 &&
              px < corner.size &&
              py >= 0 &&
              py < corner.size &&
              Math.hypot(px - shape.centre[0], py - shape.centre[1]) > shape.radius
            )
          }).length
          expect(panels + filled, `${JSON.stringify(anchor)} at ${x},${y}`).toBe(inside ? 0 : 1)
        }
      }
    }
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

  /**
   * A tab step in the redesign's bar. The tab's face, the 56 by 32 pill and
   * the word under it, is measured as one box: as wide as the wider of the
   * two and as tall as both. The tab grows it by 4, with a corner that is the
   * pill's own end radius carried out by that 4 and by `PAD`. The hole used to
   * be the pill's alone, and its ring ran through the word.
   *
   * Every corner of the pill's box and of the word's has to sit inside the
   * ring's inner edge, rounded corners included. Checked for a short word and
   * one as wide as the tab allows, at the word's own size and at its cap, on
   * the Chats tab from either end of the bar (second of five left to right,
   * fourth right to left), on the web's screens with no inset and on an
   * iPhone's.
   */
  it('takes in a tab’s icon and its word, as one rounded shape', () => {
    const ring = 2
    const pill = { width: 56, height: 32 }
    const pad = 4
    const radius = pill.height / 2 + pad + PAD
    const line = v3Type.label.lineHeight
    const phones = [
      { screen: { width: 320, height: 640 }, insets: { top: 0, bottom: 0 } },
      { screen: { width: 375, height: 812 }, insets: { top: 0, bottom: 0 } },
      { screen, insets },
    ]
    for (const phone of phones) {
      const tab = phone.screen.width / 5
      for (const scale of [1, V3_LABEL_MAX_SCALE]) {
        const bar = v3TabBarHeight({
          base: 62,
          lineHeight: line,
          labelScale: scale,
          bottomInset: phone.insets.bottom,
        })
        // Under the bar item's own 5-point padding.
        const top = phone.screen.height - bar + 5
        for (const slot of [1, 3]) {
          const centre = tab * slot + tab / 2
          for (const wordWidth of [30, tab - 10]) {
            const icon = { x: centre - pill.width / 2, y: top, ...pill }
            const word = {
              x: centre - wordWidth / 2,
              y: top + pill.height,
              width: wordWidth,
              height: line * scale,
            }
            const face = union(icon, word)
            const { hole, corners } = tourLayout({
              anchor: { ...grow(face, pad), radius },
              screen: phone.screen,
              insets: phone.insets,
            })
            expect(hole.radius).toBe(radius)
            expect(corners).toHaveLength(4)
            for (const box of [icon, word]) {
              for (const [x, y] of cornersOf(box)) {
                expect(
                  insideRing(hole, x, y, ring),
                  `${JSON.stringify({ phone: phone.screen, scale, slot, wordWidth })} at ${x},${y}`,
                ).toBe(true)
              }
            }
          }
        }
      }
    }

    // The pill's own hole, for the record: the word's bottom edge was outside it.
    const pillTop = 812 - 62 + 5
    const old = tourLayout({
      anchor: { ...grow({ x: 75 + 9.5, y: pillTop, ...pill }, pad), radius: 999 },
      screen: { width: 375, height: 812 },
      insets: { top: 0, bottom: 0 },
    })
    expect(insideRing(old.hole, 112.5, pillTop + pill.height + line, ring)).toBe(false)
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

/**
 * The tab bar hands the tour the face's whole content — the test above holds
 * the geometry of that box still, and this holds that it is the box measured.
 */
describe('the redesign’s tab bar', () => {
  const source = readFileSync(path.resolve(__dirname, '../../app/(app)/(tabs)/_layout.tsx'), 'utf8')

  it('offers the tour the icon and its word together, not the icon alone', () => {
    const icon = source.slice(
      source.indexOf('function V3TabIcon'),
      source.indexOf('function V3TabBadge'),
    )
    expect(icon).not.toContain('<TourTarget')
    const button = source.slice(source.indexOf('function V3TabButton'))
    expect(button.slice(0, button.indexOf('</PressableScale>'))).toMatch(
      /<TourTarget[^>]*>\s*\{children\}\s*<\/TourTarget>/,
    )
    expect(source).toContain('<V3TabButton {...props} tour="tabChats" />')
    expect(source).toContain('<V3TabButton {...props} tour="tabEcho" />')
  })
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

type Box = Omit<TourRect, 'radius'>

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/** What `TourTarget`'s `pad` does to the measured box. */
function grow(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, width: box.width + by * 2, height: box.height + by * 2 }
}

function cornersOf(box: Box): [number, number][] {
  const right = box.x + box.width
  const bottom = box.y + box.height
  return [
    [box.x, box.y],
    [right, box.y],
    [box.x, bottom],
    [right, bottom],
  ]
}

/**
 * Inside the ring's inner edge: the hole drawn in by the ring's width, with a
 * corner that much tighter, which is how a border's inner corner is drawn.
 */
function insideRing(
  hole: TourRect & { radius: number },
  x: number,
  y: number,
  ring: number,
): boolean {
  const left = hole.x + ring
  const right = hole.x + hole.width - ring
  const top = hole.y + ring
  const bottom = hole.y + hole.height - ring
  const r = Math.max(0, hole.radius - ring)
  if (x < left || x > right || y < top || y > bottom) return false
  const cx = clamp(x, left + r, right - r)
  const cy = clamp(y, top + r, bottom - r)
  return Math.hypot(x - cx, y - cy) <= r
}

/**
 * Reads `M x y`, one straight move, `A r r 0 0 sweep x y`, `Z` — the only
 * outline `tourCornerPath` draws — and finds the arc's centre the way SVG
 * does: of the two circles of that radius through both end points, the one
 * round which a short arc turns the way the sweep flag says.
 */
function readPiece(path: string): {
  start: [number, number]
  radius: number
  centre: [number, number]
} {
  const match = /^M(\S+) (\S+)([HV])(\S+)A(\S+) \S+ 0 0 ([01]) (\S+) (\S+)Z$/.exec(path)
  if (!match) throw new Error(`unexpected path ${path}`)
  const [x0, y0, along, radius, sweep, x2, y2] = [
    Number(match[1]),
    Number(match[2]),
    match[3],
    Number(match[5]),
    Number(match[6]),
    Number(match[7]),
    Number(match[8]),
  ] as const
  const x1 = along === 'H' ? Number(match[4]) : x0
  const y1 = along === 'V' ? Number(match[4]) : y0
  const chord = Math.hypot(x2 - x1, y2 - y1)
  const rise = Math.sqrt(Math.max(0, radius * radius - (chord / 2) ** 2))
  const [nx, ny] = [-(y2 - y1) / chord, (x2 - x1) / chord]
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
  const candidates: [number, number][] = [
    [mx + nx * rise, my + ny * rise],
    [mx - nx * rise, my - ny * rise],
  ]
  // A positive turn from the first end to the second is sweep 1, in SVG's y-down axes.
  const centre = candidates.find(([cx, cy]) => {
    const turn = (x1 - cx) * (y2 - cy) - (y1 - cy) * (x2 - cx)
    return sweep === 1 ? turn > 0 : turn < 0
  })
  if (!centre) throw new Error(`no centre for ${path}`)
  return { start: [x0, y0], radius, centre }
}
