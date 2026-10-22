import Feather from '@expo/vector-icons/Feather'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Platform, Text, TextInput, View } from 'react-native'
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '../../api/queries'
import {
  SettingsGroupV3,
  SettingsHeadingV3,
  SettingsScreenV3,
} from '../../components/settings/v3/SettingsKitV3'
import { SettingsLeadV3, SettingsNoteV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { confirmAlert, showAlert } from '../../lib/alert'
import { authClient } from '../../lib/auth-client'
import { relativeTime } from '../../lib/format'
import { sessionIsApp, sessionLabel } from '../../lib/sessionLabel'
import { awaitNewSession, sortSessions } from '../../lib/sessions'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/**
 * Approving a sign-in elsewhere, and where you are signed in, in the
 * redesign's look (`V-LinkDevice`), behind `flags.v3Home`.
 *
 * **Scanning a code still signs nothing in.** The claim-then-decide order,
 * the one message for every failure, the emptied field, the wait for the new
 * row and both sign-outs are `link-device.tsx`'s, word for word; see it for
 * why each is shaped the way it is. Only the drawing differs.
 */
export function LinkDeviceScreenV3() {
  useScreenInteractive()
  const params = useLocalSearchParams<{ user_code?: string; code?: string }>()
  const code = params.user_code ?? params.code
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  const [entered, setEntered] = useState(code ?? '')
  const [busy, setBusy] = useState(false)
  const [awaiting, setAwaiting] = useState(false)
  const [arrived, setArrived] = useState<string | null>(null)
  const { locale } = useLocale()

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

    // Claim the code first: Better Auth will not approve an unclaimed one.
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
      // One message for every failure, so a guessed code says nothing.
      await showAlert(t('linkDevice.failed'))
      return
    }
    showToast(t(approve ? 'linkDevice.approved' : 'linkDevice.denied'))
    // The code is spent either way.
    setEntered('')
    if (!approve) return
    // Ask again on the browser's rhythm until its new row shows up.
    const known = new Set((sessions.data ?? []).map((session) => session.token))
    setAwaiting(true)
    const fresh = await awaitNewSession(async () => (await sessions.refetch()).data, known)
    setAwaiting(false)
    setArrived(fresh?.token ?? null)
  }

  const empty = busy || entered.trim().length === 0

  return (
    <SettingsScreenV3 title={t('linkDevice.devicesTitle')} back="/(app)/settings">
      <SettingsLeadV3>{t('settings.linkDeviceBody')}</SettingsLeadV3>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {t('linkDevice.approveTitle')}
          </Text>
          <Text style={styles.cardBody}>{t('linkDevice.body')}</Text>
        </View>
        <View style={styles.codeRow}>
          {/* The web build has no camera to scan with; there the field is the whole row. */}
          {Platform.OS !== 'web' ? (
            <Button
              label={t('linkDevice.scan')}
              variant="ink"
              icon="maximize"
              onPress={() => router.push('/(app)/scan')}
              style={styles.scan}
            />
          ) : null}
          <TextInput
            value={entered}
            onChangeText={setEntered}
            placeholder={t('linkDevice.typeCodePlaceholder')}
            placeholderTextColor={v3.colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            // Five characters plus room for a hyphen and a slip of the thumb.
            maxLength={8}
            style={[styles.input, !entered && styles.inputEmpty]}
          />
        </View>

        {/* Named, not implied: the one attack is a code somebody else is holding. */}
        <SettingsNoteV3 icon="alert-triangle" hue="tangerine">
          {t('linkDevice.warning')}
        </SettingsNoteV3>

        <View style={styles.actions}>
          <Button
            label={t('linkDevice.approve')}
            loading={busy}
            disabled={empty}
            onPress={() => void decide(true)}
          />
          <Button
            label={t('linkDevice.deny')}
            variant="secondary"
            disabled={empty}
            onPress={() => void decide(false)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SettingsHeadingV3 title={t('linkDevice.whereSignedIn')} />
        {sessions.isPending ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <>
            <SettingsGroupV3>
              {awaiting ? (
                <View style={styles.device}>
                  <View style={styles.deviceIcon}>
                    <ActivityIndicator size="small" />
                  </View>
                  <Text style={[styles.deviceMeta, styles.deviceText]}>
                    {t('linkDevice.waitingForDevice')}
                  </Text>
                </View>
              ) : null}
              {sortSessions(sessions.data ?? []).map((session) => {
                const label = sessionLabel(session.userAgent) ?? t('linkDevice.unknownDevice')
                const isThis = session.token === currentToken
                return (
                  <View
                    key={session.token}
                    style={[styles.device, session.token === arrived && styles.deviceNew]}
                  >
                    <View style={[styles.deviceIcon, isThis && { backgroundColor: v3.hues.sky }]}>
                      <Feather
                        name={sessionIsApp(session.userAgent) ? 'smartphone' : 'globe'}
                        size={v3.icon.md}
                        color={isThis ? v3.colors.ink : v3.colors.fg}
                      />
                    </View>
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
                      <Button
                        label={t('linkDevice.signOutDevice')}
                        variant="danger"
                        size="small"
                        style={{ width: 'auto' }}
                        onPress={() => void signOutOne(session.token, label)}
                      />
                    )}
                  </View>
                )
              })}
            </SettingsGroupV3>
            {(sessions.data ?? []).length > 1 ? (
              <Button
                label={t('linkDevice.signOutOthers')}
                variant="danger"
                loading={revokeOthers.isPending}
                onPress={() => void signOutOthers()}
              />
            ) : null}
          </>
        )}
      </View>
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    padding: v3.space[16],
  },
  cardHead: { gap: v3.space[4] },
  cardTitle: { ...v3.type.headline, color: v3.colors.fg },
  cardBody: { ...v3.type.caption, color: v3.colors.muted },
  codeRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  scan: { width: 'auto' },
  input: {
    ...v3.type.headline,
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    color: v3.colors.fg,
    flex: 1,
    height: 56,
    letterSpacing: 2,
    minWidth: 0,
    paddingHorizontal: v3.space[16],
    paddingVertical: 0,
  },
  /*
   * The placeholder is a phrase, not a code: at the code's 22pt and wide
   * tracking it ran past the pill beside the Scan button on iOS ("Type the
   * cod…"). React Native cannot style a placeholder on its own, so the empty
   * field takes the button size, and the first character brings the code's.
   */
  inputEmpty: { ...v3.type.button, letterSpacing: 0 },
  actions: { gap: v3.space[8] },
  section: { gap: v3.space[10] },
  spinner: { marginTop: v3.space[16] },
  device: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 72,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  // The row an approval just added, tinted once so the proof is findable.
  deviceNew: { backgroundColor: v3.colors.echoTint },
  deviceIcon: {
    alignItems: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  deviceText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  deviceName: { ...v3.type.button, color: v3.colors.fg },
  deviceMeta: { ...v3.type.caption, color: v3.colors.muted },
}))
