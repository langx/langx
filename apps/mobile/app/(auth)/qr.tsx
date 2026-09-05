import { deviceLinkQrUrl } from '@langx/shared'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { API_URL } from '../../src/lib/apiUrl'
import { authClient } from '../../src/lib/auth-client'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * How long, after the phone has approved, to wait for the session store to
 * catch up before calling the sign-in failed. Generous: the cookie is already
 * set by then and one session fetch is all that is left.
 */
const SESSION_SETTLE_MS = 15_000

/**
 * Sign in here by approving it on a phone that is already signed in.
 *
 * RFC 8628's device flow: this asks the server for a pair of codes, shows the
 * short one (and a QR of the link that carries it), and polls until a phone
 * approves. The plugin owns the protocol; this owns the waiting.
 *
 * **The code is the feature and the QR is the shortcut.** Five characters
 * can be typed on any device; the QR is read by the phone's own camera or by
 * the scan icon on the Me tab (`(app)/scan.tsx`).
 */
export default function QrSignInScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const [state, setState] = useState<'starting' | 'waiting' | 'approved' | 'expired' | 'error'>(
    'starting',
  )
  const [userCode, setUserCode] = useState('')
  // Kept in refs so the poll loop reads the current values without restarting
  // itself every render, which would reset the interval and never fire.
  const deviceCode = useRef<string | null>(null)
  const pollMs = useRef(2000)
  const { data: session } = authClient.useSession()

  const start = useCallback(async () => {
    setState('starting')
    const { data, error } = await authClient.device.code({
      client_id: 'langx-web',
      scope: 'openid',
    })
    if (error || !data) {
      setState('error')
      return
    }
    deviceCode.current = data.device_code
    // The server says how often it will answer; polling faster earns a
    // `slow_down`, so the number is read here rather than assumed.
    pollMs.current = Math.max(Number(data.interval) || 2, 1) * 1000
    setUserCode(data.user_code)
    setState('waiting')
  }, [])

  useEffect(() => {
    void start()
  }, [start])

  useEffect(() => {
    if (state !== 'waiting') return
    const timer = setInterval(() => {
      const code = deviceCode.current
      if (!code) return
      void authClient.device
        .token({
          // The grant type is part of the protocol, not a detail: the same
          // endpoint serves other grants and rejects a request without it.
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: code,
          client_id: 'langx-web',
        })
        .then((result) => {
          /*
           * `authorization_pending` and `slow_down` are the protocol saying
           * "keep going", not failures — treating any error as terminal is the
           * classic way to implement this flow wrong, since the *expected*
           * answer for most of its life is an error.
           */
          const code_ = (result.error as { error?: string } | null)?.error
          if (code_ === 'authorization_pending' || code_ === 'slow_down') return
          if (result.error) {
            setState('expired')
            return
          }
          /*
           * The browser has the cookie, but nothing has told the session store.
           * Better Auth's client refetches `useSession` only after a fixed list
           * of its own endpoints, and `/device/token` is not on it — so the
           * store still says signed out, and navigating now lands on the
           * welcome page (which is exactly what happened). Nudge the store,
           * show that something is happening, and leave the navigation to the
           * effect below, which moves only once the session is actually there.
           */
          clearInterval(timer)
          setState('approved')
          authClient.$store.notify('$sessionSignal')
        })
    }, pollMs.current)
    return () => clearInterval(timer)
  }, [state])

  useEffect(() => {
    if (state !== 'approved') return
    if (session) {
      router.replace('/')
      return
    }
    const timer = setTimeout(() => setState('error'), SESSION_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [state, session])

  return (
    <Screen scroll>
      <ScreenHeader title={t('qrSignIn.title')} onBack={() => router.replace('/')} />

      {state === 'starting' ? <ActivityIndicator style={styles.loading} /> : null}

      {state === 'approved' ? (
        <View style={styles.approved}>
          <ActivityIndicator />
          <Text style={styles.body}>{t('auth.signingIn')}</Text>
        </View>
      ) : null}

      {state === 'waiting' ? (
        <>
          <View style={styles.card}>
            {userCode ? (
              <Image
                source={{ uri: deviceLinkQrUrl(API_URL, userCode) }}
                style={styles.qr}
                contentFit="contain"
                accessibilityLabel={t('qrSignIn.qrAccessibility')}
              />
            ) : null}
            <Text style={styles.code}>{userCode}</Text>
          </View>
          <Text style={styles.body}>{t('qrSignIn.body')}</Text>
          <Text style={styles.hint}>{t('qrSignIn.hint')}</Text>
        </>
      ) : null}

      {state === 'expired' || state === 'error' ? (
        <View style={styles.retry}>
          <Text style={styles.body}>
            {t(state === 'expired' ? 'qrSignIn.expired' : 'qrSignIn.failed')}
          </Text>
          <Button label={t('qrSignIn.again')} onPress={() => void start()} />
        </View>
      ) : null}

      {Platform.OS !== 'web' ? <Text style={styles.hint}>{t('qrSignIn.webOnly')}</Text> : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  approved: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  /*
   * A fixed size, not `width: '100%'`.
   *
   * The card centres its children, so on the cross axis "100%" has nothing to
   * be a percentage *of* — the image resolved to zero width, painted nothing,
   * and never even fetched. A QR wants a known size anyway: too small and a
   * camera cannot resolve the modules, and it does not benefit from being
   * bigger than a phone screen held at arm's length.
   */
  qr: {
    backgroundColor: '#ffffff',
    borderRadius: radius.sm,
    height: 220,
    width: 220,
  },
  code: { ...font.title, color: colors.text, fontSize: 32, letterSpacing: 6 },
  body: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  hint: { ...font.caption, color: colors.textFaint, marginTop: spacing.sm, textAlign: 'center' },
  retry: { gap: spacing.md, marginTop: spacing.xl },
}))
