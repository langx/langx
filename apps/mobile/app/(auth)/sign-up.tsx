import { MINIMUM_AGE } from '@langx/shared'
import * as Linking from 'expo-linking'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import { useT } from '../../src/i18n'

export default function SignUp() {
  const styles = useStyles()
  const t = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit() {
    setError(undefined)
    setLoading(true)
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      // Resolves to langx://verify-email-success on native and the
      // equivalent same-origin path on web — Linking.createURL handles the
      // platform difference so this file doesn't have to.
      callbackURL: Linking.createURL('verify-email-success'),
    })
    setLoading(false)

    if (signUpError) {
      setError(t(authErrorKey(signUpError) ?? 'errors.signUpFailed'))
      return
    }
    router.replace({ pathname: '/(auth)/check-email', params: { email } })
  }

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && !!name && !!email && !!password

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{t('auth.createAccount')}</Text>
      <Text style={styles.subtitle}>{t('auth.minimumAge', { age: MINIMUM_AGE })}</Text>

      <FormField
        label={t('auth.name')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
      />
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        error={error}
      />

      <Button
        label={t('auth.signUp')}
        onPress={onSubmit}
        loading={loading}
        disabled={!name || !email || !password}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.signIn')}
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: 8, opacity: 0.6 },
  link: { color: colors.accent, fontWeight: '600', textDecorationLine: 'underline' },
  footerText: { color: colors.textMuted },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
}))
