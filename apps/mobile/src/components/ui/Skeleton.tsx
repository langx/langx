import { useEffect } from 'react'
import { Animated, type ViewStyle } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useV3Home } from '../../hooks/useV3Home'
import { sharedLoop } from '../../lib/sharedLoop'
// `radius` stays a direct import: it is scheme-independent, and `corner`
// defaults from it before any hook could have run.
import { makeStyles, radius } from '../../lib/theme'

const MIN_OPACITY = 0.35
const STILL_OPACITY = 0.6

/*
 * One pulse for every skeleton on screen, so a loading page breathes as one
 * thing. Each block used to run its own loop from the frame it mounted, and a
 * list of them shimmered out of phase. A block that mounts mid-pulse joins it
 * where it is; the last one to unmount stops it (`sharedLoop`).
 *
 * One value driving many views is fine for the native driver: each view
 * connects its own props node to the same value node.
 */
const pulse = new Animated.Value(MIN_OPACITY)
const pulseLoop = sharedLoop(() => {
  pulse.setValue(MIN_OPACITY)
  const loop = Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: MIN_OPACITY, duration: 700, useNativeDriver: true }),
    ]),
  )
  return { start: () => loop.start(), stop: () => loop.stop() }
})

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

  useEffect(() => {
    // Reduced motion: a still block, a little stronger than the pulse's low
    // point so it reads as a placeholder rather than as a faded one. It does
    // not hold the shared pulse, so a screen of still blocks runs no loop.
    if (reduceMotion) return
    return pulseLoop.acquire()
  }, [reduceMotion])

  return (
    <Animated.View
      // Not `accessibilityRole="none"`: a screen reader should skip this
      // entirely rather than announce an empty element per placeholder row.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        v3Look ? styles.blockV3 : styles.block,
        { borderRadius: corner, height, opacity: reduceMotion ? STILL_OPACITY : pulse },
        width ? { width } : null,
        style,
      ]}
    />
  )
}

const useStyles = makeStyles(({ colors, v3 }) => ({
  block: { backgroundColor: colors.border },
  /*
   * Under `flags.v3Home`: the `track` grey, v3's colour for a thing not yet
   * filled in (the progress bar's empty part). `surface` would vanish on the
   * grey cards the v3 screens put their placeholders on.
   */
  blockV3: { backgroundColor: v3.colors.track },
}))
