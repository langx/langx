import Feather from '@expo/vector-icons/Feather'
import { MINIMUM_AGE } from '@langx/shared'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { openExternal } from '../../lib/openExternal'
import { PASSWORD_MIN_LENGTH } from '../../lib/passwordForm'
import { makeStyles, useTheme } from '../../lib/theme'
import { FieldV3 } from '../onboarding/WizardV3'
import { SocialAuthButtons } from '../SocialAuthButtons'
import { Button } from '../ui/Button'
import {
  AuthChipV3,
  AuthFooterV3,
  AuthNoteV3,
  AuthPasswordFieldV3,
  AuthScreenV3,
  AuthTitleV3,
} from './AuthKitV3'

/**
 * Sign-up in the redesign's look (`V-SignUp`), behind `flags.v3Home`.
 * `app/(auth)/sign-up.tsx` keeps the request, the guest sign-out, the invite,
 * the captcha and the consent state, and hands them here.
 *
 * The providers first, as today, then the rule and the email form. The age
 * line, the consent sentence and its two links are today's words; the box is
 * whatever `accepted` says, and nothing here sets it but a tap — the board
 * draws it ticked to show the ticked state, not as a default.
 */
export function SignUpV3({
  email,
  onChangeEmail,
  password,
  onChangePassword,
  passwordError,
  accepted,
  onChangeAccepted,
  termsUrl,
  privacyUrl,
  loading,
  canSubmit,
  onSubmit,
  captchaWidget,
  captchaChecking,
  onSocialStart,
  onBrowse,
}: {
  email: string
  onChangeEmail: (value: string) => void
  password: string
  onChangePassword: (value: string) => void
  /** The length rule once it is broken, or the server's refusal. */
  passwordError: string | undefined
  accepted: boolean
  onChangeAccepted: (next: boolean) => void
  termsUrl: string
  privacyUrl: string
  loading: boolean
  canSubmit: boolean
  onSubmit: () => Promise<void>
  captchaWidget: ReactNode
  captchaChecking: boolean
  onSocialStart: (method: 'google' | 'apple' | 'facebook' | 'discord') => void
  onBrowse: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()
  return (
    <AuthScreenV3
      onBack={() => goBackTo('/(auth)/welcome')}
      trailing={<AuthChipV3 icon="compass" label={t('auth.justLooking')} onPress={onBrowse} />}
      footer={
        <AuthFooterV3
          text={t('auth.haveAccount')}
          label={t('auth.signIn')}
          onPress={() => router.push('/(auth)/sign-in')}
        />
      }
    >
      <AuthTitleV3
        title={t('auth.createAccount')}
        body={t('auth.minimumAge', { count: MINIMUM_AGE })}
      />

      <View style={styles.providers}>
        <SocialAuthButtons look="v3" divider="below" onStart={onSocialStart} />
      </View>

      <View style={styles.fields}>
        <FieldV3
          label={t('auth.email')}
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && void onSubmit()}
          value={email}
          onChangeText={onChangeEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <AuthPasswordFieldV3
          label={t('auth.password')}
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && void onSubmit()}
          value={password}
          onChangeText={onChangePassword}
          textContentType="newPassword"
          autoComplete="password-new"
          // The rule until it is broken — then the error says so instead.
          hint={t('auth.passwordRule', { count: PASSWORD_MIN_LENGTH })}
          error={passwordError}
        />

        {/*
          Unticked by default and required, as today: a pre-ticked box is not
          consent. The whole row toggles, so the box is not the only target.
        */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          accessibilityLabel={t('auth.acceptTermsLabel')}
          onPress={() => onChangeAccepted(!accepted)}
          style={({ pressed }) => [styles.consent, pressed && styles.pressed]}
        >
          <View style={styles.boxTarget}>
            <View style={[styles.box, accepted && styles.boxOn]}>
              {accepted ? (
                <Feather name="check" size={v3.icon.xs} color={v3.colors.pillText} />
              ) : null}
            </View>
          </View>
          <Text style={styles.consentText}>
            {t('auth.acceptTerms')}{' '}
            <Text style={styles.link} onPress={() => void openExternal(termsUrl)}>
              {t('legal.terms')}
            </Text>
            {t('auth.acceptTermsAnd')}
            <Text style={styles.link} onPress={() => void openExternal(privacyUrl)}>
              {t('legal.privacy')}
            </Text>
            .
          </Text>
        </Pressable>
      </View>

      {captchaWidget}
      <Button
        label={t('auth.signUp')}
        icon="user-plus"
        onPress={onSubmit}
        loading={loading}
        disabled={!canSubmit}
      />
      {captchaChecking ? <AuthNoteV3>{t('auth.captchaChecking')}</AuthNoteV3> : null}
    </AuthScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  providers: { gap: v3.space[8], marginTop: v3.space[6] },
  fields: { gap: v3.space[12] },
  consent: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[4] },
  pressed: { opacity: 0.7 },
  // The platform's minimum target around a 28pt box, pulled into the gutter
  // so the box lines up with the fields' edge.
  boxTarget: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginStart: -v3.space[8],
    marginTop: -v3.space[8],
    width: 44,
  },
  box: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: 9,
    borderWidth: 2.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  boxOn: { backgroundColor: v3.colors.fg, borderColor: v3.colors.fg },
  consentText: { ...v3.type.callout, color: v3.colors.muted, flex: 1, lineHeight: 22 },
  link: { color: v3.colors.echoText, fontWeight: '700' },
}))
