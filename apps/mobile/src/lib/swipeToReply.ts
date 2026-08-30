/** Past this, the gesture is a reply rather than a scroll. */
export const SWIPE_ACTIVATE_PX = 56
/** Where the bubble stops following the finger one-to-one. */
export const SWIPE_MAX_PX = 80
/** Movement below this is still undecided. */
export const SWIPE_LOCK_PX = 10
/** How much of the overshoot past `SWIPE_MAX_PX` still moves the bubble. */
const RUBBER = 0.15
/**
 * How much more horizontal than vertical the movement has to be.
 *
 * This ratio is the whole answer to "why does the thread not scroll any more".
 * A flick up a long thread is never perfectly vertical, and at 1.0 a slightly
 * diagonal one reads as a swipe and eats the scroll.
 */
const HORIZONTAL_BIAS = 1.5

/**
 * Is this a reply swipe, or the list scrolling?
 *
 * Rightwards only. One accepted sign keeps the test above meaningful and
 * leaves the other direction free for a later action.
 */
export function shouldCaptureSwipe(dx: number, dy: number): boolean {
  return dx > SWIPE_LOCK_PX && dx > Math.abs(dy) * HORIZONTAL_BIAS
}

/** Follows the finger, then resists — so the limit is felt, not hit. */
export function swipeTranslation(dx: number): number {
  if (dx <= 0) return 0
  return dx <= SWIPE_MAX_PX ? dx : SWIPE_MAX_PX + (dx - SWIPE_MAX_PX) * RUBBER
}

export function swipeReleased(dx: number): boolean {
  return dx >= SWIPE_ACTIVATE_PX
}

/**
 * Whether the gesture is offered at all.
 *
 * Native always. On the web only with a touch pointer, and that distinction is
 * the whole of it: a finger drag reaches the responder system cleanly, while a
 * mouse drag on a bubble is also the browser's own text selection — the two
 * fight, and the one that wins depends on where in the bubble the drag
 * started. A gesture that works from the padding and not from the words is
 * worse than one that is plainly absent, so on a desktop the menu's Reply row
 * stays the way in.
 */
export function swipeToReplyEnabled(platform: string, hasTouch: boolean): boolean {
  return platform === 'web' ? hasTouch : true
}
