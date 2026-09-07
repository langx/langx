import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native'
import { makeStyles, useTheme, type ThemeColors } from '../../lib/theme'

type Variant = 'primary' | 'secondary' | 'neutral' | 'danger' | 'ink'
type Size = 'default' | 'small'

interface ButtonProps {
  label: string
  onPress: () => void | Promise<void>
  loading?: boolean
  disabled?: boolean
  /**
   * `primary` is the one yellow per screen. `secondary` is the outlined second
   * action with a blue label — Create an account, Follow, Share my streak.
   * `neutral` is the same outline with the plain ink label, for a button that
   * neither commits nor competes: Cancel, Unblock, Continue with Google.
   * `danger` is the one red button in the app, on delete-account. `ink` is
   * the small dark tile that buys or copies — Copy, Scan, "150 tokens".
   */
  variant?: Variant
  /** `small` is the 40px in-row size: the ink tiles and the row-end outlines. */
  size?: Size
  /** Drawn before the label in the label's colour — the share glyph, the Google mark. */
  icon?: ReactNode
  /**
   * What a screen reader says instead of the label, when the label alone is
   * not a sentence — a store row's "200 tokens" needs the item's name too.
   */
  accessibilityLabel?: string
  style?: ViewStyle
}

/**
 * The v3 button, as langx.io draws it: a flat face on a hard 4px shadow that
 * the press collapses. It is the one piece of chrome in the app that is
 * allowed to look physical — everything else is rows on a white ground — and
 * that is what makes the yellow one read as *the* thing to press.
 *
 * The shadow is a second layer, not `shadowOffset`: Android blurs its shadows
 * whatever the radius says, and the web build does the same through
 * react-native-web, so a "hard" native shadow is only hard on iOS. Two views
 * are hard on all three. The face translates down by the shadow's height on
 * press and the shell shows through nowhere, which is the whole animation —
 * the prototype has no easing here either.
 *
 * The primary is yellow with black on it in **both** schemes — see the palette
 * note in `theme/tokens.ts`. Yellow appears exactly once per screen, on this.
 */
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'default',
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const isDisabled = disabled || loading
  const look = lookFor(colors, variant)
  const small = size === 'small'
  // The shadow's height, and how far the face drops to cover it.
  const drop = small ? 3 : 4

  return (
    <View style={[styles.wrap, isDisabled && styles.disabled, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        {...(accessibilityLabel ? { accessibilityLabel } : {})}
        onPress={() => void onPress()}
        disabled={isDisabled}
        style={[
          small ? styles.shellSmall : styles.shell,
          { backgroundColor: look.shadow, paddingBottom: drop },
        ]}
      >
        {({ pressed }) => (
          <View
            style={[
              small ? styles.faceSmall : styles.face,
              {
                backgroundColor: look.face,
                borderColor: look.border ?? look.face,
              },
              pressed && !isDisabled && { transform: [{ translateY: drop }] },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={look.label} />
            ) : (
              <>
                {icon}
                <Text
                  style={[
                    small ? styles.labelSmall : styles.label,
                    { color: look.label },
                    // The primary's word is a point larger than the outline's —
                    // the one that commits gets the louder label.
                    variant === 'primary' || variant === 'danger' ? styles.labelLoud : null,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </>
            )}
          </View>
        )}
      </Pressable>
    </View>
  )
}

/**
 * Face, label, shadow and (for the outlines) border, per variant, from the
 * palette — a function so dark mode gets its own values rather than light
 * mode's frozen into a module constant.
 */
function lookFor(colors: ThemeColors, variant: Variant) {
  switch (variant) {
    case 'primary':
      return { face: colors.primary, label: colors.primaryText, shadow: colors.primaryShade }
    case 'secondary':
      return { face: colors.bg, label: colors.accent, shadow: colors.border, border: colors.border }
    case 'neutral':
      return { face: colors.bg, label: colors.text, shadow: colors.border, border: colors.border }
    case 'danger':
      return { face: colors.danger, label: colors.textInverse, shadow: colors.dangerShade }
    case 'ink':
      /*
       * Ink has no shade token, and does not want one: its shadow is a
       * translucent black in both schemes, the same way the scrims are — a
       * dark tile on a dark ground still needs to look like it is standing on
       * something, and a lighter-than-ink colour there reads as a border.
       */
      return { face: colors.ink, label: colors.bg, shadow: 'rgba(0, 0, 0, 0.35)' }
  }
}

const useStyles = makeStyles(({ radius, font }) => ({
  /**
   * A default for the common case — a button at the bottom of a form column,
   * which should span it. It is **wrong inside a row**: pass
   * `style={{ width: 'auto' }}` there; `style` is merged last, so it wins.
   */
  wrap: { width: '100%' },
  disabled: { opacity: 0.5 },
  shell: { borderRadius: radius.lg },
  shellSmall: { borderRadius: radius.md },
  face: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 10,
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  faceSmall: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 8,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  /**
   * Upper-case and tracked, in the display face. The tracking is what keeps
   * capitals from setting solid at 800; it is the one place in the app where
   * text is letter-spaced at all.
   */
  label: {
    fontFamily: font.heading.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labelLoud: { fontSize: 15 },
  labelSmall: {
    fontFamily: font.heading.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
}))
