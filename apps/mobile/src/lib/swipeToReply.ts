/** Past this, the gesture is a reply rather than a scroll. */
export const SWIPE_ACTIVATE_PX = 56
/** Where the bubble stops following the finger one-to-one. */
export const SWIPE_MAX_PX = 80
/**
 * Movement below this is still undecided.
 *
 * Now read by `Gesture.Pan().activeOffsetX(...)` and `.failOffsetY(...)`
 * rather than by a predicate here: the same two questions — has it gone far
 * enough sideways, and has it gone too far down to still be a swipe — are
 * asked natively, before the gesture is ever handed to JS.
 */
export const SWIPE_LOCK_PX = 10
/** How much of the overshoot past `SWIPE_MAX_PX` still moves the bubble. */
const RUBBER = 0.15
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
