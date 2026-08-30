import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordIssueKey,
  passwordPairReady,
} from '../../src/lib/passwordForm'
import { useT } from '../../src/i18n'

/**
 * Reached via the email link's redirect: the server validates the token
 * first and only lands here — appending `?token=...` — if it's still good.
 * See api/routes/password.mjs's `requestPasswordReset`.
 */
export default function ResetPassword() {
  const styles = useStyles()
  const t = useT()
  const { token, error: linkError } = useLocalSearchParams<{ token?: string; error?: string }>()
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit() {
    if (!token) return
    setError(undefined)
    setLoading(true)
    const { error: resetError } = await authClient.resetPassword({ newPassword, token })
    setLoading(false)

    if (resetError) {
      setError(t(authErrorKey(resetError) ?? 'errors.resetFailed'))
      return
    }
    router.replace('/(auth)/sign-in')
  }

  if (!token || linkError) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <Text style={styles.title}>{t('auth.linkExpiredTitle')}</Text>
        <Text style={styles.body}>{t('auth.linkExpiredBody')}</Text>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          {t('auth.requestNewLink')}
        </Link>
      </KeyboardAvoidingView>
    )
  }

  const issue = passwordIssueKey(newPassword, confirmation)

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && passwordPairReady(newPassword, confirmation)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{t('auth.setNewPassword')}</Text>
      <FormField
        returnKeyType="next"
        label={t('auth.newPassword')}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        placeholder={t('auth.passwordRule', {
          min: PASSWORD_MIN_LENGTH,
          max: PASSWORD_MAX_LENGTH,
        })}
      />
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label={t('auth.confirmPassword')}
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        error={issue ? t(issue, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }) : error}
      />
      <Button
        label={t('auth.updatePassword')}
        onPress={onSubmit}
        loading={loading}
        disabled={!canSubmit}
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
