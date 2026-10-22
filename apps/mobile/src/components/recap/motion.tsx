import { useEffect, type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { TIMING } from '../../lib/theme/motion'

/**
 * The story's four movements, from the Claude Design motion spec: text rises,
 * numbers count, the Echo card pops, the discs drift. Each one takes `reduce`
 * and, when it is set, renders its final frame and nothing else — reduced
 * motion here means no motion, and the numbers arrive at their value.
 *
 * All four start from an effect, after the view exists. Started during the
 * first render, a Reanimated animation on the web build can freeze part-way —
 * `gift.tsx` lost a day to exactly that.
 *
 * The rise and the pop are the app's `TIMING.rise` and `TIMING.pop`: the
 * design's curves were first written here, and now live in `lib/theme/motion`.
 */

/** The stagger of a slide's four lines, in ms, as designed. */
export const RISE_DELAYS = [80, 220, 400, 600] as const

/** Fades a line in while it travels up 18pt. Keyed by the slide, so it replays. */
export function Rise({
  delay,
  reduce,
  style,
  children,
}: {
  delay: number
  reduce: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const shown = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce) {
      shown.set(1)
      return
    }
    shown.set(withDelay(delay, withTiming(1, TIMING.rise)))
    return () => cancelAnimation(shown)
  }, [delay, reduce, shown])
  const animated = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * 18 }],
  }))
  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}

/** Moved to `ui/CountUp` for the wallet and the gift; kept here so the slides' import still reads. */
export { CountUp } from '../ui/CountUp'

/** Scales in from 0.6 with a turn of −6°, overshooting a little, once. */
export function Pop({
  delay,
  reduce,
  style,
  children,
}: {
  delay: number
  reduce: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const shown = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce) {
      shown.set(1)
      return
    }
    shown.set(withDelay(delay, withTiming(1, TIMING.pop)))
    return () => cancelAnimation(shown)
  }, [delay, reduce, shown])
  const animated = useAnimatedStyle(() => ({
    // Opacity follows the unclamped curve only up to 1: the overshoot is for
    // the size and the turn, not a flash brighter than opaque.
    opacity: Math.min(1, shown.get()),
    transform: [{ scale: 0.6 + 0.4 * shown.get() }, { rotate: `${(1 - shown.get()) * -6}deg` }],
  }))
  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}

/**
 * A disc that drifts 18pt across and 14pt down and back, forever.
 *
 * Six seconds a leg is slow enough to read as the ground breathing rather
 * than as something moving — and it is the one loop on the story, so it stops
 * entirely under reduced motion.
 */
export function Disc({
  size,
  color,
  reduce,
  duration = 6000,
  style,
}: {
  size: number
  color: string
  reduce: boolean
  duration?: number
  style: StyleProp<ViewStyle>
}) {
  const drift = useSharedValue(0)
  useEffect(() => {
    if (reduce) {
      drift.set(0)
      return
    }
    drift.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true))
    return () => cancelAnimation(drift)
  }, [duration, reduce, drift])
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: -18 * drift.get() }, { translateY: 14 * drift.get() }],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          backgroundColor: color,
          borderRadius: size,
          height: size,
          position: 'absolute',
          width: size,
        },
        style,
        animated,
      ]}
    />
  )
}
