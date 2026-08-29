import { MINIMUM_AGE } from '@langx/shared'
import * as Linking from 'expo-linking'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { authClient } from '../../src/lib/auth-client'
import { authErrorMessage } from '../../src/lib/errors'

export default function SignUp() {
  const styles = useStyles()
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
      setError(authErrorMessage(signUpError) ?? 'Sign up failed')
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
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>You must be {MINIMUM_AGE}+ to use LangX.</Text>

      <FormField
        label="Name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
      />
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        error={error}
      />

      <Button
        label="Sign up"
        onPress={onSubmit}
        loading={loading}
        disabled={!name || !email || !password}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          Sign in
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
