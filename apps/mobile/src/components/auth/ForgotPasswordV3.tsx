import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { FieldV3 } from '../onboarding/WizardV3'
import { Button } from '../ui/Button'
import { AuthMarkV3, AuthNoteV3, AuthNoticeV3, AuthScreenV3, AuthTitleV3 } from './AuthKitV3'

/**
 * Asking for a reset link in the redesign's look (`V-ForgotPassword`),
 * behind `flags.v3Home`. `app/(auth)/forgot-password.tsx` keeps the request,
 * the captcha and the deliberate ambiguity about whether the address exists.
 */
export function ForgotPasswordV3({
  email,
  onChangeEmail,
  error,
  loading,
  disabled,
  canSubmit,
  sent,
  onSubmit,
  captchaWidget,
  captchaChecking,
}: {
  email: string
  onChangeEmail: (value: string) => void
  error: string | undefined
  loading: boolean
  disabled: boolean
  canSubmit: boolean
  sent: boolean
  onSubmit: () => Promise<void>
  captchaWidget: ReactNode
  captchaChecking: boolean
}) {
  const t = useT()

  if (sent) {
    return (
      <AuthNoticeV3
        hue="sky"
        icon="mail"
        title={t('auth.checkEmailTitle')}
        body={t('auth.resetSentBody', { email })}
      >
        <Button
          variant="blue"
          icon="log-in"
          label={t('auth.goToSignIn')}
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </AuthNoticeV3>
    )
  }

  return (
    <AuthScreenV3
      onBack={() => goBackTo('/(auth)/sign-in')}
      footer={
        <>
          {captchaWidget}
          <Button
            icon="send"
            label={t('auth.sendResetLink')}
            onPress={onSubmit}
            loading={loading}
            disabled={disabled}
          />
          {captchaChecking ? <AuthNoteV3>{t('auth.captchaChecking')}</AuthNoteV3> : null}
          <Button
            variant="secondary"
            icon="log-in"
            label={t('auth.backToSignIn')}
            onPress={() => router.push('/(auth)/sign-in')}
          />
        </>
      }
    >
      <AuthMarkV3 hue="lime" icon="key" />
      <AuthTitleV3 title={t('auth.resetTitle')} body={t('auth.resetBody')} />
      <FieldV3
        label={t('auth.email')}
        error={error}
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
    </AuthScreenV3>
  )
}
