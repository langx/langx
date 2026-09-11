import type { TourRect } from './tour'

/**
 * Where the hole, the dim around it and the bubble go for one tour step.
 *
 * Pure and renderer-free, like `messageMenuLayout.ts` — and for the same
 * reason: this is the part that can be wrong on one screen size and right on
 * every other, which is exactly what a test can hold still and a simulator
 * cannot.
 *
 * **There is no mask here, and no SVG.** The dim is one view with an enormous
 * border: a border's inner corner radius is its outer radius minus its width,
 * so a single bordered box with nothing in the middle leaves a *rounded*
 * rectangular hole with the real UI showing through it. Four panels around the
 * anchor was the first attempt and it left the four corners undimmed — the
 * hole was square while the ring over it was round.
 */

/** Between the hole and the bubble, and between the bubble and the screen edge. */
const GAP = 12
/** How far the hole is grown past the element, so the ring does not clip it. */
const PAD = 6
/** The house corner, when the element does not ask for its own. */
const RADIUS = 16
/** Wide enough for two lines of body text, narrow enough to point at something. */
const MAX_BUBBLE_WIDTH = 420

export interface TourLayoutInput {
  anchor: TourRect
  screen: { width: number; height: number }
  insets: { top: number; bottom: number }
}

export interface TourLayout {
  /** The lit rectangle: the anchor, grown by `PAD` and clamped to the screen. */
  hole: TourRect & { radius: number }
  /**
   * The dim, as one bordered box. Its border is the dim; its hollow middle is
   * the hole. Wide enough to cover the screen from wherever the hole is.
   */
  mask: { left: number; top: number; width: number; height: number }
  /** `borderWidth` for the mask, and the radius that rounds its inside. */
  border: { width: number; radius: number }
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
  const width = right - left
  const height = bottom - top
  // A radius larger than half the shorter side is not a rounder rectangle, it
  // is a pill — which is exactly what `radius: 999` on a tab icon asks for,
  // and what the border arithmetic below needs bounded to stay a rectangle.
  const radius = Math.min(anchor.radius ?? RADIUS, Math.min(width, height) / 2)
  const hole = { x: left, y: top, width, height, radius }

  /*
   * One border, thick enough to reach every edge of the screen from a hole
   * anywhere on it. The inner radius React Native (and CSS) derives is
   * `borderRadius - borderWidth`, so the outer radius has to carry the border
   * width as well as the corner we actually want.
   */
  const border = { width: screen.width + screen.height, radius: 0 }
  border.radius = border.width + radius
  const mask = {
    left: left - border.width,
    top: top - border.width,
    width: width + border.width * 2,
    height: height + border.width * 2,
  }

  /*
   * Which side of the hole the bubble takes is decided by where the hole is,
   * not by how much room is left: an element in the top half of the screen
   * gets its explanation underneath, one in the bottom half gets it above.
   * The alternative — fitting by height — needs the height, which is the one
   * thing this function refuses to wait for.
   */
  const placement = top + height / 2 < screen.height / 2 ? 'below' : 'above'
  const bubbleWidth = Math.min(MAX_BUBBLE_WIDTH, Math.max(0, screen.width - GAP * 2))
  // Centred on what it points at, then pulled back inside the screen — so a
  // bubble for the filter button at the trailing edge still reads as being
  // about the filter button.
  const bubbleLeft = clamp(
    anchor.x + anchor.width / 2 - bubbleWidth / 2,
    GAP,
    screen.width - bubbleWidth - GAP,
  )

  if (placement === 'below') {
    const bubbleTop = bottom + GAP
    return {
      hole,
      mask,
      border,
      bubble: {
        placement,
        left: bubbleLeft,
        width: bubbleWidth,
        top: bubbleTop,
        maxHeight: Math.max(0, screen.height - insets.bottom - GAP - bubbleTop),
      },
    }
  }

  const bubbleBottom = Math.max(0, screen.height - top) + GAP
  return {
    hole,
    mask,
    border,
    bubble: {
      placement,
      left: bubbleLeft,
      width: bubbleWidth,
      bottom: bubbleBottom,
      maxHeight: Math.max(0, screen.height - bubbleBottom - insets.top - GAP),
    },
  }
}
