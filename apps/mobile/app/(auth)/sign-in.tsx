import { Link, router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { api } from '../../src/api/client'
import type { LoginResult } from '../../src/api/types'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { useAppConfig } from '../../src/hooks/useAppConfig'
import { isNativeAppleSignInAvailable, requestAppleIdentity } from '../../src/lib/appleSignIn'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import { useT } from '../../src/i18n'

export default function SignIn() {
  const styles = useStyles()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [socialError, setSocialError] = useState<string>()

  /**
   * Which of the two buttons to draw at all.
   *
   * Undefined while the config request is in flight, and after it fails —
   * both of which hide the buttons. That is the right way round: a provider
   * we cannot confirm is one we cannot complete a sign-in with, and a button
   * that opens a browser only to come back with "provider not found" is worse
   * than no button. Email and password never depend on this.
   */
  const providers = useAppConfig().data?.authProviders

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
        setError(t(authErrorKey(signInError) ?? 'errors.signInFailed'))
        return
      }

      const { error: retryError } = await authClient.signIn.email({ email, password })
      if (retryError) {
        setError(t(authErrorKey(retryError) ?? 'errors.signInFailed'))
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
    setSocialError(undefined)
    // No `router.replace` after this one: the browser redirect comes back into
    // the app on its own and the root layout reacts to the new session.
    const { error: googleError } = await authClient.signIn.social({ provider: 'google' })
    if (googleError) setSocialError(t(authErrorKey(googleError) ?? 'errors.googleSignInFailed'))
  }

  async function onApple() {
    setSocialError(undefined)
    try {
      if (!(await isNativeAppleSignInAvailable())) {
        const { error: webError } = await authClient.signIn.social({ provider: 'apple' })
        if (webError) setSocialError(t(authErrorKey(webError) ?? 'errors.appleSignInFailed'))
        return
      }

      const identity = await requestAppleIdentity()
      // The person closed the sheet. Saying anything here would be scolding
      // them for changing their mind.
      if (!identity) return

      const { error: appleError } = await authClient.signIn.social({
        provider: 'apple',
        idToken: identity,
      })
      if (appleError) {
        setSocialError(t(authErrorKey(appleError) ?? 'errors.appleSignInFailed'))
        return
      }
      // The native path never leaves the app, so nothing else will navigate.
      router.replace('/')
    } catch {
      setSocialError(t('errors.appleSignInFailed'))
    }
  }

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && !!email && !!password

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
      <Text style={styles.subtitle}>{t('auth.welcomeBackSubtitle')}</Text>

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
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        error={error}
      />

      <Link href="/(auth)/forgot-password" style={styles.link}>
        {t('auth.forgotPassword')}
      </Link>

      <Button
        label={t('auth.signIn')}
        onPress={onSubmit}
        loading={loading}
        disabled={!email || !password}
      />

      {providers?.google || providers?.apple ? (
        <>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {socialError ? <Text style={styles.socialError}>{socialError}</Text> : null}

          {providers.google ? (
            <Button label={t('auth.continueWithGoogle')} onPress={onGoogle} variant="secondary" />
          ) : null}
          {providers.apple ? (
            <Button label={t('auth.continueWithApple')} onPress={onApple} variant="secondary" />
          ) : null}
        </>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
        <Link href="/(auth)/sign-up" style={styles.link}>
          {t('auth.signUp')}
        </Link>
      </View>
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
  title: {
    ...font.title,
    color: colors.text,
    fontSize: 28,
    lineHeight: 36,
  },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { ...font.label, color: colors.textFaint, fontWeight: '400' },
  socialError: { ...font.body, color: colors.danger },
  footerText: { color: colors.textMuted, fontSize: 15 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
}))
