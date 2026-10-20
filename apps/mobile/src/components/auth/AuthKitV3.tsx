import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { useState, type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type TextInputProps,
} from 'react-native'
import logo from '../../../assets/brand/logo-rounded.png'
import { useLocale, useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { FieldV3, useBlackFont } from '../onboarding/WizardV3'
import { ICON_BUTTON_TARGET, IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'
import { Screen } from '../ui/Screen'

/*
 * The pieces the sign-in screens share in the redesign's look (`V-SignIn`,
 * `V-SignUp`, `V-ForgotPassword`, …), behind `flags.v3Home`.
 *
 * These screens are on the launch path — a stranger reaches sign-up straight
 * from the welcome screen — so, like `WizardV3`, nothing here imports
 * Reanimated, directly or through a component. Presses are `PressableScale`,
 * which is React Native's `Animated`.
 *
 * Every piece only draws. The requests, the captcha and the rules stay in the
 * routes, which hand them to the views; see `authScreensV3.test.ts`.
 */

export type AuthGlyph = keyof typeof Feather.glyphMap

/**
 * The column every auth screen sits in: an optional back row, the page, and a
 * foot pushed to the bottom when there is room. The keyboard lifts the foot
 * rather than covering it, as `SettingsFormScreenV3` does — `padding` on iOS,
 * the window's own resize on Android — and the scroll is what lets a small
 * phone at a large text size still reach the button.
 */
export function AuthScreenV3({
  onBack,
  trailing,
  children,
  footer,
}: {
  onBack?: (() => void) | undefined
  /** At the far end of the back row: sign-up's "Just looking?". */
  trailing?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  return (
    <Screen fluid ground={v3.colors.bg}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.column, !onBack && !trailing && styles.columnBare]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {onBack || trailing ? (
            <View style={styles.header}>
              {onBack ? (
                <IconButton
                  icon={isRtl ? 'chevron-right' : 'chevron-left'}
                  accessibilityLabel={t('common.backPlain')}
                  onPress={onBack}
                  style={styles.back}
                />
              ) : (
                <View />
              )}
              {trailing}
            </View>
          ) : null}
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

/** The page's title in Nunito Black, ExtraBold until it lands, and the line under it. */
export function AuthTitleV3({ title, body }: { title: string; body?: ReactNode }) {
  const styles = useStyles()
  const black = useBlackFont()
  return (
    <View style={styles.titleBlock}>
      <Text accessibilityRole="header" style={[styles.title, !black && styles.fallback]}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  )
}

/** The 64pt hue square over a form's title — the link, the key, the lock. */
export function AuthMarkV3({ hue, icon }: { hue: PartnerHue; icon: AuthGlyph }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View
      style={[styles.mark, { backgroundColor: v3.hues[hue] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Feather name={icon} size={30} color={v3.colors.ink} />
    </View>
  )
}

/**
 * The big hue block a screen with nothing to type opens with: check your
 * email, verified, the link landing. A picture of what happened, so it is
 * hidden from a screen reader — the title under it says the same in words.
 */
export function AuthHeroV3({ hue, icon }: { hue: PartnerHue; icon: AuthGlyph }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View
      style={[styles.hero, { backgroundColor: v3.hues[hue] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.heroDisc}>
        <Feather name={icon} size={56} color={v3.hues[hue]} />
      </View>
    </View>
  )
}

/**
 * A screen that says what happened rather than asks for anything — check
 * your email, verified, the link has gone: the hero, the words, and the
 * buttons at the foot. `brand` puts the wordmark over it, for the pages a
 * mailed link opens, where the app has not introduced itself yet.
 */
export function AuthNoticeV3({
  hue,
  icon,
  title,
  body,
  brand = false,
  children,
}: {
  hue: PartnerHue
  icon: AuthGlyph
  title: string
  body: ReactNode
  brand?: boolean
  /** The buttons. */
  children: ReactNode
}) {
  return (
    <AuthScreenV3 footer={children}>
      {brand ? <AuthBrandV3 /> : null}
      <AuthHeroV3 hue={hue} icon={icon} />
      <AuthTitleV3 title={title} body={body} />
    </AuthScreenV3>
  )
}

/** The rounded icon and the wordmark, as `WelcomeV3` opens with them. */
export function AuthBrandV3() {
  const styles = useStyles()
  const black = useBlackFont()
  return (
    <View style={styles.brand}>
      <Image
        source={logo}
        style={styles.logo}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      {/* The wordmark is the brand, not copy: it reads "LangX" in all eight locales. */}
      <Text style={[styles.wordmark, !black && styles.fallback]}>LangX</Text>
    </View>
  )
}

/** "or" between two lines. */
export function AuthDividerV3() {
  const styles = useStyles()
  const t = useT()
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{t('auth.or')}</Text>
      <View style={styles.dividerLine} />
    </View>
  )
}

/**
 * A grey pill with a glyph, for the quiet ways off a form — "Forgot
 * password?", "Just looking?". A pill's height of target rather than a text
 * link, which at 15pt was a 20pt-tall thing to hit.
 */
export function AuthChipV3({
  icon,
  label,
  onPress,
}: {
  icon: AuthGlyph
  label: string
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <PressableScale accessibilityRole="link" onPress={onPress} style={styles.chip}>
      <Feather name={icon} size={v3.icon.sm} color={v3.colors.fg} />
      <Text style={styles.chipText}>{label}</Text>
    </PressableScale>
  )
}

/** "Don't have an account?" and the outlined pill that answers it. */
export function AuthFooterV3({
  text,
  label,
  onPress,
}: {
  text: string
  label: string
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <View style={styles.footerRow}>
      <Text style={styles.footerText}>{text}</Text>
      <PressableScale accessibilityRole="link" onPress={onPress} style={styles.footerPill}>
        <Text style={styles.footerPillText}>{label}</Text>
      </PressableScale>
    </View>
  )
}

/** The captcha's "checking…" line, under the button it is holding. */
export function AuthNoteV3({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <Text style={styles.note}>{children}</Text>
}

/**
 * The redesign's password field with the board's "Show" pill inside it — the
 * same words for a screen reader as `FormField`'s reveal, and the same local
 * state: a revealed password hides itself again next time.
 */
export function AuthPasswordFieldV3({
  label,
  hint,
  error,
  ...inputProps
}: Omit<TextInputProps, 'secureTextEntry'> & {
  label: string
  hint?: string | undefined
  error?: string | undefined
}) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()
  const [revealed, setRevealed] = useState(false)
  return (
    <FieldV3
      label={label}
      hint={hint}
      error={error}
      autoCapitalize="none"
      {...inputProps}
      secureTextEntry={!revealed}
      suffix={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
          accessibilityState={{ selected: revealed }}
          onPress={() => setRevealed((shown) => !shown)}
          style={styles.reveal}
        >
          <Feather name={revealed ? 'eye-off' : 'eye'} size={v3.icon.sm} color={v3.colors.fg} />
          <Text style={styles.revealText}>{t(revealed ? 'common.hide' : 'common.show')}</Text>
        </PressableScale>
      }
    />
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  fill: { flex: 1 },
  column: { flexGrow: 1, gap: v3.space[14], paddingBottom: v3.space[16], paddingTop: v3.space[8] },
  // No back row: the top padding a header would have taken.
  columnBare: { paddingTop: v3.space[32] },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: ICON_BUTTON_TARGET,
  },
  // Pulled into the gutter so the chevron's ink, not its target, lines up
  // with the title under it — as the wizard's header does.
  back: { marginStart: -v3.space[12] },
  footer: { gap: v3.space[10], marginTop: 'auto', paddingTop: v3.space[16] },

  titleBlock: { gap: v3.space[6] },
  title: { ...v3.type.title, color: v3.colors.fg },
  fallback: { fontFamily: DISPLAY_FONT },
  body: { ...v3.type.body, color: v3.colors.muted },

  mark: {
    alignItems: 'center',
    borderRadius: v3.radius.tile,
    height: 64,
    justifyContent: 'center',
    marginTop: v3.space[6],
    width: 64,
  },
  hero: {
    alignItems: 'center',
    borderRadius: v3.radius.hero,
    height: 240,
    justifyContent: 'center',
    marginBottom: v3.space[10],
  },
  heroDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 120,
    justifyContent: 'center',
    width: 120,
  },

  brand: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  logo: { borderRadius: v3.radius.icon, height: 44, width: 44 },
  wordmark: { ...v3.type.headline, color: v3.colors.fg },

  divider: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  dividerLine: { backgroundColor: v3.colors.line, flex: 1, height: 2 },
  dividerText: { ...v3.type.caption, color: v3.colors.muted },

  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[16],
  },
  chipText: { ...v3.type.buttonSmall, color: v3.colors.fg },

  footerRow: {
    alignItems: 'center',
    columnGap: v3.space[10],
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: v3.space[6],
  },
  footerText: { ...v3.type.callout, color: v3.colors.muted },
  footerPill: {
    alignItems: 'center',
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[16],
  },
  footerPillText: { ...v3.type.buttonSmall, color: v3.colors.fg },

  note: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },

  reveal: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[12],
  },
  revealText: { ...v3.type.buttonSmall, color: v3.colors.fg },
}))
