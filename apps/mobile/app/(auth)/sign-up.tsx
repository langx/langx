import { MINIMUM_AGE, passwordTooShort } from '@langx/shared'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { makeStyles } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Checkbox } from '../../src/components/ui/Checkbox'
import { LEGAL_LINKS } from '../../src/lib/externalLinks'
import { openExternal } from '../../src/lib/openExternal'
import { FormField } from '../../src/components/ui/FormField'
import { SocialAuthButtons } from '../../src/components/SocialAuthButtons'
import { recordSignupSubmitted } from '../../src/lib/signupOrigin'
import { useGuestBrowse } from '../../src/hooks/useGuestBrowse'
import { shouldGateGuest } from '../../src/lib/guestGate'
import { authClient } from '../../src/lib/auth-client'
import { useIsOnline } from '../../src/hooks/useIsOnline'
import { authErrorKey } from '../../src/lib/errors'
import { goBackTo } from '../../src/lib/navigation'
import { PASSWORD_MIN_LENGTH, passwordIssueKey } from '../../src/lib/passwordForm'
import { nameFromEmail } from '../../src/lib/seedDisplayName'
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
  const { start: browse } = useGuestBrowse()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  // Better Auth has no code for "nobody answered", so the form would have
  // said "Sign in failed" to somebody whose request never left the phone.
  const online = useIsOnline()
  const [accepted, setAccepted] = useState(false)
  const { data: session } = authClient.useSession()
  const fromGuest = shouldGateGuest(session?.user)

  async function onSubmit() {
    setError(undefined)
    setLoading(true)
    // Before the guest is signed out below, which is what makes this readable
    // at the end of the wizard.
    recordSignupSubmitted('email', fromGuest)
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
    if (fromGuest) await authClient.signOut()
    const { error: signUpError } = await authClient.signUp.email({
      // v3 asks for no name at sign-up; Better Auth still wants one, so it is
      // guessed from the address and offered back on the about-you step.
      name: nameFromEmail(email),
      email,
      password,
      // No `callbackURL`: the API builds the mailed link itself, as
      // `app/verify-email.tsx` explains, so anything passed here is ignored.
    })
    setLoading(false)

    if (signUpError) {
      setError(t(authErrorKey(signUpError) ?? (online ? 'errors.signUpFailed' : 'common.offline')))
      return
    }
    router.replace({ pathname: '/(auth)/check-email', params: { email } })
  }

  /**
   * Typed once. The field's own Show toggle is how a typo gets caught now, so
   * the only live check left is the length — still made here rather than at
   * submit, because "too short" arriving after a round trip has nothing left
   * to point at.
   */
  const issue = passwordIssueKey(password, '')

  // The same condition the button uses, so Enter can never submit a
  // form the button refuses — nor fire twice while one is in flight.
  const canSubmit = !loading && !!email && !passwordTooShort(password) && accepted

  return (
    <Screen scroll style={styles.form}>
      {/* Back only: the 30px title below is the screen's title. */}
      <ScreenHeader onBack={() => goBackTo('/(auth)/welcome')} />

      <View>
        <Text style={styles.title}>{t('auth.createAccount')}</Text>
        <Text style={styles.subtitle}>{t('auth.minimumAge', { age: MINIMUM_AGE })}</Text>
      </View>

      {/*
        Google and Apple first: they are the only paths that never leave for an
        inbox, and the divider under them is what makes the email form below
        the alternative rather than the default.
      */}
      <SocialAuthButtons
        divider="below"
        onStart={(method) => recordSignupSubmitted(method, fromGuest)}
      />

      <View style={styles.fields}>
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
        <View>
          <FormField
            returnKeyType="go"
            onSubmitEditing={() => canSubmit && void onSubmit()}
            placeholder={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
            error={issue ? t(issue, { min: PASSWORD_MIN_LENGTH }) : error}
          />
          {/* The rule, until it is broken — then the field's own error says so. */}
          {issue ? null : (
            <Text style={styles.hint}>{t('auth.passwordRule', { min: PASSWORD_MIN_LENGTH })}</Text>
          )}
        </View>

        {/*
          Unticked by default and required, which is the whole point: a pre-ticked
          box is not consent, and several of the regimes this app ships under say
          so. Nothing here is recorded client-side — the server stamps acceptance
          when it creates the account, so the record cannot be forged by a client
          that skipped the screen.
        */}
        <View style={styles.terms}>
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            accessibilityLabel={t('auth.acceptTermsLabel')}
          >
            <Text style={styles.termsText}>
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
        </View>
      </View>

      <Button label={t('auth.signUp')} onPress={onSubmit} loading={loading} disabled={!canSubmit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.signIn')}
        </Link>
        <Text style={styles.footerText}> · </Text>
        <Text style={styles.link} onPress={() => void browse()}>
          {t('auth.justLooking')}
        </Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  /**
   * Only the gap. `Screen` owns the background, the safe-area inset, the
   * horizontal padding and the scrolling — which is the point: this screen
   * used to centre a form taller than the phone inside a bare
   * `KeyboardAvoidingView`, so the overflow went equally out of the top and
   * the bottom and put the title under the Dynamic Island, with no scroll to
   * bring it back. 22 between blocks, as the prototype stacks the auth screens.
   */
  form: { gap: 22 },
  title: { ...font.title, color: colors.text, lineHeight: 36 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
  fields: { gap: 14 },
  // Sits under the pill at the pill's own text inset.
  hint: { color: colors.textFaint, fontSize: 13, paddingHorizontal: 20, paddingTop: spacing.sm },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  terms: { paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  termsText: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  footerText: { color: colors.textMuted, fontSize: 15 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
}))
