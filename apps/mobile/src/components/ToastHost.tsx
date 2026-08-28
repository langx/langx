import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dismissToast, subscribeToToasts, type Toast } from '../lib/toast'
import { colors, font, radius, spacing } from '../lib/theme'

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
 * — only the banner itself is tappable, and tapping it dismisses early.
 */
export function ToastHost() {
  const [toast, setToast] = useState<Toast | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  useEffect(() => subscribeToToasts(setToast), [])

  useEffect(() => {
    if (!toast) return
    opacity.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start()
    // Keyed on the id, so a second toast arriving restarts the clock for
    // itself rather than inheriting what was left of the first one's.
    const timer = setTimeout(() => dismissToast(toast.id), toast.durationMs)
    return () => clearTimeout(timer)
  }, [toast, opacity])

  if (!toast) return null

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.layer, { opacity, paddingTop: insets.top + spacing.md }]}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={() => dismissToast(toast.id)}
        style={styles.banner}
      >
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Top, not bottom, which is where a toast usually goes. The bottom of this
  // app is where its buttons are — the tab bar on every signed-in screen, and
  // the intro's Next — and the banner is tappable, so four seconds of it
  // sitting there is four seconds of a dead button. At the top it covers a
  // heading, which nobody was going to press.
  layer: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // Neutral dark rather than `colors.success`: these sentences report what
  // happened, and green would dress "Signed out" up as a celebration.
  banner: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    maxWidth: 420,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  text: { ...font.body, color: colors.primaryText, textAlign: 'center' },
})
