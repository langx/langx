import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dismissToast, subscribeToToasts, type Toast } from '../lib/toast'
import { OVERLAY_LAYER } from '../lib/overlayLayers'
import { makeStyles } from '../lib/theme'

/**
 * Draws whatever `src/lib/toast.ts` has queued.
 *
 * Mounted once at the root and *after* the navigator, so it paints over every
 * screen and survives the screen underneath it going away — signing out
 * replaces the route immediately, and a banner owned by the profile screen
 * would die with it, which is the one moment it has something to say.
 *
 * A plain absolutely positioned view rather than `Modal`, which is what
 * `AlertHost` uses: a `Modal` takes the touches of the whole screen, and a
 * message with nothing to decide must not stop anyone from carrying on while
 * it is up. `pointerEvents="box-none"` keeps that true of the full-width layer
 * — only the pill itself is tappable, and tapping it dismisses early.
 */
export function ToastHost() {
  const styles = useStyles()

  const [toast, setToast] = useState<Toast | null>(null)
  const enter = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  useEffect(() => subscribeToToasts(setToast), [])

  useEffect(() => {
    if (!toast) return
    enter.setValue(0)
    Animated.timing(enter, { toValue: 1, duration: 300, useNativeDriver: true }).start()
    // Keyed on the id, so a second toast arriving restarts the clock for
    // itself rather than inheriting what was left of the first one's.
    const timer = setTimeout(() => dismissToast(toast.id), toast.durationMs)
    return () => clearTimeout(timer)
  }, [toast, enter])

  if (!toast) return null

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.layer,
        // Above the tab bar with room to spare, and above the committing
        // button on a screen that has one — the band v3 leaves for it.
        { bottom: insets.bottom + 86 },
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={() => dismissToast(toast.id)}
        style={styles.pill}
      >
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors, spacing, radius, cardShadow }) => ({
  /**
   * Bottom, where v3 puts it: the confirmation appears near the thumb that
   * caused it. It used to sit at the top so as not to cover a button, and the
   * pill is narrow enough now — hugging its sentence rather than spanning the
   * screen — that what it covers is a sliver of whatever is under it, for four
   * seconds, and a tap on the pill ends that early.
   */
  layer: {
    alignItems: 'center',
    // The same reason the message banner carries one; see `overlayLayers.ts`.
    elevation: OVERLAY_LAYER.toast,
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    zIndex: OVERLAY_LAYER.toast,
  },
  // Ink on the ground's colour, not yellow: these sentences report what
  // happened, and the one yellow on a screen is reserved for the thing that
  // makes something happen.
  pill: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    maxWidth: 420,
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.md,
    ...cardShadow,
  },
  text: { color: colors.bg, fontSize: 14, fontWeight: '600', textAlign: 'center' },
}))
