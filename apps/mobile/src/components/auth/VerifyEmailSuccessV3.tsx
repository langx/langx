import { router } from 'expo-router'
import { useEffect } from 'react'
import { useT } from '../../i18n'
import { claimCelebration } from '../../lib/celebration'
import { notification } from '../../lib/haptics'
import { Button } from '../ui/Button'
import { AuthNoticeV3 } from './AuthKitV3'

/**
 * Where an old verification link lands, in the redesign's look
 * (`V-VerifyEmailSuccess`), behind `flags.v3Home`. See
 * `app/(auth)/verify-email-success.tsx` for why it still exists.
 */
export function VerifyEmailSuccessV3({ failed }: { failed: boolean }) {
  const t = useT()
  // The address is confirmed: one success buzz, once per run of the app.
  useEffect(() => {
    if (!failed && claimCelebration('emailVerified')) void notification('success')
  }, [failed])
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
