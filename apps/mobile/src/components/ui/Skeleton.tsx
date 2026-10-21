import { useEffect, useRef } from 'react'
import { Animated, type ViewStyle } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useV3Home } from '../../hooks/useV3Home'
// `radius` stays a direct import: it is scheme-independent, and `corner`
// defaults from it before any hook could have run.
import { makeStyles, radius } from '../../lib/theme'

/**
 * A placeholder block that pulses while its real content loads.
 *
 * RN's `Animated` rather than Reanimated, following `ToastHost`. Opacity with
 * `useNativeDriver` already runs off the JS thread, which is the only thing
 * Reanimated would have bought here.
 *
 * The second half of that argument no longer holds: `SwipeableRow` now imports
 * Reanimated, so its worklets bundle is in the shipped web build whatever this
 * file does. That was paid for a gesture that has to track a finger; a pulse
 * on a placeholder is not one, and there is still nothing to gain by
 * rewriting it.
 */
export function Skeleton({
  width,
  height = 14,
  radius: corner = radius.sm,
  style,
}: {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: ViewStyle
}) {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const v3Look = useV3Home()
  const opacity = useRef(new Animated.Value(MIN_OPACITY)).current

  useEffect(() => {
    // Reduced motion: a still block, a little stronger than the pulse's low
    // point so it reads as a placeholder rather than as a faded one.
    if (reduceMotion) {
      opacity.setValue(STILL_OPACITY)
      return
    }
    opacity.setValue(MIN_OPACITY)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: MIN_OPACITY, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity, reduceMotion])

  return (
    <Animated.View
      // Not `accessibilityRole="none"`: a screen reader should skip this
      // entirely rather than announce an empty element per placeholder row.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        v3Look ? styles.blockV3 : styles.block,
        { borderRadius: corner, height, opacity },
        width ? { width } : null,
        style,
      ]}
    />
  )
}

const MIN_OPACITY = 0.35
const STILL_OPACITY = 0.6

const useStyles = makeStyles(({ colors, v3 }) => ({
  block: { backgroundColor: colors.border },
  /*
   * Under `flags.v3Home`: the `track` grey, v3's colour for a thing not yet
   * filled in (the progress bar's empty part). `surface` would vanish on the
   * grey cards the v3 screens put their placeholders on.
   */
  blockV3: { backgroundColor: v3.colors.track },
}))
