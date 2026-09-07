import Feather from '@expo/vector-icons/Feather'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SocialAuthButtons } from '../../src/components/SocialAuthButtons'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import { goBackTo } from '../../src/lib/navigation'
import { withSignInProgress } from '../../src/lib/signInProgress'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

export default function SignIn() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
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
    <Screen scroll style={styles.form}>
      {/*
        Back only: the 30px title below is the screen's title, and the row is
        also the way out for somebody who did not mean to be asked for a
        password — a bookmark or a shared link lands here with no history, so
        the fallback is the welcome screen and its "look around first".
      */}
      <ScreenHeader onBack={() => goBackTo('/(auth)/welcome')} />

      <View>
        <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
        <Text style={styles.subtitle}>{t('auth.welcomeBackSubtitle')}</Text>
      </View>

      <View style={styles.fields}>
        <FormField
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && void onSubmit()}
          placeholder={t('auth.emailOrHandle')}
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
          placeholder={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          error={error}
        />
        <Link href="/(auth)/forgot-password" style={styles.forgot}>
          {t('auth.forgotPassword')}
        </Link>
      </View>

      <Button
        label={t('auth.signIn')}
        onPress={onSubmit}
        loading={loading}
        disabled={!email || !password}
      />

      {/*
        The door with no password behind it — and for a returning v1
        account, whose row here has none, the shortest one. Carries what
        was typed so it is not typed twice.
      */}
      <Link href={{ pathname: '/(auth)/sign-in-link', params: { email } }} style={styles.textLink}>
        {t('auth.signInWithLink')}
      </Link>

      <SocialAuthButtons />

      {/*
        Web only. On a phone you already have the app, so "sign in with your
        phone" is an instruction to use the thing you are holding — and the
        flow needs a *second* signed-in device to approve it.
      */}
      {Platform.OS === 'web' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/qr')}
          style={({ pressed }) => [styles.qrLink, pressed && styles.pressed]}
        >
          <Feather name="maximize" size={18} color={colors.accent} />
          <Text style={styles.link}>{t('auth.signInWithCode')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
        <Link href="/(auth)/sign-up" style={styles.link}>
          {t('auth.signUp')}
        </Link>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  // 22 between blocks, as the prototype stacks the auth screens.
  form: { gap: 22 },
  title: { ...font.title, color: colors.text, lineHeight: 36 },
  subtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  fields: { gap: 14 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  // Hugs its words so the tap target is the link, not the whole row.
  forgot: {
    alignSelf: 'flex-start',
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  // Pulled up towards the button it is the alternative to.
  textLink: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    marginTop: -spacing.sm,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  qrLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  footerText: { color: colors.textMuted, fontSize: 15 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
}))
