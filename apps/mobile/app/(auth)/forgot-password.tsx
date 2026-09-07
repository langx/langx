import Feather from '@expo/vector-icons/Feather'
import * as Linking from 'expo-linking'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { authClient } from '../../src/lib/auth-client'
import { goBackTo } from '../../src/lib/navigation'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

export default function ForgotPassword() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit() {
    setLoading(true)
    // Better Auth returns { status: true } whether or not the email exists,
    // by design (see api/routes/password.mjs) — that ambiguity is
    // intentional, so the UI can't tell an attacker which emails are real.
    await authClient.requestPasswordReset({
      email,
      redirectTo: Linking.createURL('reset-password'),
    })
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    // Laid out like `check-email`, which is the screen this state stands in for.
    return (
      <Screen fluid style={styles.centred}>
        <View style={styles.badge}>
          <Feather name="mail" size={30} color={colors.accent} />
        </View>
        <Text style={styles.centredTitle}>{t('auth.checkEmailTitle')}</Text>
        <Text style={styles.centredBody}>{t('auth.resetSentBody', { email })}</Text>
        <View style={styles.centredActions}>
          <Button label={t('auth.goToSignIn')} onPress={() => router.push('/(auth)/sign-in')} />
        </View>
      </Screen>
    )
  }

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && !!email

  return (
    <Screen scroll style={styles.form}>
      {/* Back only: the 30px title below is the screen's title. */}
      <ScreenHeader onBack={() => goBackTo('/(auth)/sign-in')} />
      <View>
        <Text style={styles.title}>{t('auth.resetTitle')}</Text>
        <Text style={styles.body}>{t('auth.resetBody')}</Text>
      </View>
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        placeholder={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <Button
        label={t('auth.sendResetLink')}
        onPress={onSubmit}
        loading={loading}
        disabled={!email}
      />
      <Link href="/(auth)/sign-in" style={styles.textLink}>
        {t('auth.backToSignIn')}
      </Link>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // 22 between blocks, as the prototype stacks the auth screens.
  form: { gap: 22 },
  title: { ...font.title, color: colors.text, lineHeight: 36 },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  textLink: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
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
