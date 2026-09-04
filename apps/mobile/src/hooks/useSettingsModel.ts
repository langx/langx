import {
  ACCOUNT_DELETION_GRACE_DAYS,
  TIER_BADGES,
  TIER_NAMES,
  resolveNotificationPrefs,
  tierUnlocking,
} from '@langx/shared'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, Platform } from 'react-native'
import { api } from '../api/client'
import {
  useEffectiveTier,
  useHasFeature,
  useIsPro,
  useMe,
  useShareLocation,
  useStopSharingLocation,
  useUpdateProfile,
} from '../api/queries'
import { useAnalyticsPreference } from './useAnalyticsPreference'
import { unregisterPushToken } from './usePushRegistration'
import { useTips } from './useTips'
import { useLocale, useLocalePreference, useT } from '../i18n'
import { confirmAlert, showAlert } from '../lib/alert'
import { isAnalyticsAvailable } from '../lib/analytics'
import { API_URL } from '../lib/apiUrl'
import { APP_ICONS, currentAppIcon, isSupported, setAppIcon, type AppIcon } from '../lib/appIcon'
import { authClient } from '../lib/auth-client'
import { authLandingHref } from '../lib/authLanding'
import { FLAG_KEYS, readBoolFlag } from '../lib/localFlags'
import { captureLocation, reportLocationFailure } from '../lib/location'
import { pushEnabledOnThisDevice, setPushEnabledOnThisDevice } from '../lib/devicePush'
import { manageSubscriptionUrl } from '../lib/manageSubscription'
import { openPaywall } from '../lib/paywall'
import { useThemePreference } from '../lib/theme'
import { syncIconBadge } from '../lib/iconBadge'
import { showToast } from '../lib/toast'

/**
 * Everything the settings rows read and call, in one hook.
 *
 * The rows live in `SettingsRow`, drawn by id from `SETTINGS_SECTIONS`, and
 * are rendered on their category's page *and* in the landing page's search
 * results. A control that works the same in both places needs the same
 * state and handlers in both — so they are here, once, rather than in a
 * screen. What the 714-line screen used to compute inline is what this
 * returns.
 */
export function useSettingsModel() {
  const t = useT()
  const { preference: locale, deviceLocale } = useLocalePreference()
  // The *resolved* locale, not the preference: `auto` is not something
  // `toLocaleDateString` can read.
  const { locale: activeLocale } = useLocale()
  const theme = useThemePreference()

  const me = useMe()
  const update = useUpdateProfile()
  const [busy, setBusy] = useState(false)
  const iconSupported = isSupported()
  const [appIcon, setAppIcon_] = useState<AppIcon>(() =>
    iconSupported ? currentAppIcon() : 'default',
  )
  /**
   * Notifications on this phone, as opposed to the account-wide switches
   * below it — those say *what*, this says *where*.
   *
   * Read from device storage rather than from the profile, so it is right
   * before any request has answered and stays right on a phone that is
   * silenced while another one is not. Defaults to on, which is what an
   * unreadable store also reads as.
   */
  const [pushOnThisDevice, setPushOnThisDevice] = useState(true)
  useEffect(() => {
    void pushEnabledOnThisDevice().then(setPushOnThisDevice)
  }, [])

  async function togglePushOnThisDevice(next: boolean): Promise<void> {
    setPushOnThisDevice(next)
    await setPushEnabledOnThisDevice(next)
  }

  const profile = me.data
  const isPro = useIsPro()
  /**
   * The ten cells, with every stored shape already resolved — an account
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
      // Shared with Discover and the country picker; see the helper for why a
      // refusal is answered with a route to the switch rather than an error.
      await reportLocationFailure(fix.reason, t, 'location.unavailableTitle')
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
      await syncIconBadge(0)
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
    // A count that belonged to this account must not outlive it on the icon.
    await syncIconBadge(0)
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

  return {
    t,
    locale,
    deviceLocale,
    activeLocale,
    theme,
    profile,
    update,
    busy,
    iconSupported,
    appIcon,
    appIcons: APP_ICONS,
    chooseIcon,
    isPro,
    notifications,
    pushOnThisDevice,
    togglePushOnThisDevice,
    emailVerified,
    canIncognito,
    tier,
    tierName: TIER_NAMES[tier],
    renewal,
    manageUrl,
    tips,
    analytics,
    analyticsRow,
    incognitoBadge,
    paidBadge,
    shareLocation,
    sharingLocation,
    locationBusy,
    toggleLocation,
    exportData,
    confirmDelete,
    signOut,
    replayIntro,
  }
}

export type SettingsModel = ReturnType<typeof useSettingsModel>
