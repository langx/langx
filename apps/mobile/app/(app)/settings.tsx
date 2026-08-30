import Feather from '@expo/vector-icons/Feather'
import { ACCOUNT_DELETION_GRACE_DAYS } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native'
import { api } from '../../src/api/client'
import {
  useIsPro,
  useMe,
  useShareLocation,
  useStopSharingLocation,
  useUpdateProfile,
} from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
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
import darkIcon from '../../assets/icons/dark.png'
import defaultIcon from '../../assets/icons/default.png'
import { openPaywall } from '../../src/lib/paywall'
import {
  APP_ICONS,
  currentAppIcon,
  isSupported,
  setAppIcon,
  type AppIcon,
} from '../../src/lib/appIcon'
import { LEGAL_LINKS } from '../../src/lib/externalLinks'
import { FLAG_KEYS, readBoolFlag } from '../../src/lib/localFlags'
import { openExternal } from '../../src/lib/openExternal'
import { captureLocation, LOCATION_FAILURE_KEY } from '../../src/lib/location'
import { useLocalePreference, useT, type LocalePreference, type MessageKey } from '../../src/i18n'
import {
  LOCALE_NAMES,
  NOTIFICATION_TYPES,
  notificationsAllowed,
  SUPPORTED_LOCALES,
} from '@langx/shared'
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
  const iconSupported = isSupported()
  const [appIcon, setAppIcon_] = useState<AppIcon>(() =>
    iconSupported ? currentAppIcon() : 'default',
  )

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

  /**
   * Pro only, and gated here rather than on the server: the icon never leaves
   * the device, so there is no request for the server to refuse. That makes
   * this a lock somebody could pick by editing the app — which is the same
   * bargain as every other purely local cosmetic, and not worth a round trip.
   */
  async function chooseIcon(next: AppIcon): Promise<void> {
    if (!isPro) {
      openPaywall()
      return
    }
    if (next === appIcon) return
    const changed = await setAppIcon(next)
    if (!changed) {
      void showAlert(t('settings.appIconFailed'), t('common.retry'))
      return
    }
    setAppIcon_(next)
    showToast(t('settings.appIconChanged'))
  }

  async function toggleLocation(next: boolean): Promise<void> {
    if (!next) {
      stopSharingLocation.mutate()
      return
    }
    const fix = await captureLocation()
    if (!fix.ok) {
      /**
       * A refusal is not an error to report, it is a switch somewhere else.
       * iOS never asks twice, and Android stops asking after the second no, so
       * an alert that says "denied" leaves someone holding a toggle that will
       * not move and no idea why. Say where the switch is, and offer to open
       * the page it is on.
       */
      if (fix.reason === 'denied') {
        const open = await confirmAlert({
          title: t('location.deniedTitle'),
          message: t(
            Platform.OS === 'ios' ? 'location.deniedBodyIos' : 'location.deniedBodyAndroid',
          ),
          confirmLabel: t('location.openSettings'),
        })
        if (open) await Linking.openSettings()
        return
      }
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
      <View>
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
          subtitle={t('settings.incognitoBody')}
          accessory={
            <View style={styles.gated}>
              {isPro ? null : <Text style={styles.proTag}>PRO</Text>}
              <Toggle
                accessibilityLabel={t('settings.incognito')}
                disabled={!isPro}
                value={profile?.privacy.incognito ?? false}
                onValueChange={(incognito) => update.mutate({ privacy: { incognito } })}
              />
            </View>
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
        {/* The numbers above the map — streak, corrections, tokens, the week's
            chart — travel together, because hiding the chart and leaving the
            counts would be a setting that does not do what it says. */}
        <ListRow
          title={t('settings.showStats')}
          subtitle={t('settings.showStatsBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.showStats')}
              value={profile?.privacy.statsVisible ?? true}
              onValueChange={(statsVisible) => update.mutate({ privacy: { statsVisible } })}
            />
          }
        />
        <ListRow
          title={t('settings.hideOnline')}
          subtitle={t('settings.hideOnlineBody')}
          accessory={
            <View style={styles.gated}>
              {isPro ? null : <Text style={styles.proTag}>PRO</Text>}
              <Toggle
                accessibilityLabel={t('settings.hideOnline')}
                disabled={!isPro}
                value={profile?.privacy.hideOnlineStatus ?? false}
                onValueChange={(hideOnlineStatus) =>
                  update.mutate({ privacy: { hideOnlineStatus } })
                }
              />
            </View>
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
      </View>

      {/*
        Four kinds, one switch each. It was one switch for everything, which
        meant that somebody who did not want a nudge about their streak had to
        turn off the message they were waiting for as well.

        It was briefly two switches per kind, push and email. The email column
        never sent anything — nothing in the app sends mail except verification
        and password reset — so six of those eight switches did nothing, and a
        choice that changes nothing is worse than no choice at all.

        Promotions default to off; consent is given, not withdrawn.
      */}
      <Text style={styles.section}>{t('settings.notificationsSection')}</Text>
      <View>
        {NOTIFICATION_TYPES.map((type, index) => (
          <ListRow
            key={type}
            title={t(`notifications.${type}` as MessageKey)}
            subtitle={t(`notifications.${type}Body` as MessageKey)}
            last={index === NOTIFICATION_TYPES.length - 1}
            accessory={
              <Toggle
                accessibilityLabel={t(`notifications.${type}` as MessageKey)}
                value={notificationsAllowed(profile?.settings.notifications, type)}
                onValueChange={(next) =>
                  update.mutate({ settings: { notifications: { [type]: next } } })
                }
              />
            }
          />
        ))}
      </View>

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
      <View>
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
                <Feather name="check" size={18} color={colors.accent} />
              ) : undefined
            }
          />
        ))}
      </View>

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
      {/*
        Only where there is a home screen to put it on: the web build and Expo
        Go have neither the module nor anywhere for the icon to go, and a row
        that cannot work is worse than one that is not there.
      */}
      {iconSupported ? (
        <>
          <Text style={styles.section}>{t('settings.appIconSection')}</Text>
          <View>
            <ListRow
              title={t('settings.appIcon')}
              subtitle={t('settings.appIconBody')}
              last
              accessory={
                <View style={styles.gated}>
                  {isPro ? null : <Text style={styles.proTag}>PRO</Text>}
                  {APP_ICONS.map((name) => (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityLabel={t(`settings.appIcon_${name}` as MessageKey)}
                      accessibilityState={{ selected: appIcon === name }}
                      onPress={() => void chooseIcon(name)}
                      style={[styles.iconTile, appIcon === name && styles.iconTileChosen]}
                    >
                      <Image source={ICON_PREVIEWS[name]} style={styles.iconImage} />
                    </Pressable>
                  ))}
                </View>
              }
            />
          </View>
        </>
      ) : null}

      <Text style={styles.section}>{t('settings.legalSection')}</Text>
      <View>
        {LEGAL_LINKS.map((link, index) => (
          <ListRow
            key={link.url}
            title={t(link.labelKey as never)}
            onPress={() => void openExternal(link.url)}
            last={index === LEGAL_LINKS.length - 1}
          />
        ))}
      </View>

      <Text style={styles.section}>{t('settings.communitySection')}</Text>
      <View>
        <ListRow
          title={t('kitchen.title')}
          subtitle={t('kitchen.intro')}
          last
          onPress={() => router.push('/(app)/kitchen')}
        />
      </View>

      <Text style={styles.section}>{t('settings.accountSection')}</Text>
      <View>
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
      </View>

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

/**
 * Imported statically, because Metro resolves an image at build time: a path
 * assembled at runtime resolves to nothing.
 */
const ICON_PREVIEWS = { default: defaultIcon, dark: darkIcon }

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  /** A gated row's right side: the neutral PRO tag, then the control it gates. */
  gated: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  /** filters.tsx's neutral PRO pill — v3 stopped colouring the tag purple. */
  proTag: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  iconTile: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 2,
    overflow: 'hidden',
  },
  iconTileChosen: { borderColor: colors.accent },
  iconImage: { height: 44, width: 44 },
  /** v3's section kicker: 13/600, faint, flush with the rows it introduces. */
  section: {
    ...font.label,
    color: colors.textFaint,
    marginTop: spacing.xl,
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
