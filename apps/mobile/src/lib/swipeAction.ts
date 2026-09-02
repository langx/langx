/**
 * Swiping a row in a list to reach its actions.
 *
 * A sibling of `swipeToReply`, and deliberately the same shape: the thresholds
 * live here as plain numbers and the geometry is pure functions, so the two
 * things that are easy to get wrong — when a diagonal flick stops being a
 * scroll, and where the row is allowed to come to rest — are testable without
 * a renderer.
 *
 * **The row rests open.** It used to commit on release: swipe far enough and
 * the action fired as the row sprang back. That is fine for one action a side
 * and impossible for two, since a single gesture cannot say which of them was
 * meant. Opening a drawer and letting the reader tap costs a second gesture and
 * buys the thing they already expect from every other list on their phone —
 * and it makes a destructive action reachable without ever being reachable by
 * accident.
 */

/** One action button's width, and therefore the unit the row opens in. */
export const ACTION_WIDTH_PX = 84
/** Movement below this is still undecided. */
export const ACTION_LOCK_PX = 12
/** How much of the overshoot past a fully open drawer still moves the row. */
const RUBBER = 0.15
/** Past this much of a drawer's width, releasing opens it rather than closing. */
const OPEN_AT = 0.4
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

/** How wide the drawer on one side is, given how many buttons it holds. */
export function drawerWidth(actionCount: number): number {
  return Math.max(0, actionCount) * ACTION_WIDTH_PX
}

/**
 * Follows the finger, then resists — so the limit is felt, not hit.
 *
 * `right` is the drawer revealed by pulling the row to the right, `left` the
 * one revealed by pulling it to the left; a side with no actions cannot be
 * opened at all, and the rubber band is all that is left of the gesture there.
 */
export function rowTranslation(x: number, right: number, left: number): number {
  const limit = x >= 0 ? right : left
  const distance = Math.abs(x)
  const eased = distance <= limit ? distance : limit + (distance - limit) * RUBBER
  return x < 0 ? -eased : eased
}

/**
 * Where the row comes to rest when the finger lifts: closed, or one of the two
 * drawers fully open. Never anywhere in between — a half-open row is a row
 * whose buttons are half-tappable.
 */
export function settleOffset(x: number, right: number, left: number): number {
  if (x > 0) return right > 0 && x >= right * OPEN_AT ? right : 0
  if (x < 0) return left > 0 && -x >= left * OPEN_AT ? -left : 0
  return 0
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
