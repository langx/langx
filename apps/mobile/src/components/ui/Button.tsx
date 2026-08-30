import { useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, Text, type ViewStyle } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

interface ButtonProps {
  label: string
  onPress: () => void | Promise<void>
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  style?: ViewStyle
}

/**
 * The primary is the app's committing action, and it is `primary` yellow with
 * black on it in **both** schemes — see the palette note in `theme/tokens.ts`.
 * v3 tightens the rule: yellow appears exactly once per screen, on this.
 *
 * The press animates scale as well as colour. RN's `Animated` rather than
 * Reanimated, following `Skeleton`: a transform on the native driver is all
 * this needs, and Reanimated is imported by nothing else in the app.
 */
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const isDisabled = disabled || loading

  const scale = useRef(new Animated.Value(1)).current
  const press = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 5,
    }).start()

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.wrap, style]}>
      <Pressable
        onPress={() => void onPress()}
        onPressIn={() => !isDisabled && press(0.97)}
        onPressOut={() => press(1)}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          variant === 'primary' ? styles.primary : styles.secondary,
          isDisabled && styles.disabled,
          pressed &&
            !isDisabled &&
            (variant === 'primary' ? styles.pressedPrimary : styles.pressed),
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? colors.primaryText : colors.text} />
        ) : (
          <Text style={variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing, font }) => ({
  /**
   * The scale transform lives on a wrapper so `style` overrides (width,
   * margins) apply to the box the layout sees, not the animated copy.
   * A default for the common case — a button at the bottom of a form column,
   * which should span it. It is **wrong inside a row**: pass
   * `style={{ width: 'auto' }}` there; `style` is merged last, so it wins.
   */
  wrap: { width: '100%' },
  base: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  disabled: { opacity: 0.5 },
  // The primary has a pressed *colour* rather than the opacity the outline
  // variant uses: fading yellow toward the page reads as "disabled", which is
  // the one thing a press must not look like.
  pressedPrimary: { backgroundColor: colors.primaryShade },
  pressed: { backgroundColor: colors.fill },
  primaryLabel: {
    color: colors.primaryText,
    fontFamily: font.heading.fontFamily,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryLabel: {
    color: colors.text,
    fontFamily: font.heading.fontFamily,
    fontSize: 15,
    fontWeight: '800',
  },
}))
