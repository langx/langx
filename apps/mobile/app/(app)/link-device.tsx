import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { showAlert } from '../../src/lib/alert'
import { authClient } from '../../src/lib/auth-client'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/**
 * Approve a sign-in somewhere else.
 *
 * **Scanning a code does not sign anything in.** The scan — or the typed
 * code — only brings somebody here; this screen is where a person who is
 * already signed in says yes, on purpose, on a device they are holding. A
 * code read off a screen over somebody's shoulder gets an attacker exactly as
 * far as this page and no further, because they are not the one holding the
 * phone with the session.
 *
 * That is the whole security argument for the flow, so it is a screen with a
 * button rather than a silent redirect after a scan.
 */
export default function LinkDeviceScreen() {
  /*
   * Two names for one thing, and both are read. Better Auth's own
   * `verification_uri_complete` uses `user_code`; `code` is what a hand-typed
   * or older link may carry. Accepting either costs nothing and means a link
   * that looks right cannot land on an empty field.
   */
  const params = useLocalSearchParams<{ user_code?: string; code?: string }>()
  const code = params.user_code ?? params.code
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const [entered, setEntered] = useState(code ?? '')
  const [busy, setBusy] = useState(false)

  async function decide(approve: boolean): Promise<void> {
    const userCode = entered.trim().toUpperCase()
    if (!userCode) return
    setBusy(true)
    const { error } = approve
      ? await authClient.device.approve({ userCode })
      : await authClient.device.deny({ userCode })
    setBusy(false)

    if (error) {
      // Expired, already used, or never existed — all one message on purpose.
      // Telling them apart would say whether a guessed code was real.
      await showAlert(t('linkDevice.failed'))
      return
    }
    await showAlert(t(approve ? 'linkDevice.approved' : 'linkDevice.denied'))
    goBackTo('/(app)/settings')
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('linkDevice.title')} onBack={() => goBackTo('/(app)/settings')} />

      <Text style={styles.body}>{t('linkDevice.body')}</Text>

      <TextInput
        value={entered}
        onChangeText={setEntered}
        placeholder={t('linkDevice.placeholder')}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        style={styles.input}
      />

      {/*
        Named, not implied. "Approve" on its own asks somebody to confirm a
        thing they have not been told the shape of — and the one attack this
        flow has is a code somebody else is holding.
      */}
      <Text style={styles.warning}>{t('linkDevice.warning')}</Text>

      <View style={styles.actions}>
        <Button
          label={t('linkDevice.approve')}
          loading={busy}
          disabled={busy || entered.trim().length === 0}
          onPress={() => void decide(true)}
        />
        <Button
          label={t('linkDevice.deny')}
          variant="secondary"
          disabled={busy || entered.trim().length === 0}
          onPress={() => void decide(false)}
        />
      </View>

      <Text style={styles.hint} onPress={() => router.back()}>
        {t('linkDevice.hint')}
      </Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  body: { ...font.body, color: colors.textMuted, lineHeight: 23, marginTop: spacing.xl },
  input: {
    ...font.title,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 28,
    letterSpacing: 6,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  warning: { ...font.caption, color: colors.warning, lineHeight: 19, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  hint: { ...font.caption, color: colors.textFaint, marginTop: spacing.lg, textAlign: 'center' },
}))
