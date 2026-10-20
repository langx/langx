import Feather from '@expo/vector-icons/Feather'
import { useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useT } from '../../../i18n'
import { makeStyles, useTheme, type PartnerHue } from '../../../lib/theme'
import { FieldV3 } from '../../onboarding/WizardV3'
import { ICON_BUTTON_TARGET } from '../../ui/IconButton'
import { Screen } from '../../ui/Screen'
import type { Glyph } from './SettingsKitV3'
import { SettingsHeaderV3 } from './SettingsKitV3'

/**
 * The standalone Settings pages under `flags.v3Home` (`V-SetUsername`,
 * `V-SetPassword`, `V-SetDeleteAccount`, …): the same back-and-title header
 * as the category pages, the page's blocks, and the committing button at the
 * foot.
 *
 * The keyboard lifts the foot rather than covering it, as today's forms do:
 * `KeyboardAvoidingView` shrinks the frame on iOS (Android resizes the window
 * itself), and the scroll inside it is what lets a long page or a large text
 * size still reach the button once the frame is short.
 */
export function SettingsFormScreenV3({
  title,
  onBack,
  close = false,
  backLabel,
  children,
  footer,
}: {
  title: string
  onBack: () => void
  /** The header's cross in place of its chevron — see `SettingsHeaderV3`. */
  close?: boolean
  backLabel?: string | undefined
  children?: ReactNode
  /** The button, or buttons, at the foot. */
  footer?: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <Screen fluid ground={v3.colors.bg}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SettingsHeaderV3 title={title} onBack={onBack} close={close} backLabel={backLabel} />
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
          {footer ? (
            <>
              <View style={styles.spacer} />
              <View style={styles.footer}>{footer}</View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

/** A line of explanation on the page's ground, in the muted face. */
export function SettingsLeadV3({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <Text style={styles.lead}>{children}</Text>
}

/**
 * A grey block with a glyph on a hue square and a sentence beside it: the
 * thing a page wants read before the button (the username's cooldown).
 */
export function SettingsNoteV3({
  icon,
  hue,
  tone = 'surface',
  children,
}: {
  icon: Glyph
  hue?: PartnerHue | undefined
  /** `danger`: the red-tinted block that says nothing has happened yet. */
  tone?: 'surface' | 'danger'
  children: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={[styles.note, tone === 'danger' && styles.noteDanger]}>
      {tone === 'danger' ? (
        <Feather name={icon} size={v3.icon.lg} color={v3.colors.danger} />
      ) : (
        <View style={[styles.noteSquare, { backgroundColor: hue ? v3.hues[hue] : v3.colors.line }]}>
          <Feather name={icon} size={v3.icon.sm} color={hue ? v3.colors.ink : v3.colors.fg} />
        </View>
      )}
      <Text style={[styles.noteText, tone === 'danger' && styles.noteTextStrong]}>{children}</Text>
    </View>
  )
}

/**
 * The big hue block a permission guide opens with: where things stand, in a
 * headline and a paragraph. Ink on the hue in both schemes, as everything on
 * a hue is.
 */
export function SettingsStateV3({
  hue,
  icon,
  title,
  body,
}: {
  hue: PartnerHue
  icon: Glyph
  title: string
  body: string
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={[styles.state, { backgroundColor: v3.hues[hue] }]}>
      <View style={styles.stateHead}>
        <View style={styles.stateMark}>
          <Feather name={icon} size={v3.icon.xl} color={v3.hues[hue]} />
        </View>
        <Text accessibilityRole="header" style={styles.stateTitle}>
          {title}
        </Text>
      </View>
      <Text style={styles.stateBody}>{body}</Text>
    </View>
  )
}

/**
 * Numbered steps in one grey block. The number is drawn, not written into
 * each string, for the reason `settings/location.tsx` gives: a number that is
 * markup cannot be translated away by mistake.
 */
export function SettingsStepsV3({ steps }: { steps: readonly string[] }) {
  const styles = useStyles()
  return (
    <View style={styles.steps}>
      {steps.map((text, index) => (
        <View key={text} style={[styles.step, index > 0 && styles.stepDivided]}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
          <Text style={styles.stepText}>{text}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * A password field in the redesign's look, with the reveal `FormField` has —
 * the same words for a screen reader, the same local state: a revealed
 * password hides itself again the next time the screen is opened.
 */
export function PasswordFieldV3({
  label,
  hint,
  value,
  onChangeText,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string
  hint?: string | undefined
  value: string
  onChangeText: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  textContentType: 'password' | 'newPassword'
  returnKeyType: 'next' | 'go'
  onSubmitEditing?: (() => void) | undefined
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [revealed, setRevealed] = useState(false)
  return (
    <FieldV3
      label={label}
      hint={hint}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!revealed}
      autoCapitalize="none"
      autoComplete={autoComplete}
      textContentType={textContentType}
      returnKeyType={returnKeyType}
      {...(onSubmitEditing ? { onSubmitEditing } : {})}
      suffix={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
          accessibilityState={{ selected: revealed }}
          onPress={() => setRevealed((shown) => !shown)}
          style={({ pressed }) => [styles.reveal, pressed && styles.pressed]}
        >
          <Feather name={revealed ? 'eye-off' : 'eye'} size={v3.icon.md} color={v3.colors.muted} />
        </Pressable>
      }
    />
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  fill: { flex: 1 },
  form: { flexGrow: 1, gap: v3.space[14], paddingBottom: v3.space[16], paddingTop: v3.space[8] },
  spacer: { flex: 1 },
  footer: { gap: v3.space[10], paddingTop: v3.space[8] },
  lead: { ...v3.type.body, color: v3.colors.muted },
  note: {
    alignItems: 'flex-start',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  // No red tint in `theme.v3`: the grey block, with the glyph in the red.
  noteDanger: { alignItems: 'center' },
  noteSquare: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  noteText: { ...v3.type.callout, color: v3.colors.fg, flex: 1 },
  noteTextStrong: { fontWeight: '600' },
  state: {
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[20],
  },
  stateHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  stateMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  stateTitle: { ...v3.type.headline, color: v3.colors.ink, flex: 1 },
  stateBody: { ...v3.type.callout, color: v3.colors.ink },
  steps: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[14],
    minHeight: 64,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[10],
  },
  stepDivided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  stepNumber: {
    ...v3.type.button,
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    color: v3.colors.pillText,
    height: 36,
    lineHeight: 36,
    overflow: 'hidden',
    textAlign: 'center',
    width: 36,
  },
  stepText: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  reveal: {
    alignItems: 'center',
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  pressed: { opacity: 0.6 },
}))
