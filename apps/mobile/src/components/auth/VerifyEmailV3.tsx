import { router } from 'expo-router'
import { useT } from '../../i18n'
import { Button } from '../ui/Button'
import { AuthNoticeV3, AuthWaitV3 } from './AuthKitV3'

/**
 * Where the mailed verification link lands, in the redesign's look
 * (`V-VerifyEmail`), behind `flags.v3Home`. `app/verify-email.tsx` keeps the
 * token, the request and the count; this is `MagicLinkV3`'s layout with the
 * verification's words.
 */
export function VerifyEmailV3({
  view,
  error,
  busy,
  onVerify,
  onOpenInApp,
}: {
  view: 'failed' | 'web' | 'native'
  error: string | null
  busy: boolean
  onVerify: () => Promise<void>
  onOpenInApp: () => void
}) {
  const t = useT()

  if (view === 'failed') {
    return (
      <AuthNoticeV3
        brand
        hue="tangerine"
        icon="x"
        title={t('auth.verificationFailedTitle')}
        body={error ?? t('auth.verificationFailedBody')}
      >
        <Button
          variant="blue"
          icon="log-in"
          label={t('auth.signIn')}
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </AuthNoticeV3>
    )
  }

  if (view === 'web') {
    return (
      <AuthNoticeV3
        brand
        hue="aqua"
        icon="mail"
        title={t('auth.verifyLinkTitle')}
        body={t('auth.verifyLinkBody')}
      >
        <Button icon="check" label={t('auth.verifyLinkButton')} onPress={onVerify} loading={busy} />
        <Button
          variant="secondary"
          icon="smartphone"
          label={t('auth.openInApp')}
          onPress={onOpenInApp}
        />
      </AuthNoticeV3>
    )
  }

  return <AuthWaitV3 label={t('auth.verifying')} />
}
