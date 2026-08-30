import Feather from '@expo/vector-icons/Feather'
import { ACCOUNT_DELETION_GRACE_DAYS } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import { api } from '../../src/api/client'
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
import { LEGAL_LINKS } from '../../src/lib/externalLinks'
import { FLAG_KEYS, readBoolFlag } from '../../src/lib/localFlags'
import { openExternal } from '../../src/lib/openExternal'
import { captureLocation, LOCATION_FAILURE_KEY } from '../../src/lib/location'
import { useLocalePreference, useT, type LocalePreference, type MessageKey } from '../../src/i18n'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@langx/shared'
import { unregisterPushToken } from '../../src/hooks/usePushRegistration'
import {
  makeStyles,
  useTheme,
  useThemePreference,
  THEME_PREFERENCES,
  type ThemePreference,
} from '../../src/lib/theme'

/**
 * `auto` first, then the eight in the order `SUPPORTED_LOCALES` declares them —
 * English, then the rest. Not sorted alphabetically: alphabetical order is
 * itself locale-dependent, so the list would reshuffle underneath someone
 * switching between two languages.
 */
const LOCALE_OPTIONS: readonly LocalePreference[] = ['auto', ...SUPPORTED_LOCALES]

/** Keys, not words: a module constant is fixed at import time. */
const THEME_LABELS: Record<ThemePreference, MessageKey> = {
  auto: 'theme.auto',
  light: 'theme.light',
  dark: 'theme.dark',
}

export default function SettingsScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { preference: locale, setPreference: setLocale, deviceLocale } = useLocalePreference()
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
      void showAlert(t('location.unavailableTitle'), t(LOCATION_FAILURE_KEY[fix.reason]))
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
      title: t('settings.deleteConfirmTitle'),
      message: t('settings.deleteConfirmBody', { days: ACCOUNT_DELETION_GRACE_DAYS }),
      confirmLabel: t('common.delete'),
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
      showToast(t('settings.deleted', { days: ACCOUNT_DELETION_GRACE_DAYS }))
    } catch (error) {
      // The API's message is English and written for a developer.
      void error
      await showAlert(t('settings.deleteFailed'), t('common.retry'))
    } finally {
      setBusy(false)
    }
  }

  async function signOut(): Promise<void> {
    const yes = await confirmAlert({
      title: t('settings.signOut'),
      message: t('settings.signOutConfirm'),
      confirmLabel: t('settings.signOut'),
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
      <ScreenHeader title={t('settings.title')} onBack={() => goBackTo('/(app)/me')} />

      <Text style={styles.section}>{t('settings.privacySection')}</Text>
      <Card inset>
        <ListRow
          title={t('settings.showInDiscover')}
          subtitle={t('settings.showInDiscoverBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.showInDiscover')}
              value={profile?.settings.discoverable ?? true}
              onValueChange={(discoverable) =>
                update.mutate({ settings: { ...profile?.settings, discoverable } })
              }
            />
          }
        />
        <ListRow
          title={t('settings.incognito')}
          subtitle={isPro ? t('settings.incognitoBody') : t('common.pro')}
          subtitleColor={isPro ? undefined : colors.pro}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.incognito')}
              disabled={!isPro}
              value={profile?.privacy.incognito ?? false}
              onValueChange={(incognito) => update.mutate({ privacy: { incognito } })}
            />
          }
        />
        {/* Free, unlike the two Pro rows around it: the streak this is drawn
            from is already on the public profile, so hiding the squares is a
            preference rather than a feature. */}
        <ListRow
          title={t('settings.activityMap')}
          subtitle={t('settings.activityMapBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.activityMap')}
              value={profile?.privacy.activityMapVisible ?? true}
              onValueChange={(activityMapVisible) =>
                update.mutate({ privacy: { activityMapVisible } })
              }
            />
          }
        />
        <ListRow
          title={t('settings.hideOnline')}
          subtitle={isPro ? t('settings.hideOnlineBody') : t('common.pro')}
          subtitleColor={isPro ? undefined : colors.pro}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.hideOnline')}
              disabled={!isPro}
              value={profile?.privacy.hideOnlineStatus ?? false}
              onValueChange={(hideOnlineStatus) => update.mutate({ privacy: { hideOnlineStatus } })}
            />
          }
        />
        <ListRow
          title={t('settings.shareLocation')}
          subtitle={t('settings.shareLocationBody')}
          last={!sharingLocation}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.shareLocation')}
              disabled={locationBusy}
              value={sharingLocation}
              onValueChange={(next) => void toggleLocation(next)}
            />
          }
        />
        {sharingLocation ? (
          <ListRow
            title={t('settings.updateLocation')}
            value={shareLocation.isPending ? t('settings.updating') : undefined}
            onPress={() => void toggleLocation(true)}
            last
          />
        ) : null}
      </Card>

      <Text style={styles.section}>{t('settings.notificationsSection')}</Text>
      <Card inset>
        <ListRow
          title={t('settings.pushTitle')}
          subtitle={t('settings.pushBody')}
          last
          accessory={
            <Toggle
              accessibilityLabel={t('settings.pushTitle')}
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
      {/*
        Device-level, like the theme, and for the same reason: the phone is
        what has a language setting. `auto` leads because it is what almost
        everyone wants and what nobody has to think about — the override exists
        for the people this app is full of, who read a language their phone is
        not set to.
      */}
      <Text style={styles.section}>{t('settings.languageSection')}</Text>
      <Card inset>
        {LOCALE_OPTIONS.map((option, index) => (
          <ListRow
            key={option}
            title={
              option === 'auto'
                ? t('settings.languageAuto', { name: LOCALE_NAMES[deviceLocale] })
                : LOCALE_NAMES[option]
            }
            last={index === LOCALE_OPTIONS.length - 1}
            onPress={() => setLocale(option)}
            accessory={
              locale === option ? (
                <Feather name="check" size={18} color={colors.primary} />
              ) : undefined
            }
          />
        ))}
      </Card>

      <Text style={styles.section}>{t('theme.section')}</Text>
      <View style={styles.theme}>
        <SegmentedControl<ThemePreference>
          accessibilityLabel={t('theme.label')}
          options={THEME_PREFERENCES.map((value) => ({ value, label: t(THEME_LABELS[value]) }))}
          selected={[preference]}
          onToggle={setPreference}
        />
      </View>

      {/*
        Two sections the stores and the law both expect to be reachable from
        inside the app, and one the project has always had: where it is made,
        who makes it, and how to reach them. Every row here leaves the app, so
        every row goes through the in-app browser.
      */}
      <Text style={styles.section}>{t('settings.legalSection')}</Text>
      <Card inset>
        {LEGAL_LINKS.map((link, index) => (
          <ListRow
            key={link.url}
            title={t(link.labelKey as never)}
            onPress={() => void openExternal(link.url)}
            last={index === LEGAL_LINKS.length - 1}
          />
        ))}
      </Card>

      <Text style={styles.section}>{t('settings.communitySection')}</Text>
      <Card inset>
        <ListRow
          title={t('kitchen.title')}
          subtitle={t('kitchen.intro')}
          last
          onPress={() => router.push('/(app)/kitchen')}
        />
      </Card>

      <Text style={styles.section}>{t('settings.accountSection')}</Text>
      <Card inset>
        <ListRow
          title={t('settings.blockedPeople')}
          onPress={() => router.push('/(app)/blocked')}
        />
        <ListRow title={t('settings.showIntro')} onPress={replayIntro} />
        <ListRow title={t('settings.exportData')} onPress={() => void exportData()} />
        <ListRow
          title={t('settings.deleteAccount')}
          subtitle={t('settings.deleteAccountBody', { days: ACCOUNT_DELETION_GRACE_DAYS })}
          destructive
          last
          onPress={busy ? undefined : () => void confirmDelete()}
        />
      </Card>

      <Button
        label={t('settings.signOut')}
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
        LangX {appVersion()} {t('settings.licence')}
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
    paddingStart: spacing.xs,
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
