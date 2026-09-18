/**
 * Double-tap a bubble to heart it.
 *
 * The reaction it sends is the one already on the strip — see
 * `MESSAGE_REACTIONS` — so this adds a gesture and no new state: the server
 * treats a repeat as a toggle, which means a second double-tap takes the heart
 * away and nothing here has to know which way round it is.
 */

/** Two taps further apart than this are two taps. Same window as `pinch.ts`. */
export const DOUBLE_TAP_MS = 280

/**
 * Whether the gesture is offered at all.
 *
 * The same answer as `swipeToReplyEnabled`, for a different reason that lands
 * in the same place. On a desktop a double-click on text is the browser
 * selecting a word; there is no way to have both, and taking selection away
 * would leave Copy reachable only from the menu. Phone browsers have a finger
 * and no word-select, so they keep it. On a desktop the menu's emoji strip
 * stays the way in, exactly as its Reply row does for the swipe.
 */
export function doubleTapToReactEnabled(platform: string, hasTouch: boolean): boolean {
  return platform === 'web' ? hasTouch : true
}

/**
 * Counts taps and answers "was that the second one?".
 *
 * A closure over one timestamp rather than a hook, so the bubble can hold it
 * in a ref and nothing re-renders on a tap that turns out to be the first of
 * two. `PhotoViewer` counts its taps the same way — the app has no
 * `Gesture.Tap` anywhere, and introducing one here would have to compose with
 * the swipe's `Gesture.Pan` for a gesture that a plain counter answers.
 *
 * The second tap **consumes** the pair: three taps are one double and one
 * single, not two doubles. Without that, a quick triple-tap would send the
 * heart and immediately take it away again, which looks like the gesture
 * failed rather than like it ran twice.
 */
export function createDoubleTap(windowMs: number = DOUBLE_TAP_MS): (now: number) => boolean {
  let previous: number | null = null
  return (now: number) => {
    const isSecond = previous !== null && now - previous <= windowMs
    previous = isSecond ? null : now
    return isSecond
  }
}
