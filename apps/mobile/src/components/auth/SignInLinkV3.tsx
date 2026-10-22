import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { FieldV3 } from '../onboarding/WizardV3'
import { Button } from '../ui/Button'
import { AuthMarkV3, AuthNoteV3, AuthNoticeV3, AuthScreenV3, AuthTitleV3 } from './AuthKitV3'

/**
 * Asking for a sign-in link in the redesign's look (`V-SignInLink`), behind
 * `flags.v3Home`. `app/(auth)/sign-in-link.tsx` keeps the request and its
 * timeout; the answer is "check your email" whether or not the address has an
 * account, as today.
 */
export function SignInLinkV3({
  email,
  onChangeEmail,
  error,
  loading,
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
        body={t('auth.signInLinkSentBody', { email })}
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
            label={t('auth.sendSignInLink')}
            onPress={onSubmit}
            loading={loading}
            disabled={!canSubmit}
          />
          {captchaChecking ? <AuthNoteV3>{t('auth.captchaChecking')}</AuthNoteV3> : null}
        </>
      }
    >
      <AuthMarkV3 hue="lilac" icon="link" />
      <AuthTitleV3 title={t('auth.signInLinkTitle')} body={t('auth.signInLinkBody')} />
      <FieldV3
        label={t('auth.emailOrHandle')}
        // The note is the field's hint until something goes wrong.
        hint={t('auth.signInLinkNote')}
        error={error}
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
      />
    </AuthScreenV3>
  )
}
