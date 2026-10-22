/**
 * Swiping a bubble to reply to it.
 *
 * **`swipeTranslation` and `swipeReleased` are worklets, and that is not
 * optional** — the same rule, and the same crash, as `swipeAction`: they are
 * called from `Gesture.Pan().onUpdate`/`.onEnd`, which run on the UI thread,
 * and a plain function reached from there throws where nothing can catch it.
 */

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
  'worklet'
  if (dx <= 0) return 0
  return dx <= SWIPE_MAX_PX ? dx : SWIPE_MAX_PX + (dx - SWIPE_MAX_PX) * RUBBER
}

export function swipeReleased(dx: number): boolean {
  'worklet'
  return dx >= SWIPE_ACTIVATE_PX
}

/**
 * What a frame of the drag did to the reply: crossed into it (`'armed'` —
 * letting go now replies), back out of it (`'disarmed'`), or nothing.
 *
 * Asked of every frame by the bubble's `useAnimatedReaction`, so the buzz and
 * the arrow's pop happen once per crossing rather than once per frame past the
 * line, and come back if the finger drops under it and crosses again. `prev`
 * is `null` on the reaction's first run, which is no crossing at all: a bubble
 * mounting at rest must not buzz.
 */
export function swipeCrossing(prev: number | null, now: number): 'armed' | 'disarmed' | null {
  'worklet'
  if (prev === null) return null
  const was = prev >= SWIPE_ACTIVATE_PX
  const is = now >= SWIPE_ACTIVATE_PX
  if (was === is) return null
  return is ? 'armed' : 'disarmed'
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
