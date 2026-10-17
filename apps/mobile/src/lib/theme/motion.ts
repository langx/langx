import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated'

/**
 * How things move: the curves, the durations, the springs and the press,
 * named once so a screen asks for "a choice landing" rather than rewriting a
 * damping ratio from memory.
 *
 * v3's brief for motion is "springy and quick": blocks slide in like strips,
 * a reward bounces once, one haptic per reward (haptics stay in
 * `src/lib/haptics.ts`). A celebration lasts at most 1.5 s, can be skipped
 * with a tap and never blocks the next action, so nothing here is longer than
 * the recap's 900 ms pop.
 *
 * Imported as `lib/theme/motion`, and deliberately **not** re-exported from
 * `lib/theme/index.ts`. Every screen imports that index, the welcome screen
 * and the onboarding steps included, and the launch path stays on React
 * Native's `Animated` (see _The row swipe runs on the UI thread_): a re-export
 * would have every one of them evaluate Reanimated on import, a launch-path
 * change that no diff of those screens would show. It also keeps `lib/theme`
 * loadable by the mobile vitest, which cannot load Reanimated at all.
 *
 * Every callback a Reanimated animation or gesture calls still carries
 * `'worklet'`, and what is built here is started from an effect, never during
 * render: a spring started before its view existed froze part-way on the web
 * build (see the hourly gift).
 */

/** A strong ease-out: the movement is at its fastest when the eye arrives. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
/** Fast out of the gate, then a long soft landing: text rising into place. */
export const EASE_RISE = Easing.bezier(0.2, 0.8, 0.2, 1)
/** A small overshoot, for the one thing on a screen that is thrown. */
export const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1)

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

export const TIMING = {
  press: { duration: DURATION.press, easing: EASE_OUT },
  release: { duration: DURATION.release, easing: EASE_OUT },
  enter: { duration: DURATION.enter, easing: EASE_OUT },
  rise: { duration: DURATION.rise, easing: EASE_RISE },
  pop: { duration: DURATION.pop, easing: EASE_POP },
} as const satisfies Record<string, WithTimingConfig>

/**
 * Spring presets, each named for what it is for. The first three are the
 * values the paywall's plan card, the recap's drag and the swipe row already
 * use. A duration-based spring's `duration` is perceptual in Reanimated 4 —
 * it settles in about one and a half times that.
 */
export const SPRING = {
  /** A choice landing: a little overshoot, because the tap carried the intent. */
  select: { duration: 300, dampingRatio: 0.6 },
  /** Something let go of, settling home without a bounce. */
  settle: { duration: 400, dampingRatio: 0.8 },
  /** Following a finger, then stopping dead: a row swiped open or shut. */
  snap: { damping: 20, stiffness: 220, overshootClamping: true },
  /**
   * Arriving with one bounce — a reward, the flame. About a sixth past the
   * mark and back, and nothing after it worth seeing. Not the gift's
   * `damping: 12, stiffness: 160`: under Reanimated 4's default mass of 4 that
   * spring swings more than a third past its mark and back under it, which
   * reads as wobbling rather than as landing.
   */
  bounce: { duration: 500, dampingRatio: 0.5 },
} as const satisfies Record<string, WithSpringConfig>

/**
 * How far a pressed control shrinks. Enough to feel under the finger, not so
 * much that a label wobbles; a whole card wants less, and says so locally.
 */
export const PRESS_SCALE = 0.97

/**
 * The animation — or, when motion is reduced, the value it would have ended
 * on, set at once.
 *
 * Reduced motion here means no motion: not a shorter one and not a fade, the
 * view is simply there, and a delay or a loop wrapped in `animate` is skipped
 * with it. `reduce` is the `useReduceMotion()` the rest of the app reads, so
 * every screen makes this choice from the same answer.
 *
 *     progress.set(unlessReduced(reduce, 1, (to) => withTiming(to, TIMING.enter)))
 */
export function unlessReduced<T>(reduce: boolean, to: T, animate: (to: T) => T): T {
  'worklet'
  return reduce ? to : animate(to)
}
