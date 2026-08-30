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

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...font.title,
    color: colors.text,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
  },
  body: { ...font.body, color: colors.textMuted, lineHeight: 23, textAlign: 'center' },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}))
