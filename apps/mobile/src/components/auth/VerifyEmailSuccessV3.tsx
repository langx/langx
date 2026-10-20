import { router } from 'expo-router'
import { useT } from '../../i18n'
import { Button } from '../ui/Button'
import { AuthNoticeV3 } from './AuthKitV3'

/**
 * Where an old verification link lands, in the redesign's look
 * (`V-VerifyEmailSuccess`), behind `flags.v3Home`. See
 * `app/(auth)/verify-email-success.tsx` for why it still exists.
 */
export function VerifyEmailSuccessV3({ failed }: { failed: boolean }) {
  const t = useT()
  return (
    <AuthNoticeV3
      hue={failed ? 'tangerine' : 'mint'}
      icon={failed ? 'x' : 'check'}
      title={t(failed ? 'auth.verificationFailedTitle' : 'auth.verifiedTitle')}
      body={t(failed ? 'auth.verificationFailedBody' : 'auth.verifiedBody')}
    >
      <Button
        variant="blue"
        icon="log-in"
        label={t('auth.signIn')}
        onPress={() => router.push('/(auth)/sign-in')}
      />
    </AuthNoticeV3>
  )
}
