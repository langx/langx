import Feather from '@expo/vector-icons/Feather'
import { useEffect, useRef, type ReactElement } from 'react'
import { ActivityIndicator, Animated, Platform, Text, View, type ViewStyle } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useV3LaunchLook } from '../../hooks/useV3LaunchLook'
import { impact, notification } from '../../lib/haptics'
import { makeStyles, useTheme, type V3Colors } from '../../lib/theme'
import { disabledButtonLook, FILLED_BUTTON_VARIANTS } from '../../lib/theme/buttonDisabledLook'
import { EASE_POP } from '../../lib/theme/motionAnimated'
import { DURATION } from '../../lib/theme/motionValues'
import { PressableScaleBase } from './PressableScale'

type Variant = 'primary' | 'blue' | 'secondary' | 'neutral' | 'ink' | 'hue' | 'danger'
type Size = 'default' | 'medium' | 'small'
type Glyph = keyof typeof Feather.glyphMap

interface ButtonProps {
  label: string
  onPress: () => void | Promise<void>
  loading?: boolean
  /**
   * The action is done: a check takes the icon's place, popping in. Pair it
   * with the label the done state should read ("Copied") — the button does
   * not change its words by itself — and clear it to go back.
   */
  success?: boolean
  disabled?: boolean
  /**
   * `primary` is the yellow: the screen's one committing action, once per
   * screen. `blue` is the main action that does not commit — Invite a friend,
   * Next on the intro. `secondary` is the outline in the text colour, for
   * everything beside them: Create an account, Cancel, Continue with Google.
   * `ink` is the dark pill that buys or copies — Copy, Scan, "150 tokens".
   * `hue` is the dark pill on a partner's colour: ink in both schemes, as
   * everything on a hue is, where `ink` inverts with the ground and would go
   * pale after dark (`IconButton`'s `hue` look, as a pill).
   * `danger` is the red outline on the action that cannot be undone, and is
   * never yellow.
   *
   * `neutral` is the current look's ink-labelled outline. v3 draws it exactly
   * as `secondary`, and it stays a name only so the screens and open branches
   * that pass it keep compiling; new code says `secondary`.
   */
  variant?: Variant
  /**
   * `default` is the 56pt pill at the foot of a form. `medium`, 52, is a
   * stack of alternatives — the sign-in providers. `small` is the in-row
   * size, 44pt on iOS and 48dp on Android: the store's price pills, a
   * row-end Unblock.
   */
  size?: Size
  /**
   * A Feather glyph, drawn at the size's own glyph size in the label's
   * colour; or a ready element for a mark that keeps its own colours (the
   * Google "G").
   */
  icon?: Glyph | ReactElement | undefined
  /** Which side of the label the icon sits on. `end` is for a glyph that points onward. */
  iconPosition?: 'start' | 'end'
  /**
   * One haptic, only where the screen asks for it: `press` is a light tap as
   * the button is pressed, `success` the success pattern when `success` turns
   * on. Never both, and most buttons want neither.
   */
  haptic?: 'press' | 'success'
  /**
   * What a screen reader says instead of the label, when the label alone is
   * not a sentence — a store row's "200 tokens" needs the item's name too.
   */
  accessibilityLabel?: string
  style?: ViewStyle
}

/**
 * Face heights. With the touch band below, the whole target is 60, 52 and
 * 44 on iOS, and 60, 52 and 48 on Android — never under the 44pt and 48dp
 * each platform asks for.
 */
export const BUTTON_FACE = {
  default: 56,
  medium: 52,
  small: Platform.select({ android: 48, default: 44 }),
} as const

/**
 * Above and below the large face: a 56pt pill with a 60pt target, which is
 * also the footprint the current look's face and drop took — so no screen
 * that stacks buttons moves by a point when this one changes.
 */
const TOUCH_BAND = 2

/**
 * v3's button: a flat pill, the label in sentence case, and a small shrink
 * under the finger.
 *
 * The current look drew a face on a hard 4px shadow that the press
 * collapsed — the one piece of chrome allowed to look physical. v3 is flat,
 * and the yellow is still unmistakably the thing to press because it is the
 * only yellow on the screen, not because it is the only thing standing up.
 *
 * Sentence case, untransformed. An upper-case transform is never done in the
 * app's language: iOS upper-cases with no locale at all, so the Turkish
 * "Giriş yap" came out "GIRIŞ YAP" where Turkish writes "GİRİŞ YAP", and
 * Android upper-cases in the phone's locale, so an English "Sign in" on a
 * Turkish phone gained a dotted İ. Words are drawn as the catalogue writes them.
 *
 * Nothing truncates. The face has a minimum height rather than a height, and
 * the label wraps, so at the largest text sizes a long label makes a taller
 * pill instead of an ellipsis.
 *
 * Still React Native's `Animated`, through `PressableScale`: the welcome
 * screen and every onboarding step render this, and the launch path stays off
 * Reanimated (_The row swipe runs on the UI thread_).
 */
export function Button({
  label,
  onPress,
  loading = false,
  success = false,
  disabled = false,
  variant = 'primary',
  size = 'default',
  icon,
  iconPosition = 'start',
  haptic,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { v3 } = useTheme()
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const isDisabled = disabled || loading
  /*
   * Under `flags.v3Home` a filled button that cannot be pressed is grey
   * rather than its own colour at half strength (`disabledButtonLook`), and a
   * loading one keeps its colour: the spinner already says to wait, and the
   * fade made the yellow olive after dark. `useV3LaunchLook` because this
   * draws on the launch path too — welcome, sign-in, onboarding — and has to
   * agree with the screen around it.
   */
  const v3Look = useV3LaunchLook()
  const greyed =
    v3Look &&
    disabled &&
    !loading &&
    (FILLED_BUTTON_VARIANTS as readonly Variant[]).includes(variant)
  const faded = v3Look ? disabled && !greyed : isDisabled
  const look = greyed ? disabledButtonLook(v3.colors) : lookFor(v3.colors, variant)
  const glyphSize = size === 'small' ? v3.icon.sm : size === 'medium' ? v3.icon.md : v3.icon.lg

  // The check's pop, and the success haptic, on the change rather than on
  // every render that still has `success` set.
  const pop = useRef(new Animated.Value(1)).current
  const wasSuccess = useRef(success)
  useEffect(() => {
    if (success && !wasSuccess.current) {
      if (haptic === 'success') void notification('success')
      if (!reduceMotion) {
        pop.setValue(0.4)
        Animated.timing(pop, {
          toValue: 1,
          duration: DURATION.enter,
          easing: EASE_POP,
          useNativeDriver: true,
        }).start()
      }
    }
    wasSuccess.current = success
  }, [success, haptic, reduceMotion, pop])

  const glyph = success ? 'check' : icon
  const iconNode =
    glyph === undefined ? null : typeof glyph === 'string' ? (
      // Transformed from the first render and never flattened, for the
      // Fabric reason in `PressableScale`: success often lands in the same
      // commit as a navigation away.
      <Animated.View collapsable={false} style={{ transform: [{ scale: pop }] }}>
        <Feather name={glyph} size={glyphSize} color={look.label} />
      </Animated.View>
    ) : (
      glyph
    )

  return (
    <View
      // Always a real view too: `disabled` is an opacity, and an opacity below
      // one also stops a view being flattened. A form whose request settles
      // as it navigates away (the report screen: pending → done → back) flips
      // it in exactly the commit `PressableScale` describes.
      collapsable={false}
      style={[styles.wrap, faded && styles.disabled, style]}
    >
      <PressableScaleBase
        reduceMotion={reduceMotion}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        {...(accessibilityLabel ? { accessibilityLabel } : {})}
        onPress={() => {
          if (haptic === 'press') void impact('light')
          void onPress()
        }}
        disabled={isDisabled}
        touchStyle={size === 'default' ? styles.band : null}
        style={[
          styles.face,
          size === 'small'
            ? styles.faceSmall
            : size === 'medium'
              ? styles.faceMedium
              : styles.faceDefault,
          { backgroundColor: look.face, borderColor: look.border },
        ]}
      >
        {/* Hidden rather than removed while loading, so the pill keeps its width. */}
        <View
          style={[
            styles.content,
            size === 'small' && styles.contentSmall,
            loading && styles.hidden,
          ]}
        >
          {iconPosition === 'start' ? iconNode : null}
          <Text
            style={[size === 'small' ? styles.labelSmall : styles.label, { color: look.label }]}
          >
            {label}
          </Text>
          {iconPosition === 'end' ? iconNode : null}
        </View>
        {loading ? <ActivityIndicator color={look.label} style={styles.spinner} /> : null}
      </PressableScaleBase>
    </View>
  )
}

/**
 * Face, label and border per variant, from v3's palette — a function so dark
 * mode gets its own values rather than light mode's frozen into a constant.
 * The outlined variants are see-through, so they sit on a card or a tinted
 * block as well as on the ground.
 */
function lookFor(colors: V3Colors, variant: Variant) {
  switch (variant) {
    case 'primary':
      return { face: colors.yellow, label: colors.onYellow, border: colors.yellow }
    case 'blue':
      return { face: colors.blue, label: colors.onBlue, border: colors.blue }
    case 'secondary':
    case 'neutral':
      return { face: 'transparent', label: colors.fg, border: colors.fg }
    case 'ink':
      return { face: colors.pill, label: colors.pillText, border: colors.pill }
    case 'hue':
      // `onBlue`: the palette's one white that stays white after dark.
      return { face: colors.ink, label: colors.onBlue, border: colors.ink }
    case 'danger':
      return { face: 'transparent', label: colors.danger, border: colors.danger }
  }
}

const useStyles = makeStyles(({ v3 }) => ({
  /**
   * A default for the common case — a button at the bottom of a form column,
   * which should span it. It is **wrong inside a row**: pass
   * `style={{ width: 'auto' }}` there; `style` is merged last, so it wins.
   */
  wrap: { width: '100%' },
  disabled: { opacity: 0.5 },
  band: { paddingVertical: TOUCH_BAND },
  face: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
  },
  faceDefault: {
    minHeight: BUTTON_FACE.default,
    paddingHorizontal: v3.space[24],
    paddingVertical: v3.space[8],
  },
  faceMedium: {
    minHeight: BUTTON_FACE.medium,
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[8],
  },
  faceSmall: {
    minHeight: BUTTON_FACE.small,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[6],
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: v3.space[10],
    justifyContent: 'center',
  },
  contentSmall: { gap: v3.space[8] },
  hidden: { opacity: 0 },
  label: { ...v3.type.button, flexShrink: 1, textAlign: 'center' },
  labelSmall: { ...v3.type.buttonSmall, flexShrink: 1, textAlign: 'center' },
  spinner: { bottom: 0, end: 0, position: 'absolute', start: 0, top: 0 },
}))
