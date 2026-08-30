import * as Linking from 'expo-linking'
import { Link, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { authClient } from '../../src/lib/auth-client'
import { useT } from '../../src/i18n'

export default function CheckEmail() {
  const styles = useStyles()
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
      <Text style={styles.body}>{t('auth.checkEmailBody', { email: email ?? '' })}</Text>

      <Button
        label={sent ? t('auth.resent') : t('auth.resendEmail')}
        onPress={onResend}
        loading={loading}
        variant="secondary"
      />

      <Link href="/(auth)/sign-in" style={styles.link}>
        {t('auth.backToSignIn')}
      </Link>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: spacing.lg + 4,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...font.title,
    color: colors.text,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
  },
  body: { ...font.body, color: colors.textMuted, lineHeight: 23, textAlign: 'center' },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}))
