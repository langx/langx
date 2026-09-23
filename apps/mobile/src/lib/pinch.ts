/**
 * Pinch-to-zoom, as arithmetic.
 *
 * A sibling of `swipeAction` and `swipeToReply`, and here for the same reason:
 * the parts that are easy to get wrong — where the image is allowed to stop,
 * how far past that a finger may drag it, where a pinch has to leave the
 * content so it stays under the fingers — are pure functions of numbers, and
 * `src/lib` is the only tree the test setup can reach.
 *
 * **Every function here carries `'worklet'`.** `PhotoViewer` calls them from
 * gesture-handler callbacks, which the worklets Babel plugin compiles onto the
 * UI thread; a plain function reached from there is a stub that throws, and
 * the throw aborts the app rather than showing a red box. On Node the
 * directive is an inert string, so the tests below cannot catch a missing one
 * — see `docs/decisions.md` → *The row swipe runs on the UI thread*.
 */

export const MIN_SCALE = 1
export const MAX_SCALE = 4
/** Where a double tap lands, and the line below which it zooms back out. */
export const DOUBLE_TAP_SCALE = 2
/** Two taps further apart than this are two taps. */
export const DOUBLE_TAP_MS = 280
/** How far a life-size drag travels before it is either a page turn or a dismissal. */
export const AXIS_LOCK_PX = 6
/** How far an unzoomed image is dragged before releasing it closes the viewer. */
export const DISMISS_DRAG_PX = 120
/** How far a sideways drag at life size has to go to turn the page. */
export const PAGE_SWIPE_PX = 60
/** Or how fast, in px/ms: a short flick pages too. */
export const PAGE_SWIPE_VX = 0.4
/**
 * How much of a finger's travel still moves the picture once it is past where
 * it may rest. Some rather than none: a hard stop at the edge reads as the
 * gesture having stopped working, where give reads as an edge.
 */
export const OVERSCROLL_RESISTANCE = 0.3
/**
 * How far a pinch may overshoot the scale limits while the fingers are down.
 * Past these the picture stops following; on release it springs back inside.
 */
export const MIN_OVERZOOM = MIN_SCALE / 2
export const MAX_OVERZOOM = MAX_SCALE * 1.5

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/**
 * `-0` is what `0 * (1 - 1)` and `Math.max(-0, x)` hand back, and it survives
 * every arithmetic path here. Harmless in a transform, but it is not equal to
 * `0` under `Object.is`, so it turns any comparison against a rest position
 * into a coin toss. Normalised wherever an offset is produced.
 */
function zero(value: number): number {
  'worklet'
  return value + 0
}

export function clampScale(scale: number): number {
  'worklet'
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
  'worklet'
  if (natural.width <= 0 || natural.height <= 0 || frame.width <= 0 || frame.height <= 0) {
    return { width: frame.width, height: frame.height }
  }
  const ratio = Math.min(frame.width / natural.width, frame.height / natural.height)
  return { width: natural.width * ratio, height: natural.height * ratio }
}

/** How far the picture may sit from centre, each way, at `scale`. */
export function maxOffset(scale: number, frame: Size, content: Size): Point {
  'worklet'
  return {
    x: Math.max(0, (content.width * scale - frame.width) / 2),
    y: Math.max(0, (content.height * scale - frame.height) / 2),
  }
}

/**
 * Holds the picture against the frame: it may be moved only as far as the part
 * of it that is off-screen, and not at all along an axis that still fits.
 */
export function clampOffset(offset: Point, scale: number, frame: Size, content: Size): Point {
  'worklet'
  const { x: maxX, y: maxY } = maxOffset(scale, frame, content)
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
  'worklet'
  return { x: zero(focus.x * (1 - scale)), y: zero(focus.y * (1 - scale)) }
}

/**
 * One frame of a pinch, applied to wherever the picture already is.
 *
 * Incremental on purpose. This used to compute the offset from scratch each
 * frame as `focus * (1 - scale)` — right only for a pinch that starts at life
 * size with the picture centred. A second pinch on a zoomed picture threw away
 * where it had been panned to and jumped; two fingers moving together dragged
 * it the wrong way; and a pinch on the black letterbox, where the focus is far
 * from centre, spent every frame pinned to the clamp while the picture slid
 * out from under the fingers. Here `change` is how much the spread grew since
 * the last frame, and the point under `focus` is the one held still, whatever
 * the picture was doing before.
 *
 * `focus` and `offset` are both measured from the frame's centre, which is
 * where the scale transform is applied from.
 */
export function zoomAbout(
  offset: Point,
  scale: number,
  focus: Point,
  change: number,
): { offset: Point; scale: number } {
  'worklet'
  if (!Number.isFinite(change) || change <= 0) return { offset, scale }
  const next = Math.min(MAX_OVERZOOM, Math.max(MIN_OVERZOOM, scale * change))
  const applied = next / scale
  return {
    scale: next,
    offset: {
      x: zero(focus.x - (focus.x - offset.x) * applied),
      y: zero(focus.y - (focus.y - offset.y) * applied),
    },
  }
}

/**
 * A pinch's per-frame `change`, damped once the scale is already past a
 * limit and still heading away from it — the scale's version of `resist`.
 */
export function resistScaleChange(scale: number, change: number): number {
  'worklet'
  const outward = (scale < MIN_SCALE && change < 1) || (scale > MAX_SCALE && change > 1)
  return outward ? 1 + (change - 1) * OVERSCROLL_RESISTANCE : change
}

/**
 * A drag's per-frame `delta` for a value that should rest in `[-limit, limit]`:
 * untouched inside, damped once past the edge and still heading outwards, so
 * the picture gives at its edge instead of stopping dead.
 */
export function resist(value: number, delta: number, limit: number): number {
  'worklet'
  const outward = (value >= limit && delta > 0) || (value <= -limit && delta < 0)
  return outward ? delta * OVERSCROLL_RESISTANCE : delta
}

/**
 * Where a zoom comes to rest once the fingers lift: the scale back inside its
 * limits, shrunk about the frame's centre so the part being looked at stays
 * in view, and the picture pulled back against its edges. At life size that
 * is always dead centre.
 */
export function settleZoom(
  offset: Point,
  scale: number,
  frame: Size,
  content: Size,
): { offset: Point; scale: number } {
  'worklet'
  const next = clampScale(scale)
  if (next === MIN_SCALE) return { scale: next, offset: { x: 0, y: 0 } }
  const ratio = next / scale
  return {
    scale: next,
    offset: clampOffset({ x: offset.x * ratio, y: offset.y * ratio }, next, frame, content),
  }
}

/**
 * The three pictures the viewer keeps mounted: the one before, the one open,
 * the one after — as album indexes, wrapped at both ends, each with a key so
 * that the view already holding a picture is moved when the page turns rather
 * than handed a new source. `null` is an empty slot: a single picture has no
 * neighbours.
 *
 * In a two-picture album both neighbours are the same picture and a key can
 * be used once. The one ahead keeps it: forward is the common direction, and
 * that is the turn that must not blink.
 */
export function albumSlots(index: number, total: number): { key: string; at: number | null }[] {
  'worklet'
  if (total < 2) {
    return [
      { key: 'before', at: null },
      { key: String(index), at: index },
      { key: 'after', at: null },
    ]
  }
  const before = (index + total - 1) % total
  const after = (index + 1) % total
  return [
    { key: before === after ? 'before' : String(before), at: before },
    { key: String(index), at: index },
    { key: String(after), at: after },
  ]
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
  'worklet'
  if (Math.abs(dx) <= Math.abs(dy)) return 0
  if (Math.abs(dx) < PAGE_SWIPE_PX && Math.abs(vx) < PAGE_SWIPE_VX) return 0
  return dx < 0 ? 1 : -1
}
