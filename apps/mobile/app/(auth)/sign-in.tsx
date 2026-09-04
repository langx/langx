import * as Linking from 'expo-linking'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { useAppConfig } from '../../src/hooks/useAppConfig'
import { useGuestBrowse } from '../../src/hooks/useGuestBrowse'
import { isNativeAppleSignInAvailable, requestAppleIdentity } from '../../src/lib/appleSignIn'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey, oauthReturnErrorKey } from '../../src/lib/errors'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

export default function SignIn() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { start: browse } = useGuestBrowse()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  /**
   * A redirect sign-in that failed comes back *here*, as `?error=<code>` on
   * the URL — see `socialRedirects` below — because by then the call that
   * started it is long gone and there is nothing left to hand a value back to.
   *
   * Read once, as the initial state: on the web the return is a fresh page
   * load, and on a device the browser sheet closes without the URL ever
   * reaching the router, so there is no later render for it to fight with.
   */
  const { error: returnedError } = useLocalSearchParams<{ error?: string }>()
  const [socialError, setSocialError] = useState<string | undefined>(() => {
    const key = oauthReturnErrorKey(returnedError)
    return key ? t(key) : undefined
  })

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
   * Only Better Auth's own sign-in. A v1 password cannot be checked here — the
   * hash is one-way and from another system — and the bridge that once asked
   * v1 to check it is gone: every v1 account now has a v2 `user` row, so a
   * returning person resets the password or continues with Google or Apple
   * (`docs/decisions.md` → _Every v1 account has a v2 `user` row_). The error
   * copy says exactly that.
   */
  async function onSubmit() {
    setError(undefined)
    setLoading(true)
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password })
      if (signInError) {
        setError(t(authErrorKey(signInError) ?? 'errors.signInFailed'))
        return
      }
      // The root layout's Stack.Protected re-evaluates on the session change
      // this triggers, but replacing the route now avoids a stale "sign in"
      // screen flash while that catches up.
      router.replace('/')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Where the provider sends the browser back to, on success and on failure.
   *
   * Both are optional to Better Auth and neither may be left out. An absent
   * `callbackURL` defaults to the *API's* own base URL, which is the wrong
   * address on both platforms that redirect: on the web it strands the reader
   * on the API's host holding a session the app never sees, and on a device
   * it is an `https` URL, so the auth session `@better-auth/expo` opened never
   * recognises the redirect as its own — the sheet sits on a page nobody asked
   * for and the session cookie it was waiting for is never handed over.
   *
   * `Linking.createURL` answers both platforms in one call: the app's own
   * origin on the web, the app's scheme (`langx:///…`) on a device. The API
   * trusts each of those already — `trustedOrigins` in apps/api/src/auth.ts,
   * which is what makes an origin usable here at all.
   *
   * Called per press rather than computed once at module scope: the web build
   * is prerendered in Node, where there is no `window` to read an origin from
   * and this returns an empty string.
   */
  function socialRedirects() {
    return {
      callbackURL: Linking.createURL('/'),
      /**
       * Without this a failure lands on Better Auth's own error page, which
       * on a device is a page inside a sheet that has no way to close itself.
       * Coming back to this screen means the browser closes and — on the web,
       * where the URL survives — `returnedError` above has something to say.
       */
      errorCallbackURL: Linking.createURL('/sign-in'),
    }
  }

  async function onGoogle() {
    setSocialError(undefined)
    // No `router.replace` after this one: the browser redirect comes back into
    // the app on its own and the root layout reacts to the new session.
    const { error: googleError } = await authClient.signIn.social({
      provider: 'google',
      ...socialRedirects(),
    })
    if (googleError) setSocialError(t(authErrorKey(googleError) ?? 'errors.googleSignInFailed'))
  }

  async function onApple() {
    setSocialError(undefined)
    try {
      if (!(await isNativeAppleSignInAvailable())) {
        const { error: webError } = await authClient.signIn.social({
          provider: 'apple',
          ...socialRedirects(),
        })
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

      {/*
        Web only. On a phone you already have the app, so "sign in with your
        phone" is an instruction to use the thing you are holding — and the
        flow needs a *second* signed-in device to approve it.
      */}
      {Platform.OS === 'web' ? (
        <Button
          label={t('qrSignIn.title')}
          variant="secondary"
          onPress={() => router.push('/(auth)/qr')}
        />
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
        <Link href="/(auth)/sign-up" style={styles.link}>
          {t('auth.signUp')}
        </Link>
      </View>

      {/*
        The way out, for somebody who did not mean to be asked for a password.
        The welcome screen offers this and leads with it, but this screen is
        reachable without passing through it — a bookmark, a shared link, or
        tapping "I already have an account" and thinking better of it — and it
        draws no back control of its own, so on web that was a dead end.
      */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.justLooking')}</Text>
        <Text style={styles.link} onPress={() => void browse()}>
          {t('welcome.browse')}
        </Text>
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
