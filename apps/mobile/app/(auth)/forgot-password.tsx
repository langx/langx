import * as Linking from 'expo-linking'
import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit() {
    setLoading(true)
    // Better Auth returns { status: true } whether or not the email exists,
    // by design (see api/routes/password.mjs) — that ambiguity is
    // intentional, so the UI can't tell an attacker which emails are real.
    await authClient.requestPasswordReset({
      email,
      redirectTo: Linking.createURL('reset-password'),
    })
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          If an account exists for {email}, a reset link is on its way.
        </Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          Back to sign in
        </Link>
      </KeyboardAvoidingView>
    )
  }

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && !!email

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Reset your password</Text>
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <Button label="Send reset link" onPress={onSubmit} loading={loading} disabled={!email} />
      <Link href="/(auth)/sign-in" style={styles.link}>
        Back to sign in
      </Link>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, opacity: 0.8 },
  link: { color: '#111', fontWeight: '600', textDecorationLine: 'underline' },
})
