import { router } from 'expo-router'
import { Text } from 'react-native'
import { useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'
import { Button } from '../ui/Button'
import { AuthNoticeV3 } from './AuthKitV3'

/** Stands in for the address while the body is translated, as `check-email.tsx` does. */
const EMAIL_MARK = String.fromCharCode(0)

/**
 * "Check your email" after sign-up, in the redesign's look (`V-CheckEmail`),
 * behind `flags.v3Home`. `app/(auth)/check-email.tsx` keeps the resend.
 *
 * Going to sign-in is blue, not yellow: it commits to nothing, and the
 * committing act — opening the mail — happens somewhere else.
 */
export function CheckEmailV3({
  email,
  sent,
  loading,
  onResend,
}: {
  email: string | undefined
  sent: boolean
  loading: boolean
  onResend: () => Promise<void>
}) {
  const styles = useStyles()
  const t = useT()
  const [before = '', after = ''] = t('auth.checkEmailBody', { email: EMAIL_MARK }).split(
    EMAIL_MARK,
  )
  return (
    <AuthNoticeV3
      hue="sky"
      icon="mail"
      title={t('auth.checkEmailTitle')}
      body={
        <>
          {before}
          <Text style={styles.strong}>{email ?? ''}</Text>
          {after}
        </>
      }
    >
      <Button
        variant="blue"
        icon="log-in"
        label={t('auth.goToSignIn')}
        onPress={() => router.push('/(auth)/sign-in')}
      />
      <Button
        variant="secondary"
        icon="refresh-cw"
        label={sent ? t('auth.resent') : t('auth.resendEmail')}
        loading={loading}
        onPress={onResend}
      />
    </AuthNoticeV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  strong: { color: v3.colors.fg, fontWeight: '700' },
}))
