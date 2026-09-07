import Feather from '@expo/vector-icons/Feather'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { authClient } from '../../src/lib/auth-client'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Stands in for the address while the body is translated, then marks where to
 * split it so the address alone can be set in bold. NUL: a character no
 * message can contain.
 */
const EMAIL_MARK = String.fromCharCode(0)

export default function CheckEmail() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { email } = useLocalSearchParams<{ email: string }>()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onResend() {
    if (!email) return
    setLoading(true)
    await authClient.sendVerificationEmail({
      email,
      callbackURL: Linking.createURL('verify-email-success'),
    })
    setLoading(false)
    setSent(true)
  }

  const [before = '', after = ''] = t('auth.checkEmailBody', { email: EMAIL_MARK }).split(
    EMAIL_MARK,
  )

  return (
    <Screen fluid style={styles.root}>
      <View style={styles.badge}>
        <Feather name="mail" size={30} color={colors.accent} />
      </View>
      <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
      <Text style={styles.body}>
        {before}
        <Text style={styles.strong}>{email ?? ''}</Text>
        {after}
      </Text>

      <View style={styles.actions}>
        <Button label={t('auth.goToSignIn')} onPress={() => router.push('/(auth)/sign-in')} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading}
          onPress={() => void onResend()}
          style={({ pressed }) => [styles.resend, (pressed || loading) && styles.pressed]}
        >
          <Text style={styles.link}>{sent ? t('auth.resent') : t('auth.resendEmail')}</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // The prototype's 20 between the icon, the title and the words.
  root: { alignItems: 'center', gap: 20, justifyContent: 'center', paddingBottom: 28 },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  title: { ...font.title, color: colors.text, lineHeight: 36, textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 25, textAlign: 'center' },
  strong: { color: colors.text, fontWeight: '700' },
  actions: { gap: spacing.md, marginTop: 20, width: '100%' },
  resend: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  pressed: { opacity: 0.7 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
}))
