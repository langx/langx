import { Image } from 'expo-image'
import logo from '../assets/brand/logo-rounded.png'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native'
import { Button } from '../src/components/ui/Button'
import { Screen } from '../src/components/ui/Screen'
import { useScreenInteractive } from '../src/hooks/useScreenInteractive'
import { useT } from '../src/i18n'
import { track } from '../src/lib/analytics'
import { authClient } from '../src/lib/auth-client'
import { authErrorKey } from '../src/lib/errors'
import { shouldGateGuest } from '../src/lib/guestGate'
import { appLinkForVerifyToken } from '../src/lib/magicLink'
import { withSignInProgress } from '../src/lib/signInProgress'
import { makeStyles } from '../src/lib/theme'

/**
 * Where the emailed address-verification link lands.
 *
 * Modelled on `magic-link.tsx`, for the same three reasons: it is at the root
 * so that a signed-in member tapping a stale link still mounts a screen rather
 * than falling through to `[username]`; **the app spends the token**, so the
 * session `autoSignInAfterVerification` creates lands in this app's store and
 * not in whatever browser the mail client opened; and the web build waits for
 * a tap, because link previewers run JavaScript and a button is what keeps the
 * link alive until the person reaches it.
 *
 * What this replaces: the mail used to carry Better Auth's own verify
 * endpoint, so the new account was verified and signed in *somewhere else* and
 * had to type its password a second time to get into the app.
 *
 * On success the gate at `app/index.tsx` does the routing — a verified account
 * with no profile is sent to the first onboarding step by the same rule that
 * handles every other way of arriving signed in.
 */
export default function VerifyEmailScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const { data: session, isPending } = authClient.useSession()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fired = useRef(false)

  const signedIn = Boolean(session) && !shouldGateGuest(session?.user)

  async function verify(): Promise<void> {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      // No `callbackURL`: with one, Better Auth answers a bad token with a
      // redirect instead of an error, and the app would read a failure as a
      // success. Without one it returns a real 401 carrying the code.
      const { error: verifyError } = await withSignInProgress(() =>
        authClient.verifyEmail({ query: { token } }),
      )
      if (verifyError) {
        setError(t(authErrorKey(verifyError) ?? 'errors.invalidToken'))
        return
      }
      // The only place the email path can be counted: it is the first moment
      // the app knows a mailed link was actually opened by the person.
      track({ name: 'signup_verified', properties: { method: 'email' } })
      router.replace('/')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (isPending) return
    if (signedIn) {
      router.replace('/')
      return
    }
    if (Platform.OS !== 'web' && token && !fired.current) {
      fired.current = true
      void verify()
    }
    // `verify` is deliberately not a dependency: it reads only refs and state
    // it sets itself, and the `fired` guard is what keeps this to one call.
  }, [isPending, signedIn, token])

  if (!token || error) {
    return (
      <Screen fluid style={styles.root}>
        <Brand />
        <Text style={styles.title}>{t('auth.verificationFailedTitle')}</Text>
        <Text style={styles.body}>{error ?? t('auth.verificationFailedBody')}</Text>
        <Button
          label={t('auth.signIn')}
          onPress={() => router.replace('/(auth)/sign-in')}
          style={styles.action}
        />
      </Screen>
    )
  }

  if (Platform.OS === 'web') {
    return (
      <Screen fluid style={styles.root}>
        <Brand />
        <Text style={styles.title}>{t('auth.verifyLinkTitle')}</Text>
        <Text style={styles.body}>{t('auth.verifyLinkBody')}</Text>
        <Button
          label={t('auth.verifyLinkButton')}
          onPress={verify}
          loading={busy}
          style={styles.action}
        />
        {/*
          For a phone where the https link opened a browser instead of the
          app — an Android app link that is not verified, or a link pasted
          into Safari. The scheme link cannot be intercepted by anyone else.
        */}
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(appLinkForVerifyToken(token))}
          style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
        >
          <Text style={styles.link}>{t('auth.openInApp')}</Text>
        </Pressable>
      </Screen>
    )
  }

  return (
    <Screen fluid style={styles.root}>
      <ActivityIndicator />
      <Text style={styles.body}>{t('auth.verifying')}</Text>
    </Screen>
  )
}

/** The rounded icon and the wordmark, as the welcome screen opens with them. */
function Brand() {
  const styles = useStyles()
  return (
    <View style={styles.brand}>
      <Image
        source={logo}
        style={styles.logo}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      {/* The wordmark is the brand, not copy: it reads "LangX" in all eight locales. */}
      <Text style={styles.wordmark}>LangX</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // The prototype's 20 between the brand, the title and the words.
  root: { alignItems: 'center', gap: 20, justifyContent: 'center', paddingBottom: 28 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  logo: { borderRadius: radius.md, height: 48, width: 48 },
  wordmark: { ...font.heading, color: colors.text, fontSize: 26, letterSpacing: -0.3 },
  title: { ...font.title, color: colors.text, lineHeight: 36, textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 25, textAlign: 'center' },
  action: { marginTop: 20 },
  textLink: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  pressed: { opacity: 0.7 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
}))
