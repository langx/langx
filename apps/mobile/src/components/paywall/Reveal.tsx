import { useEffect, type ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'

/** A strong ease-out: the movement is at its fastest when the eye arrives. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
const DURATION = 320
/** Between neighbours. Short enough that nothing waits on the cascade. */
const STAGGER = 60
/** How far a block rises. Enough to read as arriving, not as travelling. */
const RISE = 8

/**
 * One block of the paywall settling into place on first render.
 *
 * The paywall is opened a few times in someone's life, not a few times a
 * minute, so it can afford an entrance — but only one: blocks fade and rise
 * 8pt, staggered 60ms, and nothing blocks a tap while they do. With reduced
 * motion on they are simply there.
 *
 * `ready` holds a block back until what it says is known — the paywall's
 * headline depends on whether the store offered a trial — so the page arrives
 * once, already right, rather than arriving and then changing its mind.
 *
 * Started from an effect once the view is mounted, never from render: a
 * spring started before its `Animated.View` existed froze part-way on the web
 * build once (see the hourly gift).
 */
export function Reveal({
  index,
  ready = true,
  children,
  style,
}: {
  /** Position in the cascade, from 0. */
  index: number
  ready?: boolean
  children: ReactNode
  style?: ViewStyle
}) {
  const reduceMotion = useReduceMotion()
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!ready) return
    progress.set(
      reduceMotion
        ? 1
        : withDelay(index * STAGGER, withTiming(1, { duration: DURATION, easing: EASE_OUT })),
    )
  }, [index, progress, ready, reduceMotion])

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * RISE }],
  }))

  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}
