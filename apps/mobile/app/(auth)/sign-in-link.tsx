import { Link, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { authClient } from '../../src/lib/auth-client'
import { makeStyles } from '../../src/lib/theme'

/**
 * Ask for a sign-in link by email — the door with no password behind it.
 *
 * Built on `forgot-password.tsx`, and it keeps that screen's one deliberate
 * ambiguity: the server answers `{ status: true }` whether or not the
 * address has an account, and mails only when it does, so this screen says
 * "check your email" either way. A handle works here too; the server
 * rewrites it to the address on file.
 */
/** Long enough for a slow mail provider behind the API; short enough that a stuck request is an answer. */
const REQUEST_TIMEOUT_MS = 20_000

export default function SignInLink() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit() {
    setLoading(true)
    setError(undefined)
    // The failure branch is only for a request that did not go out at all —
    // a malformed address, a rate limit, or a request that never came back.
    // A known-or-unknown address answers the same 200, by design. The
    // timeout is the part that was missing: a request held open by a proxy
    // or an extension left this button spinning for good, with no way to
    // tell it from a slow send and nothing to press.
    const { error: sendError } = await authClient.signIn.magicLink({
      email: email.trim(),
      fetchOptions: { timeout: REQUEST_TIMEOUT_MS },
    })
    setLoading(false)
    if (sendError) {
      setError(t('errors.signInFailed'))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
        <Text style={styles.body}>{t('auth.signInLinkSentBody', { email })}</Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.backToSignIn')}
        </Link>
      </KeyboardAvoidingView>
    )
  }

  const canSubmit = !loading && !!email.trim()

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{t('auth.signInLinkTitle')}</Text>
      <Text style={styles.body}>{t('auth.signInLinkBody')}</Text>
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label={t('auth.emailOrHandle')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        error={error}
      />
      <Button
        label={t('auth.sendSignInLink')}
        onPress={onSubmit}
        loading={loading}
        disabled={!canSubmit}
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
