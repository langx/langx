import { deviceLinkQrUrl } from '@langx/shared'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'
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
 * Stands in for the bold "Me → Scan a code" while the body is translated, then
 * marks where to split it. NUL: a character no message can contain.
 */
const PATH_MARK = String.fromCharCode(0)

/** The seconds a code has left, as the prototype shows them: `m:ss`. */
function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

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
  const [secondsLeft, setSecondsLeft] = useState(0)
  // Kept in refs so the poll loop reads the current values without restarting
  // itself every render, which would reset the interval and never fire.
  const deviceCode = useRef<string | null>(null)
  const pollMs = useRef(2000)
  const { data: session } = authClient.useSession()

  const start = useCallback(async () => {
    setState('starting')
    /*
     * A refused code comes back as `error`; a network that never answers
     * *throws* from the fetch underneath, and that used to escape this callback
     * as an unhandled rejection — the red overlay in development, a spinner
     * that never ends in production. To the person both are "try again".
     */
    const response = await authClient.device
      .code({ client_id: 'langx-web', scope: 'openid' })
      .catch(() => null)
    if (!response || response.error || !response.data) {
      setState('error')
      return
    }
    const { data } = response
    deviceCode.current = data.device_code
    // The server says how often it will answer; polling faster earns a
    // `slow_down`, so the number is read here rather than assumed.
    pollMs.current = Math.max(Number(data.interval) || 2, 1) * 1000
    setUserCode(data.user_code)
    setSecondsLeft(data.expires_in)
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
        // A network blip mid-poll is not an answer; the next tick asks again.
        .catch(() => undefined)
    }, pollMs.current)
    return () => clearInterval(timer)
  }, [state])

  /*
   * The server says how long the code lives (`expires_in`) and the screen
   * counts it down. Reaching zero is taken as the expiry rather than waiting
   * for the poll to come back with `expired_token`: a code that reads
   * "Expires in 0:00" for another interval is one nobody trusts.
   */
  useEffect(() => {
    if (state !== 'waiting') return
    const tick = setInterval(() => setSecondsLeft((left) => Math.max(0, left - 1)), 1000)
    return () => clearInterval(tick)
  }, [state])

  useEffect(() => {
    if (state === 'waiting' && secondsLeft === 0) setState('expired')
  }, [state, secondsLeft])

  useEffect(() => {
    if (state !== 'approved') return
    if (session) {
      router.replace('/')
      return
    }
    const timer = setTimeout(() => setState('error'), SESSION_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [state, session])

  const [pathBefore = '', pathAfter = ''] = t('qrSignIn.bodyScan', { path: PATH_MARK }).split(
    PATH_MARK,
  )

  return (
    <Screen scroll style={styles.root}>
      <ScreenHeader title={t('linkDevice.title')} onBack={() => router.replace('/')} />

      {state === 'starting' ? <ActivityIndicator style={styles.loading} /> : null}

      {state === 'approved' ? (
        <View style={styles.approved}>
          <ActivityIndicator />
          <Text style={styles.message}>{t('auth.signingIn')}</Text>
        </View>
      ) : null}

      {state === 'waiting' ? (
        <>
          <Text style={styles.body}>
            {pathBefore}
            <Text style={styles.strong}>{t('qrSignIn.scanPath')}</Text>
            {pathAfter}
          </Text>
          <View style={styles.qrWrap}>
            {/*
             * A fixed size, not `width: '100%'`.
             *
             * The card centres its children, so on the cross axis "100%" has
             * nothing to be a percentage *of* — the image resolved to zero
             * width, painted nothing, and never even fetched. A QR wants a
             * known size anyway: too small and a camera cannot resolve the
             * modules, and it does not benefit from being bigger than a phone
             * screen held at arm's length. The ground stays white in both
             * schemes, because a camera needs the contrast.
             */}
            <View style={styles.qrCard}>
              {userCode ? (
                <Image
                  source={{ uri: deviceLinkQrUrl(API_URL, userCode) }}
                  style={styles.qr}
                  contentFit="contain"
                  accessibilityLabel={t('qrSignIn.qrAccessibility')}
                />
              ) : null}
            </View>
          </View>
          <View style={styles.codeBlock}>
            <Text style={styles.kicker}>{t('qrSignIn.orEnterCode')}</Text>
            <Text style={styles.code}>{userCode}</Text>
            <Text style={styles.expires}>
              {t('qrSignIn.expiresIn', { time: countdown(secondsLeft) })}
            </Text>
          </View>
        </>
      ) : null}

      {state === 'expired' || state === 'error' ? (
        <Text style={styles.message}>
          {t(state === 'expired' ? 'qrSignIn.expired' : 'qrSignIn.failed')}
        </Text>
      ) : null}

      {state === 'waiting' || state === 'expired' || state === 'error' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void start()}
          style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
        >
          <Text style={styles.link}>{t('qrSignIn.newCode')}</Text>
        </Pressable>
      ) : null}

      {Platform.OS !== 'web' ? <Text style={styles.hint}>{t('qrSignIn.webOnly')}</Text> : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // 22 between blocks, as the prototype stacks the auth screens.
  root: { gap: 22 },
  loading: { marginTop: spacing.xxl },
  approved: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 25 },
  strong: { color: colors.text, fontWeight: '700' },
  message: { color: colors.textMuted, fontSize: 16, lineHeight: 25, textAlign: 'center' },
  qrWrap: { alignItems: 'center', paddingVertical: spacing.md },
  qrCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 180,
    padding: 10,
    width: 180,
  },
  qr: { height: 160, width: 160 },
  codeBlock: { alignItems: 'center' },
  kicker: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Tracked so the characters can be read out one at a time to a phone.
  code: { ...font.heading, color: colors.text, fontSize: 40, letterSpacing: 3, marginTop: 6 },
  expires: { color: colors.textFaint, fontSize: 14, marginTop: spacing.xs },
  textLink: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  pressed: { opacity: 0.7 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  hint: { ...font.caption, color: colors.textFaint, textAlign: 'center' },
}))
