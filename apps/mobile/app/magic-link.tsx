import { Image } from 'expo-image'
import logo from '../assets/brand/logo-rounded.png'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native'
import { Button } from '../src/components/ui/Button'
import { Screen } from '../src/components/ui/Screen'
import { useScreenInteractive } from '../src/hooks/useScreenInteractive'
import { useT } from '../src/i18n'
import { authClient } from '../src/lib/auth-client'
import { authErrorKey } from '../src/lib/errors'
import { shouldGateGuest } from '../src/lib/guestGate'
import { appLinkForToken, MAGIC_LINK_FAILED_PATH } from '../src/lib/magicLink'
import { withSignInProgress } from '../src/lib/signInProgress'
import { makeStyles } from '../src/lib/theme'

/**
 * Where the emailed sign-in link lands, on every platform and in every
 * session state.
 *
 * At the root rather than inside `(auth)`, because a signed-in member can
 * tap the link too — and with `(auth)` unmounted for them, an https link
 * into it would fall through to `[username]` as "@magic-link". Here it always
 * mounts, and a real session simply goes home with the token unspent.
 *
 * **The app spends the token, not the link.** The mail carries a page (this
 * one), never the API's verify endpoint, because whatever makes that GET is
 * what ends up signed in — and from an inbox that is the mail client's
 * browser, not this app (`verify-email-success.tsx` records that failure for
 * the verification link). Calling `magicLink.verify` from here puts the
 * session cookie in the app's own store, the way `reset-password` already
 * does for its token.
 *
 * Native verifies on mount: a universal-link tap is a person, and no mail
 * scanner opens an installed app. The web waits for a tap, because link
 * previewers do run JavaScript, and a button between them and the token is
 * what keeps the link alive until the person gets to it.
 */
export default function MagicLinkScreen() {
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
      const { error: verifyError } = await withSignInProgress(() =>
        authClient.magicLink.verify({
          query: { token, errorCallbackURL: MAGIC_LINK_FAILED_PATH },
        }),
      )
      if (verifyError) {
        setError(t(authErrorKey(verifyError) ?? 'errors.invalidToken'))
        return
      }
      // The browser has the cookie but nothing told the session store: the
      // client's own listener list does not include this endpoint. Harmless
      // on native, where the Expo client already notified.
      authClient.$store.notify('$sessionSignal')
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
        <Text style={styles.title}>{t('auth.linkExpiredTitle')}</Text>
        <Text style={styles.body}>{error ?? t('auth.signInLinkExpiredBody')}</Text>
        <Button
          label={t('auth.requestNewLink')}
          onPress={() => router.replace('/(auth)/sign-in-link')}
          style={styles.action}
        />
      </Screen>
    )
  }

  if (Platform.OS === 'web') {
    return (
      <Screen fluid style={styles.root}>
        <Brand />
        <Text style={styles.title}>{t('auth.openLinkTitle')}</Text>
        <Text style={styles.body}>{t('auth.openLinkBody')}</Text>
        <Button
          label={t('auth.openLinkButton')}
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
          onPress={() => void Linking.openURL(appLinkForToken(token))}
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
      <Text style={styles.body}>{t('auth.signingIn')}</Text>
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
