import { useEffect, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { makeStyles } from '../../lib/theme'
import { SPRING, unlessReduced } from '../../lib/theme/motion'

/** Points. The mark sits on the meta line, so it is about a line of label tall. */
const MARK = 18

/**
 * The line under something of yours that did not go — v3's stand-in for the
 * meta line ("10:20 · Read") a sent message carries in the same place.
 *
 * A red disc with an ink ring and a "!" knocked out of it, then the words in
 * the same red. The ring is the v3 outline every control on the ground wears;
 * without it the red dot read as an unread badge. It pops in with the
 * choice-landing spring when the row appears and again when a retry fails, so
 * a failure is noticed without the row itself moving.
 *
 * While a retry is out the disc goes hollow and grey and the words say so:
 * the row is not failed any more, only not yet sent.
 */
export function NotSentLineV3({ label, retrying = false }: { label: string; retrying?: boolean }) {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const scale = useSharedValue(1)

  useEffect(() => {
    if (retrying) return
    // From an effect, never during render: see `lib/theme/motion`.
    scale.set(0.6)
    scale.set(unlessReduced(reduceMotion, 1, (to) => withSpring(to, SPRING.select)))
  }, [retrying, reduceMotion, scale])

  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  return (
    <View style={styles.row}>
      <Animated.View
        style={[styles.mark, retrying ? styles.markWaiting : styles.markFailed, markStyle]}
      >
        {retrying ? null : (
          <>
            <View style={styles.bang} />
            <View style={styles.dot} />
          </>
        )}
      </Animated.View>
      <Text style={[styles.label, retrying && styles.labelWaiting]}>{label}</Text>
    </View>
  )
}

/**
 * Something of yours that did not go, as one tap target: whatever is passed
 * in — the outlined bubble — with `NotSentLineV3` under it on your side, the
 * way a sent message carries its meta. Tap retries and long-press opens the
 * unsent menu; both are the caller's handlers, unchanged.
 */
export function NotSentColumnV3({
  label,
  retrying = false,
  onPress,
  onLongPress,
  children,
}: {
  label: string
  retrying?: boolean
  onPress: () => void
  onLongPress: () => void
  children: ReactNode
}) {
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.column, pressed && styles.pressed]}
    >
      {children}
      <NotSentLineV3 label={label} retrying={retrying} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  column: { alignItems: 'flex-end', flexShrink: 1, gap: v3.space[4], maxWidth: '82%' },
  pressed: { opacity: 0.6 },
  row: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  mark: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    gap: 1.5,
    height: MARK,
    justifyContent: 'center',
    width: MARK,
  },
  // The ink ring is `fg`, the ground's ink: dark on light, light on dark.
  markFailed: { backgroundColor: v3.colors.danger, borderColor: v3.colors.fg },
  markWaiting: { backgroundColor: 'transparent', borderColor: v3.colors.muted },
  /*
   * The "!" in the ground's colour, so it reads on both reds: white on the
   * light scheme's deep red, near-black on the dark scheme's pale one.
   */
  bang: { backgroundColor: v3.colors.bg, borderRadius: 1, height: 6, width: 2.5 },
  dot: { backgroundColor: v3.colors.bg, borderRadius: 1.25, height: 2.5, width: 2.5 },
  label: { ...v3.type.label, color: v3.colors.danger },
  labelWaiting: { color: v3.colors.muted },
}))
