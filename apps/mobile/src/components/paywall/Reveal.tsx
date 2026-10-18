import { useEffect, type ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { STAGGER, TIMING, unlessReduced } from '../../lib/theme/motion'

/** How far a block rises. Enough to read as arriving, not as travelling. */
const RISE = 8

/**
 * One block of the paywall settling into place on first render.
 *
 * The paywall is opened a few times in someone's life, not a few times a
 * minute, so it can afford an entrance — but only one: blocks fade and rise
 * 8pt, staggered, and nothing blocks a tap while they do. With reduced motion
 * on they are simply there.
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
      unlessReduced(reduceMotion, 1, (to) =>
        withDelay(index * STAGGER, withTiming(to, TIMING.enter)),
      ),
    )
  }, [index, progress, ready, reduceMotion])

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * RISE }],
  }))

  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}
