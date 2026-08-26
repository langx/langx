import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'
import { authErrorMessage } from '../../src/lib/errors'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit() {
    setError(undefined)
    setLoading(true)
    const { error: signInError } = await authClient.signIn.email({ email, password })
    setLoading(false)

    if (signInError) {
      setError(authErrorMessage(signInError) ?? 'Sign in failed')
      return
    }
    // The root layout's Stack.Protected re-evaluates on the session change
    // this triggers, but replacing the route now avoids a stale "sign in"
    // screen flash while that catches up.
    router.replace('/')
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
