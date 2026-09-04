import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { confirmAlert, showAlert } from '../../src/lib/alert'
import { authClient } from '../../src/lib/auth-client'
import { relativeTime } from '../../src/lib/format'
import { goBackTo } from '../../src/lib/navigation'
import { sessionLabel } from '../../src/lib/sessionLabel'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'
import { useLocale, useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

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
  useScreenInteractive()
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
  const { locale } = useLocale()

  /*
   * Which row is the phone in your hand. Better Auth's session hook holds the
   * same token the list returns, so the comparison needs no extra request.
   */
  const currentToken = authClient.useSession().data?.session.token
  const sessions = useSessions()
  const revokeOne = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()

  async function signOutOne(token: string, label: string): Promise<void> {
    const yes = await confirmAlert({
      title: t('linkDevice.signOutDevice'),
      message: label,
      confirmLabel: t('linkDevice.signOutDevice'),
      destructive: true,
    })
    if (!yes) return
    revokeOne.mutate(token, {
      onSuccess: () => showToast(t('linkDevice.signedOutDevice')),
      onError: () => showToast(t('common.retry')),
    })
  }

  async function signOutOthers(): Promise<void> {
    const yes = await confirmAlert({
      title: t('linkDevice.signOutOthers'),
      confirmLabel: t('linkDevice.signOutOthers'),
      destructive: true,
    })
    if (!yes) return
    revokeOthers.mutate(undefined, {
      onSuccess: () => showToast(t('linkDevice.signedOutDevice')),
      onError: () => showToast(t('common.retry')),
    })
  }

  async function decide(approve: boolean): Promise<void> {
    const userCode = entered.trim().toUpperCase()
    if (!userCode) return
    setBusy(true)

    /*
     * Claim the code first. Better Auth will not approve a code that no
     * account has taken ownership of, and taking ownership is what this GET
     * does — approving straight away answered DEVICE_CODE_NOT_CLAIMED, which
     * this screen showed as "that code is no longer valid". Every approval
     * from a phone failed this way, and the message made it look like the code
     * had expired rather than like a step being missing.
     */
    const claimed = await authClient.device({ query: { user_code: userCode } })
    if (claimed.error || claimed.data?.status !== 'pending') {
      setBusy(false)
      await showAlert(t('linkDevice.failed'))
      return
    }

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
    // Not back to settings on an approval: the device list below is where the
    // laptop now appears, which is the only proof the approval landed.
    if (!approve) goBackTo('/(app)/settings')
    else void sessions.refetch()
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

      {/*
        The other half of the same question. Approving a sign-in and seeing
        where you are already signed in are one concern — "who is in this
        account" — and the list is also the only feedback that an approval
        worked, since the device it signed in is somewhere else.
      */}
      <Text style={styles.sectionTitle}>{t('linkDevice.devices')}</Text>
      {sessions.isPending ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <View>
          {(sessions.data ?? []).map((session) => {
            const label = sessionLabel(session.userAgent) ?? t('linkDevice.unknownDevice')
            const isThis = session.token === currentToken
            return (
              <View key={session.token} style={styles.deviceRow}>
                <View style={styles.deviceText}>
                  <Text style={styles.deviceName}>
                    {label}
                    {isThis ? ` · ${t('linkDevice.thisDevice')}` : ''}
                  </Text>
                  <Text style={styles.deviceMeta}>
                    {[
                      relativeTime(new Date(session.createdAt).toISOString(), { t, locale }),
                      session.ipAddress,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {isThis ? null : (
                  <Pressable
                    onPress={() => void signOutOne(session.token, label)}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={styles.signOut}>{t('linkDevice.signOutDevice')}</Text>
                  </Pressable>
                )}
              </View>
            )
          })}
          {(sessions.data ?? []).length > 1 ? (
            <Button
              label={t('linkDevice.signOutOthers')}
              variant="secondary"
              loading={revokeOthers.isPending}
              onPress={() => void signOutOthers()}
              style={styles.signOutAll}
            />
          ) : null}
        </View>
      )}
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
  sectionTitle: { ...font.label, color: colors.text, marginTop: spacing.xl },
  spinner: { marginTop: spacing.lg },
  deviceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  deviceText: { flex: 1, gap: 2, minWidth: 0 },
  deviceName: { ...font.body, color: colors.text },
  deviceMeta: { ...font.caption, color: colors.textMuted },
  signOut: { ...font.caption, color: colors.danger },
  signOutAll: { marginTop: spacing.lg },
}))
