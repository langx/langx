import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated'
import { CURVE, DURATION } from './motionValues'

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
 *
 * The numbers themselves — durations, curve points, the press scale — are in
 * `motionValues.ts`, which imports nothing, so that `Button` can press by
 * them on the launch path without evaluating Reanimated. They are re-exported
 * here, and a Reanimated screen reads them from this file.
 */

export {
  CURVE,
  DELAY,
  DURATION,
  LOOP,
  PRESS_OPACITY,
  PRESS_SCALE,
  PRESS_SCALE_CARD,
  PRESS_SCALE_GLYPH,
  SHEET,
  STAGGER,
  STAGGER_TIGHT,
} from './motionValues'

/** A strong ease-out: the movement is at its fastest when the eye arrives. */
export const EASE_OUT = Easing.bezier(...CURVE.out)
/** Fast out of the gate, then a long soft landing: text rising into place. */
export const EASE_RISE = Easing.bezier(...CURVE.rise)
/** A small overshoot, for the one thing on a screen that is thrown. */
export const EASE_POP = Easing.bezier(...CURVE.pop)

export const TIMING = {
  press: { duration: DURATION.press, easing: EASE_OUT },
  release: { duration: DURATION.release, easing: EASE_OUT },
  enter: { duration: DURATION.enter, easing: EASE_OUT },
  rise: { duration: DURATION.rise, easing: EASE_RISE },
  pop: { duration: DURATION.pop, easing: EASE_POP },
  exit: { duration: DURATION.exit, easing: EASE_OUT },
  fade: { duration: DURATION.fade, easing: EASE_OUT },
  fill: { duration: DURATION.fill, easing: EASE_OUT },
  crossfade: { duration: DURATION.crossfade, easing: EASE_OUT },
  roll: { duration: DURATION.roll, easing: EASE_OUT },
  reorder: { duration: DURATION.reorder, easing: EASE_OUT },
} as const satisfies Record<string, WithTimingConfig>

/**
 * Spring presets, each named for what it is for. The first three are the
 * values the paywall's plan card, the recap's drag and the swipe row already
 * use. A duration-based spring's `duration` is perceptual in Reanimated 4 —
 * it settles in about one and a half times that.
 *
 * A gesture that ends hands its speed on, so the settle starts at the
 * finger's pace instead of from rest: `withSpring(to, { ...SPRING.snap,
 * velocity })`, with `velocity` from the gesture's end event.
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
  /** A big panel arriving or going home: no overshoot anyone would see on that much surface. */
  sheet: { duration: 350, dampingRatio: 0.9 },
} as const satisfies Record<string, WithSpringConfig>

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
