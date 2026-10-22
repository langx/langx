import { router } from 'expo-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Platform } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { shakeSteps } from '../../lib/errorShake'
import { notification } from '../../lib/haptics'
import { goBackTo } from '../../lib/navigation'
import { makeStyles } from '../../lib/theme'
import { FieldV3 } from '../onboarding/WizardV3'
import { SocialAuthButtons } from '../SocialAuthButtons'
import { Button } from '../ui/Button'
import {
  AuthChipV3,
  AuthDividerV3,
  AuthFooterV3,
  AuthNoteV3,
  AuthPasswordFieldV3,
  AuthScreenV3,
  AuthTitleV3,
} from './AuthKitV3'

/**
 * Sign in in the redesign's look (`V-SignIn`), behind `flags.v3Home`.
 * `app/(auth)/sign-in.tsx` keeps the request, the captcha and the rule for
 * when it may be sent, and hands them here; see that file for why it does
 * nothing after a successful sign-in.
 *
 * The board's order: the form and the yellow, then "or" and the two doors
 * without a password — the link, then the providers in `SocialAuthButtons`'
 * own order.
 */
export function SignInV3({
  email,
  onChangeEmail,
  password,
  onChangePassword,
  error,
  loading,
  disabled,
  canSubmit,
  onSubmit,
  captchaWidget,
  captchaChecking,
}: {
  email: string
  onChangeEmail: (value: string) => void
  password: string
  onChangePassword: (value: string) => void
  error: string | undefined
  loading: boolean
  /** The button's own refusal — the same expression the current look passes. */
  disabled: boolean
  /** Whether Enter may submit: never what the button refuses, never twice. */
  canSubmit: boolean
  onSubmit: () => Promise<void>
  captchaWidget: ReactNode
  /** The form is filled and the bot check is what is holding it. */
  captchaChecking: boolean
}) {
  const styles = useStyles()
  const t = useT()

  /*
   * A refusal shakes the fields and buzzes once, so it is felt as well as
   * read. Each attempt clears the error before it is sent (`sign-in.tsx`),
   * so the same refusal twice is two arrivals, and two shakes. Under reduce
   * motion the buzz alone: it says the same without anything moving.
   */
  const reduceMotion = useReduceMotion()
  const shake = useRef(new Animated.Value(0)).current
  const shownError = useRef(error)
  useEffect(() => {
    const arrived = error !== undefined && shownError.current === undefined
    shownError.current = error
    if (!arrived) return
    void notification('error')
    if (reduceMotion) return
    Animated.sequence(
      shakeSteps().map((step) =>
        Animated.timing(shake, { toValue: step.to, duration: step.ms, useNativeDriver: true }),
      ),
    ).start()
  }, [error, reduceMotion, shake])

  return (
    <AuthScreenV3
      onBack={() => goBackTo('/(auth)/welcome')}
      footer={
        <AuthFooterV3
          text={t('auth.noAccount')}
          label={t('auth.signUp')}
          onPress={() => router.push('/(auth)/sign-up')}
        />
      }
    >
      <AuthTitleV3 title={t('auth.welcomeBack')} body={t('auth.welcomeBackSubtitle')} />

      <Animated.View style={[styles.fields, { transform: [{ translateX: shake }] }]}>
        <FieldV3
          label={t('auth.emailOrHandle')}
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && void onSubmit()}
          value={email}
          onChangeText={onChangeEmail}
          autoCapitalize="none"
          // Today's keyboard and autofill hints; `sign-in.tsx` says why.
          keyboardType="email-address"
          textContentType="username"
          autoComplete="username"
        />
        <AuthPasswordFieldV3
          label={t('auth.password')}
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && void onSubmit()}
          value={password}
          onChangeText={onChangePassword}
          textContentType="password"
          autoComplete="password"
          error={error}
        />
        <AuthChipV3
          icon="key"
          label={t('auth.forgotPassword')}
          onPress={() => router.push('/(auth)/forgot-password')}
        />
      </Animated.View>

      {captchaWidget}
      <Button
        label={t('auth.signIn')}
        icon="log-in"
        onPress={onSubmit}
        loading={loading}
        disabled={disabled}
      />
      {captchaChecking ? <AuthNoteV3>{t('auth.captchaChecking')}</AuthNoteV3> : null}

      <AuthDividerV3 />
      {/* Carries what was typed, so it is not typed twice. */}
      <Button
        variant="secondary"
        icon="mail"
        label={t('auth.signInWithLink')}
        onPress={() => router.push({ pathname: '/(auth)/sign-in-link', params: { email } })}
      />
      <SocialAuthButtons look="v3" divider="none" />

      {/* Web only, as today: on a phone you are holding the other device. */}
      {Platform.OS === 'web' ? (
        <Button
          variant="secondary"
          size="medium"
          icon="maximize"
          label={t('auth.signInWithCode')}
          onPress={() => router.push('/(auth)/qr')}
        />
      ) : null}
    </AuthScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  fields: { gap: v3.space[14], marginTop: v3.space[8] },
}))
