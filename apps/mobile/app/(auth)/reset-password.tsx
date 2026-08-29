import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'
import { authErrorMessage } from '../../src/lib/errors'

/**
 * Reached via the email link's redirect: the server validates the token
 * first and only lands here — appending `?token=...` — if it's still good.
 * See api/routes/password.mjs's `requestPasswordReset`.
 */
export default function ResetPassword() {
  const styles = useStyles()
  const { token, error: linkError } = useLocalSearchParams<{ token?: string; error?: string }>()
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit() {
    if (!token) return
    setError(undefined)
    setLoading(true)
    const { error: resetError } = await authClient.resetPassword({ newPassword, token })
    setLoading(false)

    if (resetError) {
      setError(authErrorMessage(resetError) ?? 'Could not reset password')
      return
    }
    router.replace('/(auth)/sign-in')
  }

  if (!token || linkError) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <Text style={styles.title}>Link expired</Text>
        <Text style={styles.body}>
          This reset link is no longer valid. Request a new one from the sign-in screen.
        </Text>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          Request a new link
        </Link>
      </KeyboardAvoidingView>
    )
  }

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && !!newPassword

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Set a new password</Text>
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        error={error}
      />
      <Button
        label="Update password"
        onPress={onSubmit}
        loading={loading}
        disabled={!newPassword}
      />
    </KeyboardAvoidingView>
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
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, opacity: 0.8 },
  link: { color: colors.accent, fontWeight: '600', textDecorationLine: 'underline' },
}))
