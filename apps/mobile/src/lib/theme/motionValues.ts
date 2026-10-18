/**
 * The motion module's numbers, without the module.
 *
 * `motion.ts` builds Reanimated easings from these, and Reanimated is what
 * the launch path must not evaluate (see that file's header). The welcome
 * screen and every onboarding step render `Button`, which presses on React
 * Native's `Animated` for that reason — and still has to shrink by the same
 * amount, over the same time, on the same curve as a press anywhere else. So
 * the numbers live here, importing nothing, and both halves read them:
 * `motion.ts` re-exports every one, and `ui/PressableScale` builds its curve
 * with `Animated`'s own `Easing.bezier`.
 *
 * A screen that is already on Reanimated imports `lib/theme/motion`, never
 * this file.
 */

/**
 * Cubic-bezier control points, `[x1, y1, x2, y2]`. `motion.ts` names the
 * curves (`EASE_OUT`, `EASE_RISE`, `EASE_POP`) and says what each is for.
 */
export const CURVE = {
  out: [0.23, 1, 0.32, 1],
  rise: [0.2, 0.8, 0.2, 1],
  pop: [0.34, 1.56, 0.64, 1],
} as const

/** In milliseconds. */
export const DURATION = {
  /** Press feedback. The finger is still down, so anything longer reads as lag. */
  press: 120,
  /** A control letting go of a state — a radio dot leaving. Quicker out than in. */
  release: 150,
  /** A block arriving on a screen. */
  enter: 320,
  /** A line of text rising, on a screen that is itself the event (the recap). */
  rise: 700,
  /** The thrown card. The longest thing here, and inside a celebration's 1.5 s. */
  pop: 900,
} as const

/** Between neighbours in a cascade. Short enough that nothing waits on it. */
export const STAGGER = 60

/**
 * How far a pressed control shrinks. Enough to feel under the finger, not so
 * much that a label wobbles; a whole card wants less, and says so locally.
 */
export const PRESS_SCALE = 0.97
