import { useEffect, useState, type ReactNode } from 'react'
import { Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

/**
 * The story's four movements, from the Claude Design motion spec: text rises,
 * numbers count, the Echo card pops, the discs drift. Each one takes `reduce`
 * and, when it is set, renders its final frame and nothing else — reduced
 * motion here means no motion, and the numbers arrive at their value.
 *
 * All four start from an effect, after the view exists. Started during the
 * first render, a Reanimated animation on the web build can freeze part-way —
 * `gift.tsx` lost a day to exactly that.
 */

/** The design's rise curve: fast out of the gate, long soft landing. */
const EASE_RISE = Easing.bezier(0.2, 0.8, 0.2, 1)
/** A small overshoot, for the one thing on the story that is "thrown". */
const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1)

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
      shown.value = 1
      return
    }
    shown.value = withDelay(delay, withTiming(1, { duration: 700, easing: EASE_RISE }))
    return () => cancelAnimation(shown)
  }, [delay, reduce, shown])
  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 18 }],
  }))
  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}

/**
 * A number that counts up to itself over 900ms, ease-out cubic.
 *
 * The one per-frame React render on the story, and deliberately so: a string
 * cannot be animated on the UI thread without a text-input hack that the web
 * build does not honour, and one short `Text` re-rendering for under a second
 * is well inside the frame budget. Screen readers get the final value from the
 * first frame, never a number in flight.
 */
export function CountUp({
  value,
  locale,
  reduce,
  delay,
  style,
}: {
  value: number
  locale: string
  reduce: boolean
  delay: number
  style: StyleProp<TextStyle>
}) {
  const [shown, setShown] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    let frame = 0
    const start = Date.now() + delay
    const tick = (): void => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / 900))
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduce, delay])
  const final = value.toLocaleString(locale)
  return (
    <Text accessibilityLabel={final} style={style} numberOfLines={1}>
      {shown.toLocaleString(locale)}
    </Text>
  )
}

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
      shown.value = 1
      return
    }
    shown.value = withDelay(delay, withTiming(1, { duration: 900, easing: EASE_POP }))
    return () => cancelAnimation(shown)
  }, [delay, reduce, shown])
  const animated = useAnimatedStyle(() => ({
    // Opacity follows the unclamped curve only up to 1: the overshoot is for
    // the size and the turn, not a flash brighter than opaque.
    opacity: Math.min(1, shown.value),
    transform: [{ scale: 0.6 + 0.4 * shown.value }, { rotate: `${(1 - shown.value) * -6}deg` }],
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
      drift.value = 0
      return
    }
    drift.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(drift)
  }, [duration, reduce, drift])
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: -18 * drift.value }, { translateY: 14 * drift.value }],
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
