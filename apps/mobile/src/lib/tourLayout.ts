import type { TourRect } from './tour'

/**
 * Where the hole, the dim around it and the bubble go for one tour step.
 *
 * Pure and renderer-free, like `messageMenuLayout.ts` — and for the same
 * reason: this is the part that can be wrong on one screen size and right on
 * every other, which is exactly what a test can hold still and a simulator
 * cannot.
 *
 * **There is no mask here, and no SVG.** `react-native-svg` is a native module
 * — a new binary and no way to send this over the air — so the dim is built
 * out of plain views: four rectangles butted against the hole's four straight
 * edges, and a small square at each corner with its inner corner rounded away.
 * Eight boxes, none of them unusual.
 *
 * **It was one box, and that is the bug this replaced.** A single view with a
 * border thick enough to reach every screen edge leaves a hole of any radius
 * for free, because a border's inner corner radius is its outer radius minus
 * its width. It also puts a 4750-point square with a 2375-point radius on
 * screen, and neither renderer paints that reliably: on the tab steps the dim
 * simply did not appear — the element was there, the right size and the right
 * colour, and the screen stayed bright — while the same step drawn a second
 * time was fine. Nothing here is larger than the screen any more.
 */

/** Between the hole and the bubble, and between the bubble and the screen edge. */
const GAP = 12
/** How far the hole is grown past the element, so the ring does not clip it. */
const PAD = 6
/**
 * Square, unless the element asks for something else.
 *
 * The hole was rounded for one afternoon and Behic asked for the corners back:
 * a hard rectangle reads as a cut-out over the screen, where a rounded one
 * reads as a card floating on it. A tab icon asks for a soft corner rather
 * than a hard one — the hole there is a square around a glyph rather than a
 * cut around a control — but never for a circle.
 */
const RADIUS = 0
/** Wide enough for two lines of body text, narrow enough to point at something. */
const MAX_BUBBLE_WIDTH = 420
/**
 * The room beside the hole that makes standing there better than standing
 * over the screen.
 *
 * On a phone there is never this much: the widest thing the tour points at is
 * nearly the width of the window. On a two-pane window there always is — the
 * tour explains a 360-point column while the other half of the screen holds
 * an empty panel — and putting the bubble in that half stops it covering the
 * very list it is describing.
 */
const MIN_BESIDE_WIDTH = 320

export interface TourLayoutInput {
  anchor: TourRect
  screen: { width: number; height: number }
  insets: { top: number; bottom: number }
}

/** One plain rectangle of dim. */
export interface TourPanel {
  /** Which side of the hole it covers. Also its key when the four are drawn. */
  side: 'top' | 'bottom' | 'left' | 'right'
  left: number
  top: number
  width: number
  height: number
}

/**
 * One corner of the hole, filled back in so the corner reads as round.
 *
 * A square of `hole.radius` sitting in a corner of the hole, with the corner
 * pointing *into* the hole rounded away by its own width — which leaves
 * exactly the square minus a quarter disc, and that is the difference between
 * a square hole and a rounded one.
 */
export interface TourCorner {
  at: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  left: number
  top: number
  size: number
}

export interface TourLayout {
  /** The lit rectangle: the anchor, grown by `PAD` and clamped to the screen. */
  hole: TourRect & { radius: number }
  /** The dim. Four rectangles butted against the hole's straight edges. */
  dim: readonly TourPanel[]
  /** Empty when the hole is square, which is every target but the tab icons. */
  corners: readonly TourCorner[]
  /**
   * Anchored by one edge only, so the bubble's height never has to be known
   * in advance. Measuring it first would mean one frame drawn in the wrong
   * place on every step; `below` pins the top, `above` pins the bottom, and
   * the text is free to be as tall as it likes in between.
   */
  bubble: {
    placement: 'above' | 'below'
    left: number
    width: number
    /** Set when `placement` is `below`. Distance from the top of the screen. */
    top?: number
    /** Set when `placement` is `above`. Distance from the bottom of the screen. */
    bottom?: number
    /** So a long sentence scrolls inside the bubble rather than off the screen. */
    maxHeight: number
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * The dim with nothing cut out of it.
 *
 * What the overlay paints between two steps, while the next one is still
 * finding its target — which is what keeps the same four views mounted from
 * the first step to the last. They used to be torn down and rebuilt on every
 * step, and a view inserted during a tab change was sometimes never painted:
 * the right size, the right colour, in the tree, on a screen that stayed
 * bright. Four panels that only ever move do not give the renderer that
 * chance, and they also close the half-second of undimmed screen each step
 * opened with.
 */
export function tourCover(screen: { width: number; height: number }): readonly TourPanel[] {
  return [
    { side: 'top', left: 0, top: 0, width: screen.width, height: screen.height },
    { side: 'bottom', left: 0, top: screen.height, width: screen.width, height: 0 },
    { side: 'left', left: 0, top: screen.height, width: 0, height: 0 },
    { side: 'right', left: screen.width, top: screen.height, width: 0, height: 0 },
  ]
}

export function tourLayout({ anchor, screen, insets }: TourLayoutInput): TourLayout {
  const left = clamp(anchor.x - PAD, 0, screen.width)
  const top = clamp(anchor.y - PAD, 0, screen.height)
  const right = clamp(anchor.x + anchor.width + PAD, left, screen.width)
  const bottom = clamp(anchor.y + anchor.height + PAD, top, screen.height)
  const width = right - left
  const height = bottom - top
  // A radius larger than half the shorter side is not a rounder rectangle, it
  // is a pill — which is exactly what `radius: 999` on a tab icon asks for,
  // and the bound the corner pieces need: each one is a square of `radius`,
  // and two of them meeting in the middle of an edge would be a lens, not a
  // corner.
  const radius = Math.min(anchor.radius ?? RADIUS, Math.min(width, height) / 2)
  const hole = { x: left, y: top, width, height, radius }

  /*
   * Four rectangles, butted against the hole rather than overlapping it or
   * each other: the dim is translucent, so anywhere two panels met twice
   * would be a darker seam. The top and bottom ones run the full width and
   * the sides fill the band the hole is in, which is the one arrangement
   * where no pair touches.
   */
  const dim: TourPanel[] = [
    { side: 'top', left: 0, top: 0, width: screen.width, height: Math.max(0, top) },
    {
      side: 'bottom',
      left: 0,
      top: bottom,
      width: screen.width,
      height: Math.max(0, screen.height - bottom),
    },
    { side: 'left', left: 0, top, width: Math.max(0, left), height },
    { side: 'right', left: right, top, width: Math.max(0, screen.width - right), height },
  ]

  const corners: TourCorner[] = radius
    ? [
        { at: 'topLeft', left, top, size: radius },
        { at: 'topRight', left: right - radius, top, size: radius },
        { at: 'bottomLeft', left, top: bottom - radius, size: radius },
        { at: 'bottomRight', left: right - radius, top: bottom - radius, size: radius },
      ]
    : []

  /*
   * Which side of the hole the bubble takes is decided by where the hole is,
   * not by how much room is left: an element in the top half of the screen
   * gets its explanation underneath, one in the bottom half gets it above.
   * The alternative — fitting by height — needs the height, which is the one
   * thing this function refuses to wait for.
   */
  const placement = top + height / 2 < screen.height / 2 ? 'below' : 'above'

  /*
   * Beside the hole when there is a half of the window doing nothing, over it
   * otherwise. `placement` still says which edge the bubble is pinned by —
   * the height is the one thing this function refuses to wait for — so a
   * bubble that stands beside the hole only stops *clearing* it vertically:
   * it lines its top up with the hole's top, or its bottom with the hole's
   * bottom, and reads as being about the thing it is next to.
   */
  const sideRoom = screen.width - (right + GAP * 2)
  const beside = sideRoom >= MIN_BESIDE_WIDTH
  const bubbleWidth = beside
    ? Math.min(MAX_BUBBLE_WIDTH, sideRoom)
    : Math.min(MAX_BUBBLE_WIDTH, Math.max(0, screen.width - GAP * 2))
  // Centred on what it points at, then pulled back inside the screen — so a
  // bubble for the filter button at the trailing edge still reads as being
  // about the filter button.
  const bubbleLeft = beside
    ? right + GAP
    : clamp(anchor.x + anchor.width / 2 - bubbleWidth / 2, GAP, screen.width - bubbleWidth - GAP)

  if (placement === 'below') {
    const bubbleTop = beside ? Math.max(insets.top + GAP, top) : bottom + GAP
    return {
      hole,
      dim,
      corners,
      bubble: {
        placement,
        left: bubbleLeft,
        width: bubbleWidth,
        top: bubbleTop,
        maxHeight: Math.max(0, screen.height - insets.bottom - GAP - bubbleTop),
      },
    }
  }

  const bubbleBottom = beside
    ? Math.max(insets.bottom + GAP, screen.height - bottom)
    : Math.max(0, screen.height - top) + GAP
  return {
    hole,
    dim,
    corners,
    bubble: {
      placement,
      left: bubbleLeft,
      width: bubbleWidth,
      bottom: bubbleBottom,
      maxHeight: Math.max(0, screen.height - bubbleBottom - insets.top - GAP),
    },
  }
}
