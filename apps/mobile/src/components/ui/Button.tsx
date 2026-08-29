import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native'
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
 * A user who has learned "the yellow one sends it" should not have to relearn
 * that after dark.
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

  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && (variant === 'primary' ? styles.pressedPrimary : styles.pressed),
        style,
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
  )
}

const useStyles = makeStyles(({ colors, radius, spacing, cardShadow, font }) => ({
  base: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    /**
     * A default for the common case — a button at the bottom of a form column,
     * which should span it. It is **wrong inside a row**: 100% of the row
     * leaves nothing for the siblings, and a `flex: 1` sibling collapses to a
     * single character per line instead of pushing back. Pass
     * `style={{ width: 'auto' }}` there; `style` is merged last, so it wins.
     */
    width: '100%',
  },
  primary: { backgroundColor: colors.primary, ...cardShadow },
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
  pressed: { opacity: 0.8 },
  primaryLabel: {
    color: colors.primaryText,
    fontFamily: font.heading.fontFamily,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: colors.text,
    fontFamily: font.heading.fontFamily,
    fontSize: 16,
    fontWeight: '700',
  },
}))
