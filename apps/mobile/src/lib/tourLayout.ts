import type { TourRect } from './tour'

/**
 * Where the hole, the four dim panels and the bubble go for one tour step.
 *
 * Pure and renderer-free, like `messageMenuLayout.ts` — and for the same
 * reason: this is the part that can be wrong on one screen size and right on
 * every other, which is exactly what a test can hold still and a simulator
 * cannot.
 *
 * **There is no mask here, and no SVG.** The hole is the gap left between four
 * opaque-ish panels drawn around the anchor, so the real UI shows through
 * untouched in either theme. `react-native-svg` is not a dependency of this
 * app and a cut-out is not a good enough reason to make it one.
 */

/** Between the hole and the bubble, and between the bubble and the screen edge. */
const GAP = 12
/** How far the hole is grown past the element, so the ring does not clip it. */
const PAD = 6
/** Wide enough for two lines of body text, narrow enough to point at something. */
const MAX_BUBBLE_WIDTH = 420

export interface TourLayoutInput {
  anchor: TourRect
  screen: { width: number; height: number }
  insets: { top: number; bottom: number }
}

export interface TourLayout {
  /** The lit rectangle: the anchor, grown by `PAD` and clamped to the screen. */
  hole: TourRect
  /** Top, bottom, left, right — in that order, ready to map over. */
  panels: readonly TourRect[]
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

export function tourLayout({ anchor, screen, insets }: TourLayoutInput): TourLayout {
  const left = clamp(anchor.x - PAD, 0, screen.width)
  const top = clamp(anchor.y - PAD, 0, screen.height)
  const right = clamp(anchor.x + anchor.width + PAD, left, screen.width)
  const bottom = clamp(anchor.y + anchor.height + PAD, top, screen.height)
  const hole: TourRect = { x: left, y: top, width: right - left, height: bottom - top }

  const panels: TourRect[] = [
    { x: 0, y: 0, width: screen.width, height: hole.y },
    { x: 0, y: bottom, width: screen.width, height: Math.max(0, screen.height - bottom) },
    { x: 0, y: hole.y, width: hole.x, height: hole.height },
    { x: right, y: hole.y, width: Math.max(0, screen.width - right), height: hole.height },
  ]

  /*
   * Which side of the hole the bubble takes is decided by where the hole is,
   * not by how much room is left: an element in the top half of the screen
   * gets its explanation underneath, one in the bottom half gets it above.
   * The alternative — fitting by height — needs the height, which is the one
   * thing this function refuses to wait for.
   */
  const placement = hole.y + hole.height / 2 < screen.height / 2 ? 'below' : 'above'
  const width = Math.min(MAX_BUBBLE_WIDTH, Math.max(0, screen.width - GAP * 2))
  // Centred on what it points at, then pulled back inside the screen — so a
  // bubble for the filter button at the trailing edge still reads as being
  // about the filter button.
  const bubbleLeft = clamp(anchor.x + anchor.width / 2 - width / 2, GAP, screen.width - width - GAP)

  if (placement === 'below') {
    const bubbleTop = bottom + GAP
    return {
      hole,
      panels,
      bubble: {
        placement,
        left: bubbleLeft,
        width,
        top: bubbleTop,
        maxHeight: Math.max(0, screen.height - insets.bottom - GAP - bubbleTop),
      },
    }
  }

  const bubbleBottom = Math.max(0, screen.height - hole.y) + GAP
  return {
    hole,
    panels,
    bubble: {
      placement,
      left: bubbleLeft,
      width,
      bottom: bubbleBottom,
      maxHeight: Math.max(0, screen.height - bubbleBottom - insets.top - GAP),
    },
  }
}
