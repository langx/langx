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
/**
 * Movement below this is still undecided.
 *
 * Read by `Gesture.Pan().activeOffsetX(...)` and `.failOffsetY(...)` rather
 * than by a predicate here — the same two questions, asked natively before the
 * gesture reaches JS, which is also what gives those first pixels back to the
 * row instead of leaving it trailing the thumb by them.
 */
export const ACTION_LOCK_PX = 12
/** How much of the overshoot past a fully open drawer still moves the row. */
const RUBBER = 0.15
/** Past this much of a drawer's width, releasing opens it rather than closing. */
const OPEN_AT = 0.4
/**
 * A flick this fast opens the drawer however far it actually travelled, in
 * points per second.
 *
 * Distance alone was the whole of the complaint that this row "wants to be
 * pulled all the way": with two actions the drawer is 168px, so `OPEN_AT`
 * asked for 67px of travel — and a natural flick moves the thumb perhaps 60px
 * before it lifts. The row then sprang shut on a gesture that felt decisive,
 * which reads as the swipe having failed rather than as a threshold missed.
 *
 * 500 is roughly the speed of a deliberate flick and roughly twice that of the
 * drag somebody makes while deciding, which is the distinction worth drawing:
 * a slow half-open drag still asks the distance question.
 */
const FLICK_VELOCITY = 500
export type SwipeDirection = 'left' | 'right'

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
 *
 * `velocity` is how fast the finger was moving when it lifted, in points per
 * second, and it is what makes a flick work. A gesture that is fast **and
 * heading the right way** opens the drawer it is heading towards regardless of
 * distance; a fast flick heading *back* closes the row regardless of where it
 * had got to, which is the same rule read in the other direction.
 *
 * Defaulted, so every existing caller and every existing test still describes
 * a slow drag.
 */
export function settleOffset(x: number, right: number, left: number, velocity = 0): number {
  const flickedRight = velocity >= FLICK_VELOCITY
  const flickedLeft = velocity <= -FLICK_VELOCITY

  if (flickedRight && right > 0 && x > 0) return right
  if (flickedLeft && left > 0 && x < 0) return -left
  // A flick back towards centre closes, however far the row had been dragged.
  if ((flickedLeft && x > 0) || (flickedRight && x < 0)) return 0

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
