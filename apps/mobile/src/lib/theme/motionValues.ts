/**
 * The motion module's numbers, without the module.
 *
 * `motion.ts` builds Reanimated easings from these, and Reanimated is what
 * the launch path must not evaluate (see that file's header). The welcome
 * screen and every onboarding step render `Button`, which presses on React
 * Native's `Animated` for that reason — and still has to shrink by the same
 * amount, over the same time, on the same curve as a press anywhere else. So
 * the numbers live here, importing nothing, and both halves read them:
 * `motion.ts` re-exports every one, and `motionAnimated.ts` builds the same
 * curves with `Animated`'s own `Easing.bezier`.
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
  /** Slow at both ends: a turn, where both halves of the movement are watched. */
  inOut: [0.65, 0, 0.35, 1],
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
  /** Something leaving. Quicker than `enter`: nobody watches a thing go. */
  exit: 200,
  /**
   * A card turning over, front to back. Long enough to see both halves of
   * the turn, short enough not to stand between a reveal and the grade.
   */
  flip: 360,
  /** A plain opacity change, in or out, with nothing moving. */
  fade: 200,
  /** A bar or a ring filling to its new value. */
  fill: 220,
  /** A placeholder dissolving into what it stood for (`ui/CrossFade`). */
  crossfade: 240,
  /** A number rolling to its new value. Long enough to read the change. */
  roll: 600,
  /** A dragged item's neighbours settling into their new places. */
  reorder: 150,
} as const

/**
 * One cycle of a repeating animation, in milliseconds. A loop is ambient, so
 * each is slower than anything a tap starts.
 */
export const LOOP = {
  /** A live dot or a recording light swelling and back. */
  pulse: 700,
  /** A caret blinking. */
  blink: 640,
  /** One dot of the typing indicator. */
  typing: 480,
  /** Something idle but alive, breathing in and out. */
  breathe: 1600,
  /** One turn of a spinner. */
  spin: 1400,
} as const

/** Between neighbours in a cascade. Short enough that nothing waits on it. */
export const STAGGER = 60

/**
 * `STAGGER` for many small things in a row — an emoji strip. At 60 ms a row
 * of a dozen would still be arriving after the screen had settled.
 */
export const STAGGER_TIGHT = 25

/**
 * How long a screen's own motion waits, in milliseconds, so that it does not
 * run under the transition that brought the screen in: anything animating
 * while a pushed screen slides or a sheet rises is only half seen.
 */
export const DELAY = {
  afterPush: 250,
  afterSheet: 180,
} as const

/**
 * When a dragged sheet that is let go closes rather than springing back:
 * dragged past this fraction of its height, or flung down faster than this
 * many points a second.
 */
export const SHEET = {
  dismissFraction: 0.3,
  dismissVelocity: 800,
} as const

/**
 * How far a pressed control shrinks. Enough to feel under the finger, not so
 * much that a label wobbles; a whole card wants less, and says so locally.
 */
export const PRESS_SCALE = 0.97

/** A whole card or tile, which a button's 3% would make lurch. */
export const PRESS_SCALE_CARD = 0.98

/**
 * A lone glyph (`ui/IconButton`), small enough that a button's 3% would not
 * show on it, so it shrinks further.
 */
export const PRESS_SCALE_GLYPH = 0.88

/**
 * How far a row, a list cell or a text link dims while it is held. These dim
 * and do not shrink: see the press-feedback policy in `ui/PressableScale`.
 */
export const PRESS_OPACITY = 0.6
