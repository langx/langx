/**
 * PROTOTYPE ONLY — the chat entrance question ("rule 13").
 *
 * A message that arrived while the thread was open plays its entrance once,
 * inside its own row, by animating its own shared value from an effect — never
 * Reanimated's `entering`, the layout animation 4.5.1 crashes on in recycled
 * rows. History, a page of older messages, a reopened thread and a row the
 * list virtualised away and brought back all mount at rest: `at` is only set
 * for live arrivals, and only counts for `FRESH_MS` (RewardChipV3's rule).
 */
import { useEffect, type ReactNode } from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { EASE_OUT } from '../lib/theme/motion'
import { prefersReducedMotionNow, type EntranceVariant } from './protoVariant'

const FRESH_MS = 1500

export function EntranceV3({
  variant,
  at,
  mine,
  children,
}: {
  variant: EntranceVariant
  /** When the message arrived live, `Date.now()`; undefined for history. */
  at: number | undefined
  mine: boolean
  children: ReactNode
}) {
  const reduceHook = useReduceMotion()
  const reduce = reduceHook || prefersReducedMotionNow()
  const play = variant !== 'none' && !reduce && at !== undefined && Date.now() - at < FRESH_MS
  const shown = useSharedValue(play ? 0 : 1)

  useEffect(() => {
    if (!play) {
      shown.set(1)
      return
    }
    shown.set(
      variant === 'rise'
        ? withTiming(1, { duration: 180, easing: EASE_OUT })
        : withSpring(1, { duration: 380, dampingRatio: 0.62 }),
    )
    // Once, on mount; a late "reduce motion" answer lands it at rest.
  }, [reduce])

  const motion = useAnimatedStyle(() => {
    const p = shown.get()
    if (variant === 'spring') {
      return {
        opacity: Math.min(1, p * 2.5),
        transform: [{ scale: 0.82 + 0.18 * p }],
      }
    }
    return {
      opacity: Math.min(1, p),
      transform: [{ translateY: (1 - p) * 10 }],
    }
  })

  if (variant === 'none') return <>{children}</>
  return (
    <Animated.View
      style={[
        motion,
        // The sender's corner, so a spring grows out of the side the bubble
        // hangs from rather than out of the middle of the screen.
        variant === 'spring' ? { transformOrigin: mine ? 'right bottom' : 'left bottom' } : null,
      ]}
    >
      {children}
    </Animated.View>
  )
}
