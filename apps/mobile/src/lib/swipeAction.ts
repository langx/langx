/**
 * Swiping a row in a list to act on it.
 *
 * A sibling of `swipeToReply`, and deliberately the same shape: the thresholds
 * live here as plain numbers and the gesture logic is a pure function, so the
 * two things that are easy to get wrong — when a diagonal flick stops being a
 * scroll, and how far the row may travel — are testable without a renderer.
 *
 * Unlike swipe-to-reply this is **two-directional**, because a chat row has two
 * actions and a list has no second axis to spend.
 */

/** Past this, releasing performs the action. */
export const ACTION_ACTIVATE_PX = 72
/** Where the row stops following the finger one-to-one. */
export const ACTION_MAX_PX = 96
/** Movement below this is still undecided. */
export const ACTION_LOCK_PX = 12
/** How much of the overshoot past `ACTION_MAX_PX` still moves the row. */
const RUBBER = 0.15
/**
 * How much more horizontal than vertical the movement has to be.
 *
 * Same 1.5 as `swipeToReply`, and for the same reason: a flick down a long list
 * is never perfectly vertical, and at 1.0 a slightly diagonal one reads as a
 * swipe and eats the scroll.
 */
const HORIZONTAL_BIAS = 1.5

export type SwipeDirection = 'left' | 'right'

/** Is this a row swipe, or the list scrolling? */
export function shouldCaptureRowSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > ACTION_LOCK_PX && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS
}

/** Follows the finger, then resists — so the limit is felt, not hit. */
export function rowTranslation(dx: number): number {
  const sign = dx < 0 ? -1 : 1
  const distance = Math.abs(dx)
  const eased =
    distance <= ACTION_MAX_PX ? distance : ACTION_MAX_PX + (distance - ACTION_MAX_PX) * RUBBER
  return sign * eased
}

/**
 * Which action a release fires, or `null` for a swipe that did not go far
 * enough — which springs back and does nothing.
 */
export function rowReleased(dx: number): SwipeDirection | null {
  if (dx >= ACTION_ACTIVATE_PX) return 'right'
  if (dx <= -ACTION_ACTIVATE_PX) return 'left'
  return null
}

/**
 * Whether the gesture is offered at all.
 *
 * The same rule `swipeToReply` states, and it has to be the same: on the web a
 * mouse drag across a row is also the browser's own text selection, and the one
 * that wins depends on where the drag started. A gesture that works from the
 * padding and not from the words is worse than one that is plainly absent — so
 * on a desktop the long-press menu stays the only way in, which it already was.
 */
export function rowSwipeEnabled(platform: string, hasTouch: boolean): boolean {
  return platform === 'web' ? hasTouch : true
}
