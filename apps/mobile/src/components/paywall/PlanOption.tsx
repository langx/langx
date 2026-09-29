import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { DISPLAY_FONT, DISPLAY_FONT_BOLD, makeStyles } from '../../lib/theme'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)

interface PlanOptionProps {
  selected: boolean
  onSelect: () => void
  /** "Yearly", "Monthly". */
  title: string
  /** The line under the title — what the charge actually is. */
  detail: string
  /** The headline figure: a month's worth, in the store's own format. */
  price: string
  /** What `price` is per — "a month". */
  unit: string
  /** The saving, when there is an honest one to state. */
  badge?: string | null
  /** The whole card as one sentence, since a screen reader reads it as one control. */
  accessibilityLabel: string
}

/**
 * One of the two ways to pay for Pro, as a card you pick rather than a tab you
 * switch.
 *
 * Both cards quote a **month** on the right so the comparison is one glance —
 * `$6.99` beside `$9.99` is the whole argument for the yearly plan — and each
 * says what is actually charged underneath, in the store's words, because the
 * month figure alone is not the price.
 *
 * The border is always two points wide and only changes colour, so picking a
 * card never moves a pixel of the layout around it. The dot inside the radio
 * is the one thing that springs: it is the part the finger just caused.
 */
export function PlanOption({
  selected,
  onSelect,
  title,
  detail,
  price,
  unit,
  badge,
  accessibilityLabel,
}: PlanOptionProps) {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const dot = useSharedValue(selected ? 1 : 0)
  const press = useSharedValue(1)

  useEffect(() => {
    const target = selected ? 1 : 0
    // A little overshoot on the way in: the tap carried the intent. None on
    // the way out, and none at all when motion is reduced.
    dot.set(
      reduceMotion
        ? target
        : selected
          ? withSpring(1, { duration: 300, dampingRatio: 0.6 })
          : withTiming(0, { duration: 150, easing: EASE_OUT }),
    )
  }, [dot, reduceMotion, selected])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, dot.get() * 2),
    transform: [{ scale: 0.5 + 0.5 * dot.get() }],
  }))
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }))

  function pressTo(value: number): void {
    if (reduceMotion) return
    press.set(withTiming(value, { duration: 120, easing: EASE_OUT }))
  }

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={accessibilityLabel}
        onPress={onSelect}
        onPressIn={() => pressTo(0.98)}
        onPressOut={() => pressTo(1)}
        style={[styles.card, selected ? styles.cardSelected : null]}
      >
        <View style={[styles.radio, selected ? styles.radioSelected : null]}>
          <Animated.View style={[styles.radioDot, dotStyle]} />
        </View>
        <View style={styles.middle}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        <View style={styles.end}>
          <Text style={styles.price} numberOfLines={1}>
            {price}
          </Text>
          <Text style={styles.unit} numberOfLines={1}>
            {unit}
          </Text>
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  card: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardSelected: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  radio: {
    alignItems: 'center',
    borderColor: colors.textFaint,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 12, width: 12 },
  middle: { flex: 1, gap: 2 },
  title: { color: colors.text, fontFamily: DISPLAY_FONT_BOLD, fontSize: 17, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  end: { alignItems: 'flex-end' },
  price: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: '800' },
  unit: { color: colors.textMuted, fontSize: 12 },
  // Straddles the top edge, at the end the price is on, so it never competes
  // with the title for width however long the translation runs.
  badge: {
    backgroundColor: colors.pro,
    borderRadius: radius.sm,
    end: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    position: 'absolute',
    top: -12,
  },
  // `bg` on `pro` rather than white, as on the paywall's PRO mark: white on
  // dark mode's lifted violet sits under 3:1.
  badgeText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
}))
