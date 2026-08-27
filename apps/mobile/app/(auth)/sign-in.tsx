import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { api } from '../../src/api/client'
import type { LoginResult } from '../../src/api/types'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'
import { authErrorMessage } from '../../src/lib/errors'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  /**
   * Normal sign-in, then the v1 bridge, then the error.
   *
   * A v1 user's password hash cannot be migrated — it is a one-way hash from a
   * different system — so their credentials only exist inside the old
   * Appwrite. `POST /auth/login` checks them there and, if they are good,
   * creates a v2 account with the same password and restores the profile.
   * Without this fallback a returning user types the password they have always
   * used and is simply told it is wrong.
   *
   * **The second `signIn.email` is deliberate and load-bearing.**
   * `@better-auth/expo` writes the session cookie by wrapping its own `fetch`,
   * so a `set-cookie` that comes back through our `api` client is written
   * nowhere on native and the user stays signed out while appearing to have
   * succeeded. Rather than carrying the cookie by hand, we let Better Auth
   * remain the only thing that ever writes a session: by this point the v2
   * account exists with this exact password, so the ordinary path works. That
   * makes `/auth/login`'s own first step redundant here, which is harmless —
   * we only ever reach it after a normal sign-in has already failed.
   */
  async function onSubmit() {
    setError(undefined)
    setLoading(true)
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password })
      if (!signInError) {
        // The root layout's Stack.Protected re-evaluates on the session change
        // this triggers, but replacing the route now avoids a stale "sign in"
        // screen flash while that catches up.
        router.replace('/')
        return
      }

      const bridged = await tryLegacyLogin()
      if (!bridged) {
        setError(authErrorMessage(signInError) ?? 'Sign in failed')
        return
      }

      const { error: retryError } = await authClient.signIn.email({ email, password })
      if (retryError) {
        setError(authErrorMessage(retryError) ?? 'Sign in failed')
        return
      }
      router.replace('/')
    } finally {
      setLoading(false)
    }
  }

  /**
   * `true` only when the bridge actually adopted this account. Any failure —
   * no v1 record, wrong password, Appwrite unreachable — returns `false` so
   * the caller shows the original sign-in error rather than a second, stranger
   * one about a system the user has never heard of.
   */
  async function tryLegacyLogin(): Promise<boolean> {
    try {
      const result = await api.post<LoginResult>('/auth/login', { email, password })
      return result.migratedFromV1
    } catch {
      return false
    }
  }

  async function onGoogle() {
    const { error: socialError } = await authClient.signIn.social({ provider: 'google' })
    if (socialError) Alert.alert('Google sign-in failed', authErrorMessage(socialError))
  }

  async function onApple() {
    const { error: socialError } = await authClient.signIn.social({ provider: 'apple' })
    if (socialError) Alert.alert('Apple sign-in failed', authErrorMessage(socialError))
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Welcome back</Text>

      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        error={error}
      />

      <Link href="/(auth)/forgot-password" style={styles.link}>
        Forgot password?
      </Link>

      <Button label="Sign in" onPress={onSubmit} loading={loading} disabled={!email || !password} />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Button label="Continue with Google" onPress={onGoogle} variant="secondary" />
      <Button label="Continue with Apple" onPress={onApple} variant="secondary" />

      <View style={styles.footer}>
        <Text>Don&apos;t have an account? </Text>
        <Link href="/(auth)/sign-up" style={styles.link}>
          Sign up
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  link: { color: '#111', fontWeight: '600', textDecorationLine: 'underline' },
  divider: { alignItems: 'center', flexDirection: 'row', gap: 12, marginVertical: 4 },
  dividerLine: { backgroundColor: '#ddd', flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { opacity: 0.5 },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
})
