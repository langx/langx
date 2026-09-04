import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useAppConfig } from '../hooks/useAppConfig'
import { useT } from '../i18n'
import { isNativeAppleSignInAvailable, requestAppleIdentity } from '../lib/appleSignIn'
import { authClient } from '../lib/auth-client'
import { authErrorKey, oauthReturnErrorKey } from '../lib/errors'
import { makeStyles } from '../lib/theme'
import { Button } from './ui/Button'

/**
 * The "or continue with" block, shared by sign-in and sign-up.
 *
 * **The buttons are always drawn, even for a provider this deployment cannot
 * complete a sign-in with** — then they are disabled and labelled "soon".
 * That is a reversal of the rule `packages/shared/src/appConfig.ts` states
 * ("a button which cannot work should not be drawn"), and the reasoning has
 * changed rather than been forgotten: the store listing and the marketing
 * site both promise Google and Apple sign-in, so on the deployment those
 * screenshots come from their absence reads as a broken build, not as a
 * feature that has not landed. `authProviders` still decides whether a button
 * can be *pressed*, which is what kept a self-hosted instance from opening a
 * browser onto "provider not found" — the failure the old rule was about.
 *
 * Both handlers live here rather than on each screen so there is one Apple
 * flow, not two that drift.
 */
export function SocialAuthButtons() {
  const styles = useStyles()
  const t = useT()

  /**
   * Undefined while the config request is in flight, and after it fails. Both
   * mean "cannot confirm", which disables rather than hides — a button that is
   * there but not yet pressable is a smaller lie than one that vanishes.
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

  return (
    <>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {socialError ? <Text style={styles.socialError}>{socialError}</Text> : null}

      <SocialButton
        enabled={providers?.google === true}
        label={t('auth.continueWithGoogle')}
        onPress={onGoogle}
      />
      <SocialButton
        enabled={providers?.apple === true}
        label={t('auth.continueWithApple')}
        onPress={onApple}
      />
    </>
  )
}

/**
 * One provider row. The "soon" pill sits beside the button rather than inside
 * its label, so the label stays the provider's own wording — which is what
 * both Google's and Apple's branding rules require it to be.
 */
function SocialButton({
  enabled,
  label,
  onPress,
}: {
  enabled: boolean
  label: string
  onPress: () => void | Promise<void>
}) {
  const styles = useStyles()
  const t = useT()

  return (
    <View style={styles.socialRow}>
      <Button
        disabled={!enabled}
        label={label}
        onPress={() => void onPress()}
        style={styles.socialButton}
        variant="secondary"
      />
      {enabled ? null : (
        <View style={styles.soonPill} pointerEvents="none">
          <Text style={styles.soonText}>{t('auth.providerSoon')}</Text>
        </View>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { ...font.label, color: colors.textFaint, fontWeight: '400' },
  socialError: { ...font.body, color: colors.danger },
  socialRow: { justifyContent: 'center' },
  socialButton: { width: '100%' },
  /**
   * Absolutely placed so the pill cannot change the button's height, which
   * would make the two rows disagree whenever only one provider is live.
   */
  soonPill: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -11 }],
  },
  soonText: { ...font.label, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
}))
