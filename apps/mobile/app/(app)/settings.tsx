import { ACCOUNT_DELETION_GRACE_DAYS } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { api, ApiRequestError } from '../../src/api/client'
import {
  useIsPro,
  useMe,
  useShareLocation,
  useStopSharingLocation,
  useUpdateProfile,
} from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { appVersion } from '../../src/hooks/useAppConfig'
import { confirmAlert, showAlert } from '../../src/lib/alert'
import { showToast } from '../../src/lib/toast'
import { API_URL } from '../../src/lib/apiUrl'
import { authClient } from '../../src/lib/auth-client'
import { authLandingHref } from '../../src/lib/authLanding'
import { FLAG_KEYS, readBoolFlag } from '../../src/lib/localFlags'
import { captureLocation, LOCATION_FAILURE_MESSAGE } from '../../src/lib/location'
import { colors, font, radius, spacing } from '../../src/lib/theme'

function Row({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string
  subtitle?: string
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  )
}

export default function SettingsScreen() {
  const me = useMe()
  const update = useUpdateProfile()
  const [busy, setBusy] = useState(false)

  const profile = me.data
  const isPro = useIsPro()
  const shareLocation = useShareLocation()
  const stopSharingLocation = useStopSharingLocation()

  /**
   * The switch is driven by whether the server holds a point, not by a local
   * flag — turning it on has to survive a declined OS prompt without the row
   * claiming otherwise, and the only thing that knows how that ended is what
   * came back.
   */
  const sharingLocation = profile?.location !== undefined

  async function toggleLocation(next: boolean): Promise<void> {
    if (!next) {
      stopSharingLocation.mutate()
      return
    }
    const fix = await captureLocation()
    if (!fix.ok) {
      void showAlert('Location unavailable', LOCATION_FAILURE_MESSAGE[fix.reason])
      return
    }
    shareLocation.mutate({ lat: fix.lat, lng: fix.lng })
  }

  /**
   * Export is a plain authenticated GET that returns a download. On web the
   * browser can just be pointed at it; on native there is no download folder
   * to point at, so the URL is opened externally and the OS decides.
   */
  async function exportData(): Promise<void> {
    const url = `${API_URL}/me/export`
    if (Platform.OS === 'web') {
      window.open(url, '_blank')
      return
    }
    await Linking.openURL(url)
  }

  async function confirmDelete(): Promise<void> {
    const yes = await confirmAlert({
      title: 'Delete your account',
      message: `Your account disappears immediately. Your data is kept for ${ACCOUNT_DELETION_GRACE_DAYS} days — signing back in within that window cancels the deletion. After that it is permanently removed.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!yes) return

    setBusy(true)
    try {
      await api.post('/me/delete', { confirm: 'DELETE' })
      await authClient.signOut()
      router.replace(authLandingHref(await readBoolFlag(FLAG_KEYS.introSeen)))
      // The grace period is the one thing worth repeating here: the dialog said
      // it before the account existed in this state, and this is the first
      // moment it is true.
      showToast(
        `Account deleted. Signing back in within ${ACCOUNT_DELETION_GRACE_DAYS} days cancels it.`,
      )
    } catch (error) {
      await showAlert(
        'Could not delete',
        error instanceof ApiRequestError ? error.message : 'Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  /**
   * Opens the carousel now, which is what the button says.
   *
   * It used to clear `introSeen` and raise an alert explaining that the intro
   * would play at the next sign-out. On web that alert never appeared —
   * react-native-web ships `Alert` as `static alert() {}` — so the button
   * looked dead. `(app)/intro` exists so there is something to push to:
   * `(auth)/intro` is unreachable while a session is held.
   */
  function replayIntro(): void {
    router.push('/(app)/intro')
  }
  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.section}>Privacy</Text>
      <Row
        title="Show me in Discover"
        subtitle="Turn this off and nobody will find you in Discover."
        value={profile?.settings.discoverable ?? true}
        onValueChange={(discoverable) =>
          update.mutate({ settings: { ...profile?.settings, discoverable } })
        }
      />
      <Row
        title="Incognito browsing"
        subtitle={isPro ? 'Look at profiles without leaving a trace.' : 'Pro feature.'}
        value={profile?.privacy.incognito ?? false}
        disabled={!isPro}
        onValueChange={(incognito) => update.mutate({ privacy: { incognito } })}
      />
      <Row
        title="Hide when I'm online"
        subtitle={
          isPro
            ? 'People will not see the green dot on your profile. You can still see theirs.'
            : 'Pro feature.'
        }
        value={profile?.privacy.hideOnlineStatus ?? false}
        disabled={!isPro}
        onValueChange={(hideOnlineStatus) => update.mutate({ privacy: { hideOnlineStatus } })}
      />
      <Row
        title="Share my approximate location"
        subtitle="Lets people nearby find you. Rounded to about a kilometre before it is stored — nobody is ever shown where you are, only roughly how far away."
        value={sharingLocation}
        disabled={shareLocation.isPending || stopSharingLocation.isPending}
        onValueChange={(next) => void toggleLocation(next)}
      />
      {sharingLocation ? (
        <Pressable
          onPress={() => void toggleLocation(true)}
          disabled={shareLocation.isPending}
          hitSlop={8}
          style={styles.subAction}
        >
          <Text style={styles.subActionLabel}>
            {shareLocation.isPending ? 'Updating…' : 'Update my location'}
          </Text>
        </Pressable>
      ) : null}
      <Row
        title="Notifications"
        subtitle="Messages and the streak reminder."
        value={profile?.settings.notifications ?? true}
        onValueChange={(notifications) =>
          update.mutate({ settings: { ...profile?.settings, notifications } })
        }
      />

      <Button
        label="Blocked people"
        variant="secondary"
        onPress={() => router.push('/(app)/blocked')}
        style={styles.button}
      />

      <Button
        label="Show intro again"
        variant="secondary"
        onPress={replayIntro}
        style={styles.button}
      />

      <Text style={styles.section}>Your data</Text>
      <Button
        label="Download my data"
        variant="secondary"
        onPress={exportData}
        style={styles.button}
      />

      <Text style={styles.section}>Account</Text>
      <Pressable onPress={() => void confirmDelete()} disabled={busy} style={styles.delete}>
        <Text style={styles.deleteText}>Delete my account</Text>
      </Pressable>
      <Text style={styles.deleteHint}>
        Signing back in within {ACCOUNT_DELETION_GRACE_DAYS} days cancels the deletion.
      </Text>

      {/*
        The two things a support reply always has to ask for. v1 showed both on
        its account page; v2 showed neither, so every "it is broken" message
        started with two extra round trips.
      */}
      <Text style={styles.build} selectable>
        LangX {appVersion()}
        {profile ? ` · ${profile._id}` : ''}
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  backRow: { paddingTop: spacing.md },
  subAction: { paddingBottom: spacing.sm },
  subActionLabel: { ...font.caption, color: colors.accent },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  section: {
    ...font.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDisabled: { opacity: 0.5 },
  rowText: { flex: 1 },
  rowTitle: { ...font.body, color: colors.text },
  rowSubtitle: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  button: { marginTop: spacing.sm },
  delete: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
  },
  deleteText: { ...font.body, color: colors.danger, fontWeight: '700' },
  build: {
    ...font.caption,
    color: colors.textMuted,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
  deleteHint: {
    ...font.caption,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
})
