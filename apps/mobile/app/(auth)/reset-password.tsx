import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import {
  PASSWORD_MIN_LENGTH,
  passwordIssueKey,
  passwordPairReady,
} from '../../src/lib/passwordForm'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Reached via the email link's redirect: the server validates the token
 * first and only lands here — appending `?token=...` — if it's still good.
 * See api/routes/password.mjs's `requestPasswordReset`.
 */
export default function ResetPassword() {
  useScreenInteractive()
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
      <Screen scroll style={styles.form}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t('auth.linkExpiredTitle')}</Text>
          <Text style={styles.body}>{t('auth.linkExpiredBody')}</Text>
        </View>
        <Link href="/(auth)/forgot-password" style={styles.textLink}>
          {t('auth.requestNewLink')}
        </Link>
      </Screen>
    )
  }

  const issue = passwordIssueKey(newPassword, confirmation)

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && passwordPairReady(newPassword, confirmation)

  return (
    <Screen scroll style={styles.form}>
      <View style={styles.heading}>
        <Text style={styles.title}>{t('auth.setNewPassword')}</Text>
      </View>
      <FormField
        returnKeyType="next"
        placeholder={t('auth.newPassword')}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
      />
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        placeholder={t('auth.confirmPassword')}
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        error={issue ? t(issue, { min: PASSWORD_MIN_LENGTH }) : error}
      />
      <Button
        label={t('auth.updatePassword')}
        onPress={onSubmit}
        loading={loading}
        disabled={!canSubmit}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  // 22 between blocks, as the prototype stacks the auth screens.
  form: { gap: 22 },
  // No back row on this screen — the link that opened it is the only way in —
  // so the title takes the row's top padding itself.
  heading: { paddingTop: spacing.sm },
  title: { ...font.title, color: colors.text, lineHeight: 36 },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  textLink: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
}))
