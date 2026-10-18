import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { makeStyles } from '../../lib/theme'
import { TIMING, unlessReduced } from '../../lib/theme/motion'

interface ProgressBarProps {
  /** Clamped to 0–1; callers compute it from real counts and can overshoot. */
  value: number
  height?: number
  /** Defaults to v3's `blue`. Pass a tone when the bar belongs to one. */
  color?: string
  accessibilityLabel: string
}

/**
 * v3's bar: a blue fill on a pale track, both pill-ended.
 *
 * The fill moves to a new value on the motion module's `enter` timing — a
 * card graded in an Echo session pushes it forward rather than jumping it
 * there — and is simply at its value when it first appears, so a list of
 * packs does not fill up row by row as it scrolls in. Under reduce motion it
 * jumps.
 *
 * On Reanimated, so **not for the launch path**: the onboarding steps draw
 * their own steps in `StepProgress` rather than rendering this.
 */
export function ProgressBar({ value, height = 4, color, accessibilityLabel }: ProgressBarProps) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const fraction = Math.max(0, Math.min(1, value))

  const shown = useSharedValue(fraction)
  useEffect(() => {
    shown.set(unlessReduced(reduce, fraction, (to) => withTiming(to, TIMING.enter)))
  }, [fraction, reduce, shown])
  const fillStyle = useAnimatedStyle(() => ({ width: `${shown.get() * 100}%` }))

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={[styles.track, { height }]}
    >
      <Animated.View
        collapsable={false}
        style={[styles.fill, fillStyle, color ? { backgroundColor: color } : null]}
      />
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // `line` until the palette has a track grey; the drawings' is a shade
  // darker. Blue, not yellow: yellow belongs to the one committing control on
  // a screen, and a bar commits nothing.
  track: { backgroundColor: v3.colors.line, borderRadius: v3.radius.pill, overflow: 'hidden' },
  fill: { backgroundColor: v3.colors.blue, borderRadius: v3.radius.pill, height: '100%' },
}))
