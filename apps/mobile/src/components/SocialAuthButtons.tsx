import * as Linking from 'expo-linking'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useAppConfig } from '../hooks/useAppConfig'
import { useT } from '../i18n'
import { isNativeAppleSignInAvailable, requestAppleIdentity } from '../lib/appleSignIn'
import { authClient } from '../lib/auth-client'
import { authErrorKey, oauthReturnErrorKey } from '../lib/errors'
import { withSignInProgress } from '../lib/signInProgress'
import { makeStyles } from '../lib/theme'
import { ProviderMark } from './ProviderMark'
import { Button } from './ui/Button'

/**
 * The "or continue with" block, shared by sign-in and sign-up.
 *
 * **A provider this deployment cannot complete a sign-in with is not drawn at
 * all**, per `packages/shared/src/appConfig.ts`. Drawing them disabled with a
 * "soon" label was tried and reverted before it shipped: a visible but inert
 * *Sign in with Apple* is a guideline 4.8 conversation nobody wants to have
 * during review, and a reviewer has no way to tell a button that is waiting on
 * credentials from one that is broken.
 *
 * Both handlers live here rather than on each screen so there is one Apple
 * flow, not two that drift — which is the part of this worth keeping, and the
 * reason sign-up has the block at all. A returning v1 user is told to continue
 * with Google or Apple, and sign-up is the screen most of them land on first.
 */
export interface SocialAuthButtonsProps {
  /**
   * Where the "or" rule is drawn. `below` is for sign-up, where the providers
   * come first — they are the only paths with no trip to an inbox — and the
   * rule then separates them from the email form underneath rather than
   * hanging above the screen's first choice.
   */
  divider?: 'above' | 'below'
  /**
   * Called when a provider button is pressed, before the flow leaves the app.
   * Sign-up passes the counter; sign-in passes nothing, because signing in is
   * not a sign-up and must not arrive in the funnel as one.
   */
  onStart?: (method: 'google' | 'apple') => void
}

export function SocialAuthButtons({ divider = 'above', onStart }: SocialAuthButtonsProps = {}) {
  const styles = useStyles()
  const t = useT()

  /**
   * Undefined while the config request is in flight, and after it fails —
   * both of which hide the buttons. That is the right way round: a provider we
   * cannot confirm is one we cannot complete a sign-in with, and a button that
   * opens a browser only to come back with "provider not found" is worse than
   * no button. Email and password never depend on this.
   */
  const providers = useAppConfig().data?.authProviders

  /**
   * A redirect sign-in that failed comes back as `?error=<code>` on the URL —
   * see `socialRedirects` — because by then the call that started it has long
   * since returned. Read once, at mount, before reaching the router.
   */
  const { error: returnedError } = useLocalSearchParams<{ error?: string }>()
  const [socialError, setSocialError] = useState<string | undefined>(() => {
    const key = oauthReturnErrorKey(returnedError)
    return key ? t(key) : undefined
  })

  /**
   * Called per press rather than computed once at module scope: the web build
   * is prerendered in Node, where there is no `window` to read an origin from
   * and this returns an empty string.
   */
  function socialRedirects() {
    return {
      callbackURL: Linking.createURL('/'),
      /**
       * Without this a failure lands on Better Auth's own error page, which on
       * a device is a page inside a sheet that has no way to close itself.
       */
      errorCallbackURL: Linking.createURL('/sign-in'),
    }
  }

  async function onGoogle() {
    setSocialError(undefined)
    onStart?.('google')
    // No `router.replace` after this one: the browser redirect comes back into
    // the app on its own and the root layout reacts to the new session.
    const { error: googleError } = await withSignInProgress(() =>
      authClient.signIn.social({ provider: 'google', ...socialRedirects() }),
    )
    if (googleError) setSocialError(t(authErrorKey(googleError) ?? 'errors.googleSignInFailed'))
  }

  async function onApple() {
    setSocialError(undefined)
    onStart?.('apple')
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

      const { error: appleError } = await withSignInProgress(() =>
        authClient.signIn.social({ provider: 'apple', idToken: identity }),
      )
      if (appleError) {
        setSocialError(t(authErrorKey(appleError) ?? 'errors.appleSignInFailed'))
        return
      }
      /*
       * And then nothing, for the reason `sign-in.tsx` gives at length: this
       * button only ever renders inside `(auth)`, so the session it just
       * created unmounts the screen it is on, and replacing in the same commit
       * is what crashes Android's Fabric rather than what smooths it over.
       */
    } catch {
      setSocialError(t('errors.appleSignInFailed'))
    }
  }

  if (!providers?.google && !providers?.apple) return null

  const rule = (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{t('auth.or')}</Text>
      <View style={styles.dividerLine} />
    </View>
  )

  return (
    <>
      {divider === 'above' ? rule : null}

      {socialError ? <Text style={styles.socialError}>{socialError}</Text> : null}

      {/*
        `neutral`, not `secondary`: a provider's button is nobody's second
        choice, it is a different door — so it takes the plain ink label and
        the provider's own mark, and leaves the blue for the app's own links.
      */}
      {providers.google ? (
        <Button
          label={t('auth.continueWithGoogle')}
          onPress={() => void onGoogle()}
          variant="neutral"
          icon={<ProviderMark provider="google" />}
        />
      ) : null}
      {providers.apple ? (
        <Button
          label={t('auth.continueWithApple')}
          onPress={() => void onApple()}
          variant="neutral"
          icon={<ProviderMark provider="apple" />}
        />
      ) : null}
      {divider === 'below' ? rule : null}
    </>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { ...font.label, color: colors.textFaint, fontWeight: '400' },
  socialError: { ...font.body, color: colors.danger },
}))
