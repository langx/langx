/**
 * Pinch-to-zoom, as arithmetic.
 *
 * A sibling of `swipeAction` and `swipeToReply`, and here for the same reason:
 * the parts that are easy to get wrong — where the image is allowed to stop,
 * what a two-finger spread means in scale, where a double tap has to land the
 * content so it stays under the finger — are pure functions of numbers, and
 * `src/lib` is the only tree the test setup can reach.
 *
 * Hand-rolled rather than gesture-handler: `react-native-gesture-handler` is
 * not a dependency of this package at all, and `ui/Skeleton.tsx` records why
 * Reanimated's worklets bundle is not worth a nicer curve in the web build.
 * `RangeSlider` made the same call for the same reason.
 */

export const MIN_SCALE = 1
export const MAX_SCALE = 4
/** Where a double tap lands, and the line below which it zooms back out. */
export const DOUBLE_TAP_SCALE = 2
/** Two taps further apart than this are two taps. */
export const DOUBLE_TAP_MS = 280
/** A tap that moved further than this was a drag. */
export const TAP_SLOP_PX = 12
/** How far an unzoomed image is dragged before releasing it closes the viewer. */
export const DISMISS_DRAG_PX = 120
/** How far a sideways drag at life size has to go to turn the page. */
export const PAGE_SWIPE_PX = 60
/** Or how fast, in px/ms: a short flick pages too. */
export const PAGE_SWIPE_VX = 0.4

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpointOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * `-0` is what `0 * (1 - 1)` and `Math.max(-0, x)` hand back, and it survives
 * every arithmetic path here. Harmless in a transform, but it is not equal to
 * `0` under `Object.is`, so it turns any comparison against a rest position
 * into a coin toss. Normalised once, at the two places offsets are produced.
 */
function zero(value: number): number {
  return value + 0
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * What `contentFit="contain"` actually draws.
 *
 * The pan bounds have to be the picture's own edges, not the frame's: a tall
 * photo in a wide frame is letterboxed, and clamping to the frame would let it
 * be dragged until half the screen is scrim.
 */
export function fittedSize(natural: Size, frame: Size): Size {
  if (natural.width <= 0 || natural.height <= 0 || frame.width <= 0 || frame.height <= 0) {
    return { width: frame.width, height: frame.height }
  }
  const ratio = Math.min(frame.width / natural.width, frame.height / natural.height)
  return { width: natural.width * ratio, height: natural.height * ratio }
}

/**
 * Holds the picture against the frame: it may be moved only as far as the part
 * of it that is off-screen, and not at all along an axis that still fits.
 */
export function clampOffset(offset: Point, scale: number, frame: Size, content: Size): Point {
  const maxX = Math.max(0, (content.width * scale - frame.width) / 2)
  const maxY = Math.max(0, (content.height * scale - frame.height) / 2)
  return {
    x: zero(Math.min(maxX, Math.max(-maxX, offset.x))),
    y: zero(Math.min(maxY, Math.max(-maxY, offset.y))),
  }
}

/**
 * The offset that keeps the point under the fingers under the fingers.
 *
 * `focus` is measured from the centre of the frame, because that is where the
 * scale transform is applied from. Without this a double tap zooms the middle
 * of the screen, and the face somebody tapped walks off the edge.
 */
export function offsetForFocus(focus: Point, scale: number): Point {
  return { x: zero(focus.x * (1 - scale)), y: zero(focus.y * (1 - scale)) }
}

/** Was that a tap, and was it the second one? */
export function isDoubleTap(
  previous: { at: number } | null,
  now: number,
  travelled: number,
): boolean {
  if (travelled > TAP_SLOP_PX) return false
  if (!previous) return false
  return now - previous.at <= DOUBLE_TAP_MS
}

/**
 * Does a released drag turn the page, and which way?
 *
 * Only a drag that is more sideways than not: the same gesture layer reads a
 * vertical one as a dismissal, and a diagonal has to belong to exactly one of
 * them. Distance or speed is enough — an album is flicked through, not hauled.
 * `-1` is the previous picture (finger moved right), `1` the next, `0` neither.
 */
export function swipeStep(dx: number, dy: number, vx: number): -1 | 0 | 1 {
  if (Math.abs(dx) <= Math.abs(dy)) return 0
  if (Math.abs(dx) < PAGE_SWIPE_PX && Math.abs(vx) < PAGE_SWIPE_VX) return 0
  return dx < 0 ? 1 : -1
}
