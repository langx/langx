import { MINIMUM_AGE } from '@langx/shared'
import * as Linking from 'expo-linking'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { Checkbox } from '../../src/components/ui/Checkbox'
import { LEGAL_LINKS } from '../../src/lib/externalLinks'
import { openExternal } from '../../src/lib/openExternal'
import { FormField } from '../../src/components/ui/FormField'
import { shouldGateGuest } from '../../src/lib/guestGate'
import { authClient } from '../../src/lib/auth-client'
import { authErrorKey } from '../../src/lib/errors'
import {
  PASSWORD_MIN_LENGTH,
  passwordIssueKey,
  passwordPairReady,
} from '../../src/lib/passwordForm'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Pulled from the same table Settings renders, so a URL that moves moves here
 * too. Named lookups rather than indexes: the list is ordered for a settings
 * screen, and reordering it must not silently relabel a consent link.
 */
const TERMS_LINK = LEGAL_LINKS.find((link) => link.labelKey === 'legal.terms')!
const PRIVACY_LINK = LEGAL_LINKS.find((link) => link.labelKey === 'legal.privacy')!

export default function SignUp() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [accepted, setAccepted] = useState(false)
  const { data: session } = authClient.useSession()

  async function onSubmit() {
    setError(undefined)
    setLoading(true)
    /*
     * A guest signs out before registering rather than being linked.
     *
     * Better Auth's anonymous plugin can link, but not here: this project has
     * `requireEmailVerification: true` and `autoSignIn: false`, so `signUp.email`
     * returns no session at all and `onLinkAccount` would fire around a user
     * that has none. There is nothing to carry over anyway — a guest cannot
     * write — and the languages travel in the device draft, which is why the
     * next screen is `about-you` rather than `languages`.
     */
    if (shouldGateGuest(session?.user)) await authClient.signOut()
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

  /**
   * Typed twice and checked here, not on the server. A mistyped password on a
   * sign-up form is only discovered at the next sign-in, by which time the
   * account exists, the verification mail has been sent, and the only way back
   * in is the reset flow.
   */
  const issue = passwordIssueKey(password, confirmation)

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit =
    !loading && !!name && !!email && passwordPairReady(password, confirmation) && accepted

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
        returnKeyType="next"
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        placeholder={t('auth.passwordRule', { min: PASSWORD_MIN_LENGTH })}
      />
      <FormField
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void onSubmit()}
        label={t('auth.confirmPassword')}
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
        error={issue ? t(issue, { min: PASSWORD_MIN_LENGTH }) : error}
      />

      {/*
        Unticked by default and required, which is the whole point: a pre-ticked
        box is not consent, and several of the regimes this app ships under say
        so. Nothing here is recorded client-side — the server stamps acceptance
        when it creates the account, so the record cannot be forged by a client
        that skipped the screen.
      */}
      <Checkbox
        checked={accepted}
        onChange={setAccepted}
        accessibilityLabel={t('auth.acceptTermsLabel')}
      >
        <Text style={styles.terms}>
          {t('auth.acceptTerms')}{' '}
          <Text style={styles.link} onPress={() => void openExternal(TERMS_LINK.url)}>
            {t('legal.terms')}
          </Text>
          {t('auth.acceptTermsAnd')}
          <Text style={styles.link} onPress={() => void openExternal(PRIVACY_LINK.url)}>
            {t('legal.privacy')}
          </Text>
          .
        </Text>
      </Checkbox>

      <Button label={t('auth.signUp')} onPress={onSubmit} loading={loading} disabled={!canSubmit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.signIn')}
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: { ...font.title, color: colors.text, fontSize: 28, lineHeight: 36 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginBottom: spacing.sm,
    marginTop: -spacing.sm,
  },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  terms: { ...font.caption, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  footerText: { color: colors.textMuted, fontSize: 15 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
}))
