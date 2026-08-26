import { Link, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

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
  const { error } = useLocalSearchParams<{ error?: string }>()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{error ? 'Verification failed' : 'Email verified'}</Text>
      <Text style={styles.body}>
        {error
          ? 'That link is invalid or has expired. Sign in and request a new one.'
          : 'You can sign in now.'}
      </Text>
      <Link href="/(auth)/sign-in" style={styles.link}>
        Go to sign in
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, opacity: 0.8, textAlign: 'center' },
  link: {
    color: '#111',
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
})
