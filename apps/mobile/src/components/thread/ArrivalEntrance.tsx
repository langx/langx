import { useEffect, useState, type ReactNode } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { EASE_OUT } from '../../lib/theme/motion'

/** How far a new bubble rises into place, in points. */
const RISE = 10
/** Short: a chat is read as it arrives, and nothing should wait on the motion. */
const ENTRANCE = { duration: 180, easing: EASE_OUT }

/**
 * A message that has just arrived rises a few points and fades in, once,
 * inside its own row.
 *
 * Rule 13 holds: nothing animates the list or the row's height — only this
 * row's transform and opacity, on the UI thread, started from an effect.
 * Whether to play is decided once, on mount, by the caller (`play`: the row
 * arrived live, per the screen's arrival map, and is newer than the newest
 * row already on screen), and a row that does not play renders its
 * children with no animated node around them, so history costs nothing.
 *
 * Bottom to top on screen even though the thread is an inverted list: the
 * list flips every cell back upright, so inside a row a positive translateY
 * is still downward, and the bubble starts below its place and rises.
 */
export function ArrivalEntrance({ play, children }: { play: boolean; children: ReactNode }) {
  // Frozen at mount: the row's shape must not change under it afterwards, or
  // React would remount the bubble when the wrapper appeared or went.
  const [animated] = useState(play)
  if (!animated) return <>{children}</>
  return <Rising>{children}</Rising>
}

function Rising({ children }: { children: ReactNode }) {
  const shown = useSharedValue(0)
  useEffect(() => {
    shown.set(withTiming(1, ENTRANCE))
  }, [shown])
  const motion = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * RISE }],
  }))
  return <Animated.View style={motion}>{children}</Animated.View>
}
