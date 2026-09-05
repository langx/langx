import { Link, router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { SocialAuthButtons } from '../../src/components/SocialAuthButtons'
import { useGuestBrowse } from '../../src/hooks/useGuestBrowse'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import { withSignInProgress } from '../../src/lib/signInProgress'
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
      // Narrated if it drags: a returning v1 account is restored inside this
      // request, so for those people it is genuinely slow (see
      // `lib/signInProgress.ts`).
      const { error: signInError } = await withSignInProgress(() =>
        authClient.signIn.email({ email, password }),
      )
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
        label={t('auth.emailOrHandle')}
        value={email}
        onChangeText={setEmail}
        // Still the email keyboard: it puts `@` and `.` on the first layer,
        // which an address needs and a handle never minds. `username` rather
        // than `emailAddress` for the autofill hints, so a password manager
        // offers the saved credential for this site whichever of the two was
        // stored — `emailAddress` offers addresses from the contact card, most
        // of which have never been used here.
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
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

      <SocialAuthButtons />

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
  footerText: { color: colors.textMuted, fontSize: 15 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
}))
