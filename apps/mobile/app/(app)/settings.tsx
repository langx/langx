import { ACCOUNT_DELETION_GRACE_DAYS, TIER_BADGES, TIER_NAMES, tierUnlocking } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native'
import { api } from '../../src/api/client'
import {
  useEffectiveTier,
  useHasFeature,
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
import { relativeTime } from '../../src/lib/format'
import { manageSubscriptionUrl } from '../../src/lib/manageSubscription'
import { openExternal } from '../../src/lib/openExternal'
import { useTips } from '../../src/hooks/useTips'
import {
  APP_ICONS,
  currentAppIcon,
  isSupported,
  setAppIcon,
  type AppIcon,
} from '../../src/lib/appIcon'
import { FLAG_KEYS, readBoolFlag } from '../../src/lib/localFlags'
import { isAnalyticsAvailable } from '../../src/lib/analytics'
import { useAnalyticsPreference } from '../../src/hooks/useAnalyticsPreference'
import { captureLocation, LOCATION_FAILURE_KEY } from '../../src/lib/location'
import { useLocale, useLocalePreference, useT, type MessageKey } from '../../src/i18n'
import {
  LOCALE_NAMES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  resolveNotificationPrefs,
} from '@langx/shared'
import { unregisterPushToken } from '../../src/hooks/usePushRegistration'
import {
  makeStyles,
  useThemePreference,
  THEME_PREFERENCES,
  type ThemePreference,
} from '../../src/lib/theme'

/** Keys, not words: a module constant is fixed at import time. */
const THEME_LABELS: Record<ThemePreference, MessageKey> = {
  auto: 'theme.auto',
  light: 'theme.light',
  dark: 'theme.dark',
}

export default function SettingsScreen() {
  const styles = useStyles()
  const t = useT()
  const { preference: locale, deviceLocale } = useLocalePreference()
  // The *resolved* locale, not the preference: `auto` is not something
  // `toLocaleDateString` can read.
  const { locale: activeLocale } = useLocale()
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
  /**
   * The eight cells, with every stored shape already resolved — an account
   * from v1 carries one boolean for all of this, and a screen drawing switches
   * off `profile.settings.notifications` directly would read that as "off".
   */
  const notifications = resolveNotificationPrefs(profile?.settings.notifications)
  /**
   * An email switch on an unverified address is a switch that sends nothing,
   * which is the exact fault that had the email column removed the first time.
   * Disabled with a reason under it rather than hidden: somebody who verifies
   * their address later should find the control where they last saw it.
   */
  const emailVerified = authClient.useSession().data?.user.emailVerified === true
  /*
   * The incognito row asks about *incognito*, not "any paid plan". They agreed
   * while every privacy flag was Fluent's; now that this one is Polyglot's,
   * `useIsPro()` here would offer a Fluent subscriber a toggle the server
   * refuses — a switch that flips and does nothing.
   */
  const canIncognito = useHasFeature('incognito')
  const tier = useEffectiveTier()
  const entitlement = profile?.entitlement
  /**
   * "Renews on" and "Ends on" are the same date meaning opposite things, which
   * is why `willRenew` had to become truthful before this could be drawn. A
   * paid plan with no expiry is a lifetime — there is no date to show and
   * nothing to renew.
   */
  const renewal =
    !entitlement || tier === 'free'
      ? null
      : !entitlement.expiresAt
        ? { label: t('settings.plan'), value: t('settings.lifetime') }
        : {
            label: entitlement.willRenew ? t('settings.renewsOn') : t('settings.endsOn'),
            value: new Date(entitlement.expiresAt).toLocaleDateString(activeLocale),
          }
  const manageUrl = tier === 'free' ? null : manageSubscriptionUrl(null, Platform.OS)
  const tips = useTips()
  const analytics = useAnalyticsPreference()
  // No row without a key: a switch that changes nothing is worse than none,
  // and a self-hosted build with no PostHog project has nothing to switch.
  const analyticsRow = isAnalyticsAvailable()
  // Each tag names the plan that unlocks *that* row. Incognito reads the real
  // table through `tierUnlocking`, so moving it between tiers moves the tag.
  // The app icon is not in `PLAN_LIMITS` at all — it is a local cosmetic gated
  // on "any paid plan" — so it takes the cheapest paid badge instead.
  const incognitoBadge = TIER_BADGES[tierUnlocking('incognito') ?? 'free']
  const paidBadge = TIER_BADGES.pro
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
      <ScreenHeader title={t('settings.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      {/*
        First, above Privacy: on a paid product this is what people open
        Settings for, and it was the one thing Settings could not tell them.
        Cancelling meant finding a sentence on the paywall.
      */}
      <Text style={styles.section}>{t('settings.subscriptionSection')}</Text>
      <View>
        <ListRow title={t('settings.currentPlan')} value={TIER_NAMES[tier]} />
        {renewal ? <ListRow title={renewal.label} value={renewal.value} /> : null}
        {tier === 'pro_plus' ? null : (
          <ListRow
            title={t('settings.upgrade')}
            onPress={() => openPaywall(undefined, '/(app)/settings')}
          />
        )}
        {/*
          No row at all where there is nowhere to send them, rather than a
          disabled one — the same rule the app-icon section states below.
        */}
        {manageUrl ? (
          <ListRow
            title={t('settings.manageSubscription')}
            last
            onPress={() => void openExternal(manageUrl)}
          />
        ) : null}
      </View>

      <Text style={styles.section}>{t('settings.privacySection')}</Text>
      <View>
        {/*
          Here rather than on Me: approving a sign-in is account plumbing, not
          something anybody does often, and it sits with the other things that
          decide who can reach the account.
        */}
        <ListRow
          title={t('linkDevice.title')}
          subtitle={t('settings.linkDeviceBody')}
          onPress={() => router.push('/(app)/link-device')}
        />
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
              {canIncognito ? null : <Text style={styles.proTag}>{incognitoBadge}</Text>}
              <Toggle
                accessibilityLabel={t('settings.incognito')}
                disabled={!canIncognito}
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
            <Toggle
              accessibilityLabel={t('settings.hideOnline')}
              value={profile?.privacy.hideOnlineStatus ?? false}
              onValueChange={(hideOnlineStatus) => update.mutate({ privacy: { hideOnlineStatus } })}
            />
          }
        />
        {/*
          Not a Pro feature, unlike the two above — a preference, like the
          activity map. It is here rather than beside "share location" because
          it is about what other people see, not about what is collected.
        */}
        <ListRow
          title={t('settings.hideCity')}
          subtitle={t('settings.hideCityBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.hideCity')}
              value={profile?.privacy.hideCity ?? false}
              onValueChange={(hideCity) => update.mutate({ privacy: { hideCity } })}
            />
          }
        />
        <ListRow
          title={t('settings.shareLocation')}
          subtitle={t('settings.shareLocationBody')}
          last={!sharingLocation && !analyticsRow}
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
            /* `locationUpdatedAt` has been stored and returned to its owner
               since sharing shipped, and rendered nowhere — which is what the
               field's own doc comment asks for: sharing a location should not
               be a thing you turned on once and can never see the state of. */
            subtitle={
              profile?.locationUpdatedAt
                ? t('settings.locationUpdated', {
                    time: relativeTime(profile.locationUpdatedAt, { t, locale: activeLocale }),
                  })
                : undefined
            }
            value={shareLocation.isPending ? t('settings.updating') : undefined}
            onPress={() => void toggleLocation(true)}
            last={!analyticsRow}
          />
        ) : null}
        {/*
          Last in Privacy, because it is the one row here about what leaves the
          device for *us* rather than for other users. Device-level, like the
          theme: the refusal belongs to the phone, and is honoured before there
          is an account to attach it to. What is sent, and what never is, is in
          `lib/analyticsEvents.ts`.
        */}
        {analyticsRow ? (
          <ListRow
            title={t('settings.shareUsage')}
            subtitle={t('settings.shareUsageBody')}
            last
            accessory={
              <Toggle
                accessibilityLabel={t('settings.shareUsage')}
                value={analytics.enabled}
                onValueChange={(next) => void analytics.setEnabled(next)}
              />
            }
          />
        ) : null}
      </View>

      {/*
        Four kinds, two channels each. It was one switch for everything, which
        meant that somebody who did not want a nudge about their streak had to
        turn off the message they were waiting for as well.

        The channel axis was here once before and was taken out again, because
        nothing sent mail except verification and password reset: six of the
        eight switches did nothing, and a choice that changes nothing is worse
        than no choice at all. It is back because every cell now reaches a
        sender, and the email half is disabled until an address is verified —
        that rule, not the axis, is what keeps a dead switch off this screen.

        Two rows per kind rather than two toggles in one row: `ListRow` has one
        accessory slot, and two unlabelled switches side by side are a coin
        flip for anyone reading the screen aloud.

        Promotions default to off on both; consent is given, not withdrawn.
      */}
      <Text style={styles.section}>{t('settings.notificationsSection')}</Text>
      {NOTIFICATION_TYPES.map((type) => (
        <View key={type}>
          <Text style={styles.kindTitle}>{t(`notifications.${type}` as MessageKey)}</Text>
          <Text style={styles.kindBody}>{t(`notifications.${type}Body` as MessageKey)}</Text>
          <View>
            {NOTIFICATION_CHANNELS.map((channel, index) => {
              const disabled = channel === 'email' && !emailVerified
              return (
                <ListRow
                  key={channel}
                  title={t(`notifications.channel.${channel}` as MessageKey)}
                  subtitle={disabled ? t('notifications.emailUnverified') : undefined}
                  last={index === NOTIFICATION_CHANNELS.length - 1}
                  accessory={
                    <Toggle
                      accessibilityLabel={`${t(`notifications.${type}` as MessageKey)} — ${t(
                        `notifications.channel.${channel}` as MessageKey,
                      )}`}
                      disabled={disabled}
                      value={notifications[type][channel]}
                      onValueChange={(next) =>
                        update.mutate({
                          settings: { notifications: { [type]: { [channel]: next } } },
                        })
                      }
                    />
                  }
                />
              )
            })}
          </View>
        </View>
      ))}

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
        {/*
          One row showing the current value, not nine rows showing every value.
          Stacked, the list read as nine settings rather than one with nine
          options, and pushed Theme, Legal and Account below the fold.
        */}
        <ListRow
          title={t('settings.appLanguage')}
          value={
            locale === 'auto'
              ? t('settings.languageAuto', { name: LOCALE_NAMES[deviceLocale] })
              : LOCALE_NAMES[locale]
          }
          last
          onPress={() => router.push('/(app)/app-language')}
        />
      </View>

      {/*
        Beside the theme and the app language, and device-level for the same
        reason they are: a tip you have read is a fact about this phone, and a
        shared tablet should not inherit somebody else's dismissals.
      */}
      <Text style={styles.section}>{t('tips.section')}</Text>
      <View>
        <ListRow
          title={t('tips.show')}
          subtitle={t('tips.showBody')}
          last
          accessory={
            <Toggle
              accessibilityLabel={t('tips.show')}
              value={tips.enabled}
              onValueChange={tips.setEnabled}
            />
          }
        />
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
                  {isPro ? null : <Text style={styles.proTag}>{paidBadge}</Text>}
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
        {/*
          Five links every reader scrolls past to reach Community and Account.
          They have to be reachable — two stores require it — but not in the
          way, and one row naming what is behind it is as findable as five.
        */}
        <ListRow
          title={t('settings.legalSection')}
          last
          onPress={() => router.push('/(app)/legal')}
        />
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
  /** The kind a pair of channel rows belongs to, above them rather than beside. */
  kindTitle: { ...font.body, color: colors.text, fontWeight: '600', marginTop: spacing.lg },
  kindBody: { ...font.caption, color: colors.textMuted, marginBottom: spacing.xs },
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
