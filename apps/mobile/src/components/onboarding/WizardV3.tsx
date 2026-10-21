import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'
import { useState, type ReactNode } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useLocale, useT } from '../../i18n'
import { ONBOARDING_STEPS, type OnboardingStep } from '../../lib/onboardingStep'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { IconButton } from '../ui/IconButton'

/*
 * The pieces every screen on the redesign's launch path shares: the wizard's
 * header, its title, the choice row and the text field.
 *
 * Nothing here imports Reanimated, directly or through a component: these are
 * the welcome screen and the onboarding steps, and the launch path stays on
 * React Native's `Animated` (_The row swipe runs on the UI thread, and
 * Reanimated is the price_; _Buttons are flat pills in sentence case, and
 * still press on `Animated`_).
 */

/**
 * Whether Nunito Black has arrived, for the titles. The root does not load it
 * (`DISPLAY_FONT_BLACK`): it would hold every cold start, flag off included,
 * for a face only these screens draw. So each screen asks for it itself and
 * nothing waits — until it lands the title is set in the ExtraBold the root
 * did load, as Home's and Chats' titles are. On a phone the face is in the
 * bundle and arrives under the splash.
 */
export function useBlackFont(): boolean {
  const [loaded] = useFonts({ Nunito_900Black })
  return loaded
}

/**
 * The exchange's arrow: one line, a head at each end. Two-headed on purpose —
 * this is an exchange, not a translation — and drawn, because Feather has no
 * such glyph and the text arrow (U+2194) is drawn by each platform in its own
 * weight.
 */
export function ExchangeGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** The wizard's title and the line under it. */
export function WizardTitle({ title, body }: { title: string; body?: string | undefined }) {
  const styles = useStyles()
  const black = useBlackFont()
  return (
    <View style={styles.titleBlock}>
      <Text accessibilityRole="header" style={[styles.title, !black && styles.titleFallback]}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  )
}

/**
 * "Step 1 of 5" over one bar per step, as `StepProgress` draws it, with the
 * back arrow as an `IconButton`: the platform's minimum target, where the
 * current look's arrow was a 34pt square widened by `hitSlop`.
 */
export function WizardHeaderV3({
  step,
  steps = ONBOARDING_STEPS,
  onBack,
}: {
  step: OnboardingStep
  steps?: readonly OnboardingStep[] | undefined
  onBack?: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const { isRtl } = useLocale()
  const index = steps.indexOf(step)
  const total = steps.length
  const stepText = t('onboarding.stepOf', { step: index + 1, total })

  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton
          icon={isRtl ? 'chevron-right' : 'chevron-left'}
          accessibilityLabel={t('common.backPlain')}
          onPress={onBack}
          style={styles.back}
        />
      ) : null}
      <View style={styles.progress}>
        <Text style={styles.step}>{stepText}</Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={stepText}
          accessibilityValue={{ min: 1, max: total, now: index + 1 }}
          style={styles.bars}
        >
          {steps.map((each, at) => (
            <View key={each} style={[styles.bar, at <= index && styles.barDone]} />
          ))}
        </View>
      </View>
    </View>
  )
}

/**
 * One answer in a list of them — a language, a level. A grey block that gains
 * an ink edge and a filled ring when chosen, so the choice shows in the shape
 * as well as the colour. A row that cannot be picked here dims and says why
 * in a tag where its ring would be.
 */
export function ChoiceRowV3({
  label,
  detail,
  selected,
  disabled = false,
  tag,
  leading,
  onPress,
  accessibilityLabel,
  tall = false,
  role = 'radio',
}: {
  label: string
  detail?: string | undefined
  selected: boolean
  disabled?: boolean
  /** Why it cannot be picked: the other tab's name. Shown in place of the ring. */
  tag?: string | undefined
  leading?: ReactNode
  onPress: () => void
  accessibilityLabel?: string
  /** The levels' 72pt rows, which carry a disc and bars before the words. */
  tall?: boolean
  /** `checkbox` where more than one may be chosen — the learning languages. */
  role?: 'radio' | 'checkbox'
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        tall && styles.choiceTall,
        selected && styles.choiceOn,
        disabled && styles.choiceDisabled,
        pressed && styles.pressed,
      ]}
    >
      {leading}
      <View style={styles.choiceText}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
      </View>
      {tag ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ) : (
        <View style={[styles.ring, selected && styles.ringOn]}>
          {selected ? <Feather name="check" size={v3.icon.xs} color={v3.colors.pillText} /> : null}
        </View>
      )}
    </Pressable>
  )
}

interface FieldV3Props extends TextInputProps {
  label?: string
  /** The line under the field while nothing is wrong. */
  hint?: string | undefined
  error?: string | undefined
  /** Drawn inside the pill, before the text — the handle's "@". */
  prefix?: ReactNode
  /** Drawn inside the pill, after the text — the handle's check. */
  suffix?: ReactNode
  /** The handle's bigger face. */
  large?: boolean
  /**
   * Laid out left to right whatever the app's direction: a username is Latin
   * by its own rules, and in Arabic its "@" would otherwise sit at the far
   * end of the pill from the name it belongs to.
   */
  ltr?: boolean
}

/**
 * The redesign's text field: a grey pill that gains an ink edge while it is
 * being typed in, and a red one when it is wrong. The edge is always drawn,
 * in the fill's own colour at rest, so gaining one does not move the text.
 */
export function FieldV3({
  label,
  hint,
  error,
  prefix,
  suffix,
  large = false,
  ltr = false,
  multiline,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: FieldV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View
        style={[
          styles.fieldBox,
          multiline ? styles.fieldMultiline : large ? styles.fieldLarge : null,
          focused && styles.fieldFocused,
          error ? styles.fieldError : null,
          ltr && styles.ltr,
        ]}
      >
        {prefix}
        <TextInput
          placeholderTextColor={v3.colors.muted}
          autoCorrect={false}
          {...inputProps}
          multiline={multiline}
          {...(label && !inputProps.accessibilityLabel ? { accessibilityLabel: label } : {})}
          style={[
            styles.input,
            large && styles.inputLarge,
            multiline && styles.inputMultiline,
            ltr && styles.inputLtr,
            style,
          ]}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
        />
        {suffix}
      </View>
      {error ? (
        <Text style={styles.fieldErrorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  titleBlock: { gap: v3.space[8], marginTop: v3.space[2] },
  title: { ...v3.type.title, color: v3.colors.fg },
  titleFallback: { fontFamily: DISPLAY_FONT },
  body: { ...v3.type.callout, color: v3.colors.muted },

  header: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6], minHeight: 44 },
  // Pulled into the gutter so the chevron's ink, not its target, lines up
  // with the title under it.
  back: { marginStart: -v3.space[12] },
  progress: { flex: 1, gap: v3.space[6] },
  step: { ...v3.type.label, color: v3.colors.muted },
  bars: { flexDirection: 'row', gap: v3.space[4] },
  bar: { backgroundColor: v3.colors.track, borderRadius: v3.radius.pill, flex: 1, height: 8 },
  barDone: { backgroundColor: v3.colors.fg },

  choice: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    borderWidth: 3,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 58,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[6],
  },
  choiceTall: { borderRadius: v3.radius.tile, gap: v3.space[14], minHeight: 72 },
  choiceOn: { borderColor: v3.colors.fg },
  choiceDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  choiceText: {
    alignItems: 'baseline',
    columnGap: v3.space[10],
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  choiceLabel: { ...v3.type.button, color: v3.colors.fg },
  choiceDetail: { ...v3.type.caption, color: v3.colors.muted },
  ring: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ringOn: { backgroundColor: v3.colors.fg, borderColor: v3.colors.fg },
  tag: {
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: v3.space[10],
  },
  tagText: { ...v3.type.label, color: v3.colors.fg },

  field: { gap: v3.space[6] },
  fieldLabel: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  fieldBox: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    flexDirection: 'row',
    gap: v3.space[2],
    minHeight: 58,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[20],
  },
  fieldLarge: { minHeight: 66 },
  fieldMultiline: {
    alignItems: 'flex-start',
    borderRadius: v3.radius.badge,
    minHeight: 128,
    paddingVertical: v3.space[12],
  },
  fieldFocused: { borderColor: v3.colors.fg },
  ltr: { direction: 'ltr' },
  inputLtr: { textAlign: 'left', writingDirection: 'ltr' },
  fieldError: { borderColor: v3.colors.danger },
  // `paddingVertical: 0`: Android gives a TextInput padding of its own, which
  // would push the text off the prefix beside it. `outlineWidth: 0`: on the
  // web the browser drew its own blue focus ring inside the pill, under the
  // ink edge that already says the field is being typed in.
  input: {
    ...v3.type.body,
    color: v3.colors.fg,
    flex: 1,
    fontWeight: '600',
    minHeight: 48,
    outlineWidth: 0,
    paddingVertical: 0,
  },
  // The Nunito steps carry no weight of their own; see `v3Type`.
  inputLarge: { ...v3.type.headline, fontWeight: 'normal' },
  inputMultiline: { fontWeight: '400', minHeight: 96, textAlignVertical: 'top' },
  fieldHint: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  fieldErrorText: { ...v3.type.caption, color: v3.colors.danger, paddingHorizontal: v3.space[4] },
}))

export const useWizardStyles = makeStyles(({ v3 }) => ({
  /** The wizard's column: 8 above the header, 12 between blocks, 16 under the button. */
  column: { flexGrow: 1, gap: v3.space[12], paddingBottom: v3.space[16], paddingTop: v3.space[8] },
  /**
   * For a step that does not scroll as a whole — its list scrolls inside it —
   * the column is held to the screen's height, or the list grows the page.
   */
  fixed: { flex: 1, minHeight: 0 },
  footer: { gap: v3.space[10], marginTop: 'auto', paddingTop: v3.space[8] },
  hint: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
