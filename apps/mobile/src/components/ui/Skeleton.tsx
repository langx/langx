import { useEffect, useRef } from 'react'
import { Animated, type ViewStyle } from 'react-native'
// `radius` stays a direct import: it is scheme-independent, and `corner`
// defaults from it before any hook could have run.
import { makeStyles, radius } from '../../lib/theme'

/**
 * A placeholder block that pulses while its real content loads.
 *
 * RN's `Animated` rather than Reanimated, following `ToastHost`. Opacity with
 * `useNativeDriver` already runs off the JS thread, which is the only thing
 * Reanimated would have bought — and Reanimated 4 is imported by nothing in
 * this app, so reaching for it here would put its worklets bundle into the
 * shipped web build for a nicer easing curve.
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
  const opacity = useRef(new Animated.Value(MIN_OPACITY)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: MIN_OPACITY, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <Animated.View
      // Not `accessibilityRole="none"`: a screen reader should skip this
      // entirely rather than announce an empty element per placeholder row.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { borderRadius: corner, height, opacity },
        width ? { width } : null,
        style,
      ]}
    />
  )
}

const MIN_OPACITY = 0.35

const useStyles = makeStyles(({ colors }) => ({
  block: { backgroundColor: colors.border },
}))
