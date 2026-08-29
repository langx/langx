import { ACCOUNT_DELETION_GRACE_DAYS } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import { api, ApiRequestError } from '../../src/api/client'
import {
  useIsPro,
  useMe,
  useShareLocation,
  useStopSharingLocation,
  useUpdateProfile,
} from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { ListRow } from '../../src/components/ui/ListRow'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { Toggle } from '../../src/components/ui/Toggle'
import { goBackTo } from '../../src/lib/navigation'
import { appVersion } from '../../src/hooks/useAppConfig'
import { confirmAlert, showAlert } from '../../src/lib/alert'
import { showToast } from '../../src/lib/toast'
import { API_URL } from '../../src/lib/apiUrl'
import { authClient } from '../../src/lib/auth-client'
import { authLandingHref } from '../../src/lib/authLanding'
import { FLAG_KEYS, readBoolFlag } from '../../src/lib/localFlags'
import { captureLocation, LOCATION_FAILURE_MESSAGE } from '../../src/lib/location'
import { unregisterPushToken } from '../../src/hooks/usePushRegistration'
import {
  makeStyles,
  useTheme,
  useThemePreference,
  THEME_PREFERENCES,
  type ThemePreference,
} from '../../src/lib/theme'

const THEME_OPTIONS = THEME_PREFERENCES.map((value) => ({
  value,
  label: value === 'auto' ? 'Auto' : value === 'light' ? 'Light' : 'Dark',
}))

export default function SettingsScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const { preference, setPreference } = useThemePreference()

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
  const locationBusy = shareLocation.isPending || stopSharingLocation.isPending

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

  async function signOut(): Promise<void> {
    const yes = await confirmAlert({
      title: 'Sign out',
      message: 'You will need to sign in again on this device.',
      confirmLabel: 'Sign out',
    })
    if (!yes) return
    // Before the session goes: unregistering needs one.
    await unregisterPushToken()
    await authClient.signOut()
    router.replace(authLandingHref(await readBoolFlag(FLAG_KEYS.introSeen)))
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
      <ScreenHeader title="Settings" onBack={() => goBackTo('/(app)/me')} />

      <Text style={styles.section}>Privacy</Text>
      <Card inset>
        <ListRow
          title="Show me in Discover"
          subtitle="Turn this off and nobody will find you in Discover."
          accessory={
            <Toggle
              accessibilityLabel="Show me in Discover"
              value={profile?.settings.discoverable ?? true}
              onValueChange={(discoverable) =>
                update.mutate({ settings: { ...profile?.settings, discoverable } })
              }
            />
          }
        />
        <ListRow
          title="Browse incognito"
          subtitle={isPro ? "You won't appear in their viewers." : '✦ Pro'}
          subtitleColor={isPro ? undefined : colors.pro}
          accessory={
            <Toggle
              accessibilityLabel="Browse incognito"
              disabled={!isPro}
              value={profile?.privacy.incognito ?? false}
              onValueChange={(incognito) => update.mutate({ privacy: { incognito } })}
            />
          }
        />
        <ListRow
          title="Hide when I'm online"
          subtitle={isPro ? 'You can still see theirs.' : '✦ Pro'}
          subtitleColor={isPro ? undefined : colors.pro}
          accessory={
            <Toggle
              accessibilityLabel="Hide when I'm online"
              disabled={!isPro}
              value={profile?.privacy.hideOnlineStatus ?? false}
              onValueChange={(hideOnlineStatus) => update.mutate({ privacy: { hideOnlineStatus } })}
            />
          }
        />
        <ListRow
          title="Share rough location"
          subtitle="Others see a distance bucket, never a point."
          last={!sharingLocation}
          accessory={
            <Toggle
              accessibilityLabel="Share rough location"
              disabled={locationBusy}
              value={sharingLocation}
              onValueChange={(next) => void toggleLocation(next)}
            />
          }
        />
        {sharingLocation ? (
          <ListRow
            title="Update my location"
            value={shareLocation.isPending ? 'Updating…' : undefined}
            onPress={() => void toggleLocation(true)}
            last
          />
        ) : null}
      </Card>

      <Text style={styles.section}>Notifications</Text>
      <Card inset>
        <ListRow
          title="Messages and reminders"
          subtitle="New messages, and one streak reminder a day."
          last
          accessory={
            <Toggle
              accessibilityLabel="Messages and reminders"
              value={profile?.settings.notifications ?? true}
              onValueChange={(notifications) =>
                update.mutate({ settings: { ...profile?.settings, notifications } })
              }
            />
          }
        />
      </Card>

      {/*
        A device preference rather than an account one, so it is deliberately
        not in `profile.settings` — see `lib/theme/ThemeProvider`.
      */}
      <Text style={styles.section}>Appearance</Text>
      <View style={styles.theme}>
        <SegmentedControl<ThemePreference>
          accessibilityLabel="Theme"
          options={THEME_OPTIONS}
          selected={[preference]}
          onToggle={setPreference}
        />
      </View>

      <Text style={styles.section}>Account</Text>
      <Card inset>
        <ListRow title="Blocked people" onPress={() => router.push('/(app)/blocked')} />
        <ListRow title="Show intro again" onPress={replayIntro} />
        <ListRow title="Export my data" onPress={() => void exportData()} />
        <ListRow
          title="Delete account"
          subtitle={`Signing back in within ${ACCOUNT_DELETION_GRACE_DAYS} days cancels it.`}
          destructive
          last
          onPress={busy ? undefined : () => void confirmDelete()}
        />
      </Card>

      <Button
        label="Sign out"
        variant="secondary"
        onPress={() => void signOut()}
        style={styles.signOut}
      />

      {/*
        The two things a support reply always has to ask for. v1 showed both on
        its account page; v2 showed neither, so every "it is broken" message
        started with two extra round trips.
      */}
      <Text style={styles.build} selectable>
        LangX {appVersion()} · BSD-3 · open source
        {profile ? `\n${profile._id}` : ''}
      </Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  section: {
    ...font.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    paddingLeft: spacing.xs,
  },
  theme: { paddingVertical: spacing.xs },
  signOut: { marginTop: spacing.xl },
  build: {
    ...font.caption,
    color: colors.textFaint,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
}))
