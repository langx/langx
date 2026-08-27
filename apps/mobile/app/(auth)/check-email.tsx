import * as Linking from 'expo-linking'
import { Link, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { authClient } from '../../src/lib/auth-client'

export default function CheckEmail() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onResend() {
    if (!email) return
    setLoading(true)
    await authClient.sendVerificationEmail({
      email,
      callbackURL: Linking.createURL('verify-email-success'),
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>
        We sent a verification link to{'\n'}
        <Text style={styles.email}>{email}</Text>
        {'\n\n'}Tap it, then come back and sign in.
      </Text>

      <Button
        label={sent ? 'Sent — resend again' : 'Resend email'}
        onPress={onResend}
        loading={loading}
        variant="secondary"
      />

      <Link href="/(auth)/sign-in" style={styles.link}>
        Back to sign in
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, opacity: 0.8, textAlign: 'center' },
  email: { fontWeight: '600' },
  link: {
    color: '#111',
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
})
