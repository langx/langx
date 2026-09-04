import * as Linking from 'expo-linking'
import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

export default function ForgotPassword() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
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
        <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
        <Text style={styles.body}>{t('auth.resetSentBody', { email })}</Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.backToSignIn')}
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
      <Text style={styles.title}>{t('auth.resetTitle')}</Text>
      <Text style={styles.body}>{t('auth.resetBody')}</Text>
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <Button
        label={t('auth.sendResetLink')}
        onPress={onSubmit}
        loading={loading}
        disabled={!email}
      />
      <Link href="/(auth)/sign-in" style={styles.link}>
        {t('auth.backToSignIn')}
      </Link>
    </KeyboardAvoidingView>
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
  title: { ...font.title, color: colors.text, fontSize: 28, lineHeight: 36 },
  body: { ...font.body, color: colors.textMuted, lineHeight: 23 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
}))
