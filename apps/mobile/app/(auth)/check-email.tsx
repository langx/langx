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

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
    textAlign: 'center',
  },
  email: { color: colors.text, fontWeight: '600' },
  link: {
    color: colors.accent,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
}))
