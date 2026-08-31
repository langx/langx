import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { keys } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { authClient } from '../../src/lib/auth-client'
import { shouldGateGuest } from '../../src/lib/guestGate'
import { makeStyles } from '../../src/lib/theme'

/**
 * The first thing somebody sees, once the intro has played.
 *
 * It exists because the app used to demand an email before showing anything at
 * all — a stranger had to trust a language-exchange app enough to hand over an
 * address before they could see whether anyone here spoke their language.
 *
 * Three choices, and "look around" leads because it is the one that asks for
 * nothing.
 */
export default function WelcomeScreen() {
  const t = useT()
  const { data: session } = authClient.useSession()
  const styles = useStyles()
  const queryClient = useQueryClient()
  const [starting, setStarting] = useState(false)

  async function browse(): Promise<void> {
    if (starting) return
    setStarting(true)
    /*
     * `try`, not just the returned `error`. Better Auth's client returns one
     * for a rejected *request*, and throws for a failed *connection* — the
     * offline case is the throw, and it is also the likeliest one on a first
     * launch. Catching only the first left an uncaught error on the very first
     * screen somebody sees.
     */
    const failed = await authClient.signIn
      .anonymous()
      .then(({ error }) => Boolean(error))
      .catch(() => true)
    if (failed) {
      setStarting(false)
      await showAlert(t('welcome.guestFailed'), t('common.retry'))
      return
    }
    /*
     * The session changed, so anything cached under the previous one is about
     * to be answered differently — the gate reads `useMe` to decide where to
     * send them, and a stale 404 or a stale profile would send them to the
     * wrong place.
     */
    await queryClient.invalidateQueries({ queryKey: keys.me })
    // The effect below does the navigating; see why there.
  }

  /*
   * Navigating from inside `browse()` does not work, and neither of the two
   * obvious targets does either.
   *
   * `/(onboarding)/languages` fails because at that instant `useSession` has
   * not re-rendered the root layout, so `(onboarding)` is not mounted and the
   * replace silently does nothing. And `/` fails differently: both this group
   * and the root have an `index`, and expo-router resolves it to `(auth)/index`
   * — which reads the intro flag and sends the reader straight back here.
   *
   * So it waits for the session to actually exist, which is also the only
   * moment the destination is guaranteed to be mounted.
   */
  useEffect(() => {
    if (shouldGateGuest(session?.user)) router.replace('/(onboarding)/languages')
  }, [session])

  return (
    <Screen>
      <View style={styles.body}>
        <Text style={styles.title}>{t('welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
      </View>

      <View style={styles.actions}>
        <Button label={t('welcome.browse')} onPress={browse} loading={starting} />
        <Button
          variant="secondary"
          label={t('welcome.createAccount')}
          onPress={() => router.push('/(auth)/sign-up')}
        />
        {/*
          A text row rather than a third button: somebody who already has an
          account knows they do, and does not need it competing for attention
          with the two choices for somebody who does not.
        */}
        <Text style={styles.signIn} onPress={() => router.push('/(auth)/sign-in')}>
          {t('welcome.haveAccount')}
        </Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  body: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  title: { ...font.title, color: colors.text, fontSize: 30, lineHeight: 38 },
  subtitle: { ...font.body, color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
  signIn: {
    ...font.label,
    color: colors.accent,
    fontSize: 15,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
}))
