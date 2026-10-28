import Feather from '@expo/vector-icons/Feather'
import { MAGIC_LINK_TTL_MINUTES } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useCaptcha } from '../../src/hooks/useCaptcha'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useV3LaunchLook } from '../../src/hooks/useV3LaunchLook'
import { SignInLinkV3 } from '../../src/components/auth/SignInLinkV3'
import { useT } from '../../src/i18n'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'

/**
 * Ask for a sign-in link by email — the door with no password behind it.
 *
 * Built on `forgot-password.tsx`, and it keeps that screen's one deliberate
 * ambiguity: the server answers `{ status: true }` whether or not the
 * address has an account, and mails only when it does, so this screen says
 * "check your email" either way. A handle works here too; the server
 * rewrites it to the address on file.
 */
/** Long enough for a slow mail provider behind the API; short enough that a stuck request is an answer. */
const REQUEST_TIMEOUT_MS = 20_000

export default function SignInLink() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()
  // The link mails a typed address, so the API checks it as it does sign-up.
  const captcha = useCaptcha()
  // The redesign's look behind `flags.v3Home`; see `latchV3LaunchLook`.
  const v3 = useV3LaunchLook()

  async function onSubmit() {
    setLoading(true)
    setError(undefined)
    // The failure branch is only for a request that did not go out at all —
    // a malformed address, a rate limit, or a request that never came back.
    // A known-or-unknown address answers the same 200, by design. The
    // timeout is the part that was missing: a request held open by a proxy
    // or an extension left this button spinning for good, with no way to
    // tell it from a slow send and nothing to press.
    const { error: sendError } = await authClient.signIn.magicLink({
      email: email.trim(),
      fetchOptions: { ...captcha.fetchOptions, timeout: REQUEST_TIMEOUT_MS },
    })
    setLoading(false)
    if (sendError) {
      // The token was spent on this attempt whatever the answer was.
      captcha.reset()
      const key = authErrorKey(sendError)
      setError(t(key === 'errors.captchaFailed' ? key : 'errors.signInFailed'))
      return
    }
    setSent(true)
  }

  if (v3) {
    return (
      <SignInLinkV3
        email={email}
        onChangeEmail={setEmail}
        error={error}
        loading={loading}
        canSubmit={!loading && !!email.trim() && !captcha.checking}
        sent={sent}
        onSubmit={onSubmit}
        captchaWidget={captcha.widget}
        captchaChecking={!!email.trim() && captcha.checking}
      />
    )
  }

  if (sent) {
    // Laid out like `check-email`, which is the screen this state stands in for.
    return (
      <Screen fluid style={styles.centred}>
        <View style={styles.badge}>
          <Feather name="mail" size={30} color={colors.accent} />
        </View>
        <Text style={styles.centredTitle}>{t('auth.checkEmailTitle')}</Text>
        <Text style={styles.centredBody}>
          {t('auth.signInLinkSentBody', { email, count: MAGIC_LINK_TTL_MINUTES })}
        </Text>
        <View style={styles.centredActions}>
          <Button label={t('auth.goToSignIn')} onPress={() => router.push('/(auth)/sign-in')} />
        </View>
      </Screen>
    )
  }

  const canSubmit = !loading && !!email.trim() && !captcha.checking

  return (
    <Screen scroll style={styles.form}>
      {/* Back only: the 30px title below is the screen's title. */}
      <ScreenHeader onBack={() => goBackTo('/(auth)/sign-in')} />
      <View>
        <Text style={styles.title}>{t('auth.signInLinkTitle')}</Text>
        <Text style={styles.body}>{t('auth.signInLinkBody')}</Text>
      </View>
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        placeholder={t('auth.emailOrHandle')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        error={error}
      />
      {captcha.widget}
      <Button
        label={t('auth.sendSignInLink')}
        onPress={onSubmit}
        loading={loading}
        disabled={!canSubmit}
      />
      {!!email.trim() && captcha.checking ? (
        <Text style={styles.checking}>{t('auth.captchaChecking')}</Text>
      ) : null}
      <Text style={styles.note}>{t('auth.signInLinkNote', { count: MAGIC_LINK_TTL_MINUTES })}</Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // 22 between blocks, as the prototype stacks the auth screens.
  form: { gap: 22 },
  title: { ...font.title, color: colors.text, lineHeight: 36 },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  note: { color: colors.textFaint, fontSize: 14, lineHeight: 21 },
  // Under the button it is holding, and quieter than an error.
  checking: { color: colors.textFaint, fontSize: 13, marginTop: -spacing.sm, textAlign: 'center' },
  // The prototype's 20 between the icon, the title and the words.
  centred: { alignItems: 'center', gap: 20, justifyContent: 'center', paddingBottom: 28 },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  centredTitle: { ...font.title, color: colors.text, lineHeight: 36, textAlign: 'center' },
  centredBody: { color: colors.textMuted, fontSize: 16, lineHeight: 25, textAlign: 'center' },
  centredActions: { gap: spacing.md, marginTop: 20, width: '100%' },
}))
