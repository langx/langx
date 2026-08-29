import { Link, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/**
 * Landing screen after tapping the emailed verification link.
 *
 * Verification itself already happened server-side (the link points at the
 * API's own `/verify-email`, not here) before redirecting to this deep link
 * — with `autoSignInAfterVerification: true`, that request also set a
 * session cookie, but in the *system browser* that opened the link, not in
 * this app's SecureStore. So the person still signs in here, same as any
 * password flow; this screen exists to confirm the link worked and point
 * them at sign-in rather than leaving them on a bare browser tab.
 */
export default function VerifyEmailSuccess() {
  const styles = useStyles()
  const t = useT()
  const { error } = useLocalSearchParams<{ error?: string }>()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t(error ? 'auth.verificationFailedTitle' : 'auth.verifiedTitle')}
      </Text>
      <Text style={styles.body}>
        {t(error ? 'auth.verificationFailedBody' : 'auth.verifiedBody')}
      </Text>
      <Link href="/(auth)/sign-in" style={styles.link}>
        {t('auth.goToSignIn')}
      </Link>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
    textAlign: 'center',
  },
  link: {
    color: colors.accent,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
}))
