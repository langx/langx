import Feather from '@expo/vector-icons/Feather'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  LOCALE_NAMES,
  NOTIFICATION_CHANNELS,
  PRO_BENEFITS,
  PRO_PLUS_BENEFITS,
  profileUrl,
  TIER_NAMES,
  translateTargetFor,
  translateTargetOptions,
  type ProBenefit,
  type ProPlusBenefit,
} from '@langx/shared'
import { router } from 'expo-router'
import { Image, Platform, Pressable, Text, View } from 'react-native'
import darkIcon from '../../../assets/icons/dark.png'
import defaultIcon from '../../../assets/icons/default.png'
import newYearIcon from '../../../assets/icons/new-year.png'
import proIcon from '../../../assets/icons/pro.png'
import splitIcon from '../../../assets/icons/split.png'
import { useBlocks } from '../../api/queries'
import type { SettingsModel } from '../../hooks/useSettingsModel'
import { type MessageKey, useDisplayNames, useLocale, useT } from '../../i18n'
import { relativeTime } from '../../lib/format'
import { openExternal } from '../../lib/openExternal'
import { openPaywall } from '../../lib/paywall'
import { openStoreListing } from '../../lib/storeListing'
import { makeStyles, THEME_PREFERENCES, type ThemePreference, useTheme } from '../../lib/theme'
import { ListRow } from '../ui/ListRow'
import { Radio } from '../ui/Radio'
import { Toggle } from '../ui/Toggle'

/** Keys, not words: a module constant is fixed at import time. */
const THEME_LABELS: Record<ThemePreference, MessageKey> = {
  auto: 'theme.autoSystem',
  light: 'theme.light',
  dark: 'theme.dark',
}

/**
 * The name of each benefit, keyed off the shared lists so a benefit added to
 * either list without a name here stops this file compiling — the same
 * enforcement the paywall uses. The keys are the paywall's own, so the plan
 * page cannot call a benefit one thing and the paywall another.
 */
const BENEFIT_TITLE: Record<ProBenefit | ProPlusBenefit, MessageKey> = {
  unlimitedInitiations: 'paywall.unlimitedChats',
  advancedFilters: 'paywall.advancedFilters',
  sendTranslation: 'paywall.sendTranslation',
  deckExport: 'paywall.deckExport',
  translationQuota: 'paywall.translationQuota',
  learningLanguages: 'paywall.learningLanguages',
  welcomePack: 'paywall.welcomePack',
  profileViewerIdentities: 'paywall.whoViewed',
  incognito: 'paywall.incognito',
  nearby: 'paywall.nearby',
  copilot: 'paywall.copilot',
}

/**
 * Sold, not yet built. Mirrors the `shipped: false` entries of the paywall's
 * copy table, which is local to that screen — a "what you have" line that
 * names a feature in the present tense while it does nothing would be the
 * mis-sell that flag exists to prevent. One table for both screens is the
 * fix; until then the two must be changed together.
 */
const PENDING_BENEFITS: ReadonlySet<ProBenefit | ProPlusBenefit> = new Set(['copilot'])

/**
 * Imported statically, because Metro resolves an image at build time: a path
 * assembled at runtime resolves to nothing.
 */
const ICON_PREVIEWS = {
  default: defaultIcon,
  dark: darkIcon,
  split: splitIcon,
  pro: proIcon,
  newYear: newYearIcon,
}

interface SettingsRowProps {
  /** An id from `SETTINGS_SECTIONS`. */
  id: string
  model: SettingsModel
  /** Suppresses the row's own bottom divider — the last row of a group. */
  last?: boolean
}

/**
 * One setting, drawn from its id.
 *
 * The rows are rendered on their category's page, and the landing page's
 * search matches the same ids and leads to that page — so a row that exists
 * here is findable there. That is why this is a function of the id and the
 * shared model rather than JSX that lives on a screen: one definition.
 * Returns `null` for a row that does not apply right now — a plan with
 * nothing to manage, a device with no home screen — which is the rule the old
 * screen had too: no row where there is nowhere to send them, rather than a
 * disabled one.
 */
export function SettingsRow({ id, model, last = false }: SettingsRowProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const names = useDisplayNames()
  const { t, profile, update, setPrivacy, pendingPrivacy } = model
  /**
   * A privacy toggle's value and busy state in one place: while its own
   * request is in flight the switch shows what was asked for, so it moves
   * under the finger, and settles on what the server answered.
   */
  const privacyToggle = (field: keyof NonNullable<typeof pendingPrivacy>, stored: boolean) => {
    const pending = pendingPrivacy?.[field]
    return { busy: pending !== undefined, value: pending ?? stored }
  }

  switch (id) {
    case 'plan.current':
      // The plan as a tag rather than a value: it is a brand mark, and the
      // page sells the next one two rows down.
      return (
        <ListRow
          title={t('settings.currentPlan')}
          last={last}
          accessory={<Text style={styles.planPill}>{model.tierName}</Text>}
        />
      )
    case 'plan.renewal':
      return model.renewal ? (
        <ListRow title={model.renewal.label} value={model.renewal.value} last={last} />
      ) : null
    case 'plan.features': {
      // The same lists the paywall sells from. Free has no list in `shared`
      // — nothing was bought, so there is nothing to itemise.
      const benefits: readonly (ProBenefit | ProPlusBenefit)[] | null =
        model.tier === 'pro' ? PRO_BENEFITS : model.tier === 'pro_plus' ? PRO_PLUS_BENEFITS : null
      if (!benefits) return null
      return (
        <View style={[styles.features, !last && styles.divided]}>
          <Text style={styles.featuresKicker}>{t('settings.whatYouHave')}</Text>
          {benefits.map((benefit) => {
            const pending = PENDING_BENEFITS.has(benefit)
            return (
              <View key={benefit} style={styles.feature}>
                <Feather
                  name="check"
                  size={16}
                  color={pending ? colors.textFaint : colors.accent}
                />
                <Text style={styles.featureText}>
                  {t(BENEFIT_TITLE[benefit])}
                  {pending ? (
                    <Text style={styles.featurePending}> · {t('common.comingSoon')}</Text>
                  ) : null}
                </Text>
              </View>
            )
          })}
        </View>
      )
    }
    case 'plan.upgrade':
      // "See the plans" is the free tier's row. A Fluent subscriber is not
      // shopping — there is exactly one plan above them, and naming it is the
      // whole offer.
      return model.tier === 'pro_plus' ? null : (
        <ListRow
          title={
            model.tier === 'pro'
              ? t('settings.upgradeTo', { plan: TIER_NAMES.pro_plus })
              : t('settings.upgrade')
          }
          last={last}
          onPress={() => openPaywall(undefined, '/(app)/settings', 'me')}
        />
      )
    case 'plan.manage':
      return model.manageUrl ? (
        <ExternalRow
          title={t('settings.manageSubscription')}
          last={last}
          onPress={() => void openExternal(model.manageUrl!)}
        />
      ) : null

    case 'privacy.discoverable':
      return (
        <ListRow
          title={t('settings.showInDiscover')}
          subtitle={t('settings.showInDiscoverBody')}
          last={last}
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
      )
    case 'privacy.incognito':
      /*
       * Local rather than a `ListRow`: the plan tag sits *in the title line*,
       * which `ListRow` has no slot for. Same metrics as its rows. When the
       * plan lacks the feature the switch is drawn dimmed and a press opens the
       * paywall — the row still says what it is for, and where to get it.
       */
      return (
        <View style={[styles.row, !last && styles.divided]}>
          <View style={styles.rowText}>
            <View style={styles.titleWithTag}>
              <Text style={styles.rowTitle}>{t('settings.incognito')}</Text>
              {model.canIncognito ? null : (
                <Text style={styles.proTag}>{model.incognitoBadge}</Text>
              )}
            </View>
            <Text style={styles.rowSubtitle}>{t('settings.incognitoBody')}</Text>
          </View>
          {model.canIncognito ? (
            <Toggle
              accessibilityLabel={t('settings.incognito')}
              {...privacyToggle('incognito', profile?.privacy.incognito ?? false)}
              onValueChange={(incognito) => setPrivacy({ incognito })}
            />
          ) : (
            <View style={styles.locked}>
              <Toggle
                accessibilityLabel={t('settings.incognito')}
                value={false}
                onValueChange={() => openPaywall('incognito', '/(app)/settings/privacy')}
              />
            </View>
          )}
        </View>
      )
    case 'privacy.activityMap':
      // Free, unlike incognito: the streak this is drawn from is already on
      // the public profile, so hiding the squares is a preference rather
      // than a feature.
      return (
        <ListRow
          title={t('settings.activityMap')}
          subtitle={t('settings.activityMapBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.activityMap')}
              {...privacyToggle('activityMapVisible', profile?.privacy.activityMapVisible ?? true)}
              onValueChange={(activityMapVisible) => setPrivacy({ activityMapVisible })}
            />
          }
        />
      )
    case 'privacy.weekChart':
      // Was "show my numbers", which also hid the streak, corrections and
      // tokens. Those always show now; what stays switchable is the chart,
      // because it says something the totals do not — which days you were
      // here this week.
      return (
        <ListRow
          title={t('settings.showWeekChart')}
          subtitle={t('settings.showWeekChartBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.showWeekChart')}
              {...privacyToggle('weekChartVisible', profile?.privacy.weekChartVisible ?? true)}
              onValueChange={(weekChartVisible) => setPrivacy({ weekChartVisible })}
            />
          }
        />
      )
    case 'privacy.hideOnline':
      return (
        <ListRow
          title={t('settings.hideOnline')}
          subtitle={t('settings.hideOnlineBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.hideOnline')}
              {...privacyToggle('hideOnlineStatus', profile?.privacy.hideOnlineStatus ?? false)}
              onValueChange={(hideOnlineStatus) => setPrivacy({ hideOnlineStatus })}
            />
          }
        />
      )
    case 'privacy.hideCity':
      // A preference, like the activity map. Beside what other people see
      // rather than beside "share location", which is about what is collected.
      return (
        <ListRow
          title={t('settings.hideCity')}
          subtitle={t('settings.hideCityBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.hideCity')}
              {...privacyToggle('hideCity', profile?.privacy.hideCity ?? false)}
              onValueChange={(hideCity) => setPrivacy({ hideCity })}
            />
          }
        />
      )
    case 'privacy.shareLocation':
      return (
        <ListRow
          title={t('settings.shareLocation')}
          subtitle={t('settings.shareLocationBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.shareLocation')}
              disabled={model.locationBusy}
              value={model.sharingLocation}
              onValueChange={(next) => void model.toggleLocation(next)}
            />
          }
        />
      )
    case 'privacy.updateLocation':
      return model.sharingLocation ? (
        <ListRow
          title={t('settings.updateLocation')}
          /* `locationUpdatedAt` has been stored and returned to its owner
             since sharing shipped, and rendered nowhere — which is what the
             field's own doc comment asks for: sharing a location should not
             be a thing you turned on once and can never see the state of. */
          subtitle={
            profile?.locationUpdatedAt
              ? t('settings.locationUpdated', {
                  time: relativeTime(profile.locationUpdatedAt, { t, locale: model.activeLocale }),
                })
              : undefined
          }
          value={model.shareLocation.isPending ? t('settings.updating') : undefined}
          last={last}
          onPress={() => void model.toggleLocation(true)}
        />
      ) : null
    case 'privacy.analytics':
      // The one privacy row about what leaves the device for *us* rather than
      // for other users. Device-level, like the theme: the refusal belongs to
      // the phone, and is honoured before there is an account to attach it
      // to. What is sent, and what never is, is in `lib/analyticsEvents.ts`.
      return model.analyticsRow ? (
        <ListRow
          title={t('settings.shareUsage')}
          subtitle={t('settings.shareUsageBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.shareUsage')}
              value={model.analytics.enabled}
              onValueChange={(next) => void model.analytics.setEnabled(next)}
            />
          }
        />
      ) : null

    case 'appearance.theme':
      // A device preference rather than an account one, so it is deliberately
      // not in `profile.settings` — see `lib/theme/ThemeProvider`. One radio
      // row per option: the row is the pressable, the glyph only shows state.
      return (
        <View>
          <Text style={[styles.kicker, styles.kickerFirst]}>{t('theme.label')}</Text>
          {THEME_PREFERENCES.map((value) => {
            const selected = model.theme.preference === value
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => model.theme.setPreference(value)}
                style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
              >
                <Text style={styles.rowTitle}>{t(THEME_LABELS[value])}</Text>
                <Radio selected={selected} />
              </Pressable>
            )
          })}
        </View>
      )
    case 'appearance.appIcon':
      // Only where there is a home screen to put it on: the web build and
      // Expo Go have neither the module nor anywhere for the icon to go.
      // Tiles, not a row with thumbnails: an icon is chosen by looking at it.
      return model.iconSupported ? (
        <View>
          <Text style={styles.kicker}>{t('settings.appIconSection')}</Text>
          <View style={[styles.iconTiles, !last && styles.divided]}>
            {model.appIcons.map((name) => {
              const chosen = model.appIcon === name
              return (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={t(`settings.appIcon_${name}` as MessageKey)}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => void model.chooseIcon(name)}
                  style={({ pressed }) => [styles.iconTile, pressed && styles.pressed]}
                >
                  <View style={[styles.iconRing, chosen && styles.iconRingChosen]}>
                    <Image source={ICON_PREVIEWS[name]} style={styles.iconImage} />
                  </View>
                  <Text style={styles.iconLabel}>
                    {t(`settings.appIcon_${name}` as MessageKey)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null
    case 'appearance.language':
      // Device-level, like the theme, and for the same reason: the phone is
      // what has a language setting. One row showing the current value, not
      // nine rows showing every value.
      return (
        <ListRow
          title={t('settings.appLanguage')}
          value={
            model.locale === 'auto'
              ? t('settings.languageAuto', { name: LOCALE_NAMES[model.deviceLocale] })
              : LOCALE_NAMES[model.locale]
          }
          last={last}
          onPress={() => router.push('/(app)/app-language')}
        />
      )
    case 'appearance.translateTo': {
      // An account setting, unlike the two device-level rows around it: the
      // language somebody reads in follows them to every phone. The value is
      // the resolved target, so the row never reads "not set" — there is
      // always a first native language — and it only opens a picker when
      // there is a second one to pick.
      if (!profile) return null
      const target = translateTargetFor(profile)
      if (!target) return null
      const canChoose = translateTargetOptions(profile).length > 1
      return (
        <ListRow
          title={t('settings.translateTo')}
          subtitle={t('settings.translateToBody')}
          value={names.language(target)}
          last={last}
          onPress={canChoose ? () => router.push('/(app)/translate-language') : undefined}
        />
      )
    }
    case 'appearance.tips':
      // Device-level, like the theme: a tip you have read is a fact about this
      // phone, and a shared tablet should not inherit somebody else's dismissals.
      return (
        <ListRow
          title={t('tips.show')}
          subtitle={t('tips.showBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('tips.show')}
              value={model.tips.enabled}
              onValueChange={model.tips.setEnabled}
            />
          }
        />
      )

    case 'account.signIn':
      // Sits above devices: "how do I get in" comes before "where am I
      // already in", and for somebody who only has Google or Apple this is
      // the row that tells them they have no password.
      return (
        <ListRow
          title={t('settings.signInMethods')}
          subtitle={t('settings.signInMethodsBody')}
          last={last}
          onPress={() => router.push('/(app)/settings/sign-in-methods')}
        />
      )
    case 'account.password':
      // Its own row as well as a line inside "Sign-in methods": "password" is
      // what people search for, and a search that lands on a screen where the
      // word is a status readout under a different heading is a near miss.
      return (
        <ListRow
          title={t('settings.password')}
          subtitle={t('settings.passwordBody')}
          last={last}
          onPress={() => router.push('/(app)/settings/password')}
        />
      )
    case 'account.devices':
      // Approving a sign-in is account plumbing, not something anybody does
      // often, and it sits with the other things that decide who can reach
      // the account.
      return (
        <ListRow
          title={t('linkDevice.title')}
          subtitle={t('settings.linkDeviceBody')}
          last={last}
          onPress={() => router.push('/(app)/link-device')}
        />
      )
    case 'account.blocked':
      return <BlockedPeopleRow last={last} />
    /*
     * Drawn on every tier and gated on press, the same way the incognito row
     * is: a row that says which plan opens it teaches the feature, and a row
     * that is missing teaches nothing.
     *
     * The gate is here rather than on the screen's export button because
     * `/me/phrases` is Polyglot on the server — a free reader who reached the
     * screen would find an empty list and no way to learn why.
     */
    case 'account.allPhrases':
      return (
        <ListRow
          title={t('settings.exportPhrases')}
          subtitle={t('settings.exportPhrasesBody')}
          last={last}
          {...(model.canDeckExport
            ? {}
            : { accessory: <Text style={styles.proTag}>{model.deckExportBadge}</Text> })}
          onPress={() =>
            model.canDeckExport
              ? router.push('/(app)/all-phrases')
              : openPaywall('deckExport', '/(app)/settings/account')
          }
        />
      )
    case 'account.export':
      return (
        <ListRow
          title={t('settings.exportData')}
          last={last}
          onPress={() => void model.exportData()}
        />
      )
    case 'account.delete':
      return (
        <ListRow
          title={t('settings.deleteAccount')}
          subtitle={t('settings.deleteAccountBody', { days: ACCOUNT_DELETION_GRACE_DAYS })}
          destructive
          last={last}
          // A screen, not a dialog: `AlertHost` draws buttons and no text
          // field, and the gate in front of this is a typed handle.
          onPress={() => router.push('/(app)/settings/delete-account')}
        />
      )

    case 'share.profile':
      /*
       * A screen rather than the share sheet directly: sending a link and
       * showing one across a table want opposite things, and a sheet cannot be
       * photographed. The sheet is one tap further in, where it belongs.
       */
      if (!model.profile) return null
      return (
        <ListRow
          title={t('me.shareProfile')}
          subtitle={profileUrl(model.profile.handle).replace('https://', '')}
          last={last}
          onPress={() => router.push('/(app)/share-profile')}
        />
      )
    case 'share.invite':
      // Beside sharing a profile, not inside it. They look alike and are not:
      // one is "here is me", the other is "come and try this", and the second
      // one pays.
      return (
        <ListRow
          title={t('me.invite')}
          subtitle={t('me.inviteBody')}
          last={last}
          onPress={() => router.push('/(app)/invite')}
        />
      )

    case 'about.legal':
      // Five links every reader scrolls past. They have to be reachable — two
      // stores require it — but one row naming what is behind it is as
      // findable as five.
      return (
        <ListRow
          title={t('settings.legalSection')}
          last={last}
          onPress={() => router.push('/(app)/legal')}
        />
      )
    case 'about.reportBug':
      return (
        <ListRow
          title={t('feedback.bugTitle')}
          subtitle={t('feedback.bugRowBody')}
          last={last}
          onPress={() => router.push('/(app)/settings/feedback?kind=bug')}
        />
      )
    case 'about.requestFeature':
      return (
        <ListRow
          title={t('feedback.featureTitle')}
          subtitle={t('feedback.featureRowBody')}
          last={last}
          onPress={() => router.push('/(app)/settings/feedback?kind=feature')}
        />
      )
    case 'about.community':
      return (
        <ListRow
          title={t('kitchen.title')}
          subtitle={t('kitchen.intro')}
          last={last}
          onPress={() => router.push('/(app)/kitchen')}
        />
      )
    case 'about.intro':
      return <ListRow title={t('settings.showIntro')} last={last} onPress={model.replayIntro} />
    case 'about.rate':
      // The listing itself, not the rationed in-app sheet: a row somebody
      // taps on purpose should always lead somewhere. Nowhere to send a
      // browser, so no row on web.
      if (Platform.OS === 'web') return null
      return (
        <ExternalRow
          title={t('settings.rateApp')}
          last={last}
          onPress={() => void openStoreListing()}
        />
      )

    case 'notifications.thisDevice':
      return (
        <ListRow
          title={t('settings.pushThisDevice')}
          subtitle={t('settings.pushThisDeviceBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.pushThisDevice')}
              value={model.pushOnThisDevice}
              onValueChange={(next) => void model.togglePushOnThisDevice(next)}
            />
          }
        />
      )

    default: {
      /*
       * Notification kinds: one item per kind, two channel rows under a
       * heading. It was one switch for everything, which meant that somebody
       * who did not want a nudge about their streak had to turn off the
       * message they were waiting for as well. The email half is disabled
       * until an address is verified — that rule is what keeps a dead switch
       * off this screen. Promotions default to off on both; consent is given,
       * not withdrawn.
       */
      if (!id.startsWith('notifications.')) return null
      const type = id.slice('notifications.'.length) as keyof typeof model.notifications
      return (
        <View>
          <Text style={styles.kindTitle}>{t(`notifications.${type}` as MessageKey)}</Text>
          <Text style={styles.kindBody}>{t(`notifications.${type}Body` as MessageKey)}</Text>
          <View>
            {NOTIFICATION_CHANNELS.map((channel, index) => {
              const disabled = channel === 'email' && !model.emailVerified
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
                      value={model.notifications[type][channel]}
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
      )
    }
  }
}

/**
 * A row that leaves the app — the store's subscription page, the store
 * listing — and says so with the share glyph where `ListRow` draws a chevron.
 * `ListRow` cannot swap that glyph, so the row is local, on the same metrics.
 */
function ExternalRow({
  title,
  onPress,
  last,
}: {
  title: string
  onPress: () => void
  last: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divided, pressed && styles.pressed]}
    >
      <Text style={[styles.rowTitle, styles.rowGrow]}>{title}</Text>
      <Feather name="share" size={18} color={colors.textFaint} />
    </Pressable>
  )
}

/**
 * Its own component because the count is a query, and a hook cannot live in
 * one arm of the switch above. The number is the whole list's `total` off
 * whichever page is cached — none while it loads, or against an older API,
 * and the row is then the title alone.
 */
function BlockedPeopleRow({ last }: { last: boolean }) {
  const t = useT()
  const { locale } = useLocale()
  const total = useBlocks().data?.pages[0]?.total
  return (
    <ListRow
      title={t('settings.blockedPeople')}
      value={total === undefined ? undefined : total.toLocaleString(locale)}
      last={last}
      onPress={() => router.push('/(app)/blocked')}
    />
  )
}

const useStyles = makeStyles(({ colors, spacing, radius }) => {
  /**
   * The plan tags ring themselves in `pro` at 35%. The palette has no tint
   * token for it, and both schemes' `pro` are six-digit hexes, so the alpha
   * byte is appended rather than a second purple invented.
   */
  const proTint = `${colors.pro}59`
  return {
    // `ListRow`'s own metrics — 17 over 17, a hairline under — for the two
    // rows this file has to draw itself.
    row: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, paddingVertical: 17 },
    divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
    pressed: { opacity: 0.6 },
    rowText: { flex: 1, gap: 2 },
    rowGrow: { flex: 1 },
    rowTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
    rowSubtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    titleWithTag: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    /** The plan that unlocks a gated row, beside its title. */
    proTag: {
      borderColor: proTint,
      borderRadius: radius.pill,
      borderWidth: 1,
      color: colors.pro,
      fontSize: 10,
      fontWeight: '700',
      overflow: 'hidden',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    /** A switch the plan does not include: still there, visibly not live. */
    locked: { opacity: 0.6 },
    planPill: {
      borderColor: proTint,
      borderRadius: radius.pill,
      borderWidth: 1,
      color: colors.pro,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      overflow: 'hidden',
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      textTransform: 'uppercase',
    },
    features: { gap: spacing.sm, paddingVertical: 18 },
    featuresKicker: {
      color: colors.textFaint,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    feature: { alignItems: 'center', flexDirection: 'row', gap: 10 },
    featureText: { color: colors.text, fontSize: 15 },
    featurePending: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    kicker: {
      color: colors.textFaint,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      paddingBottom: spacing.xs,
      paddingTop: 22,
      textTransform: 'uppercase',
    },
    /** The first kicker on a page sits closer to the header. */
    kickerFirst: { paddingTop: 14 },
    radioRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.lg,
    },
    // Wraps, because five 60px tiles and their gaps are wider than the column
    // on a phone. Wrapping rather than scrolling sideways: an icon nobody
    // scrolled to is an icon nobody knows they have.
    iconTiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
      paddingBottom: 18,
      paddingTop: 14,
    },
    iconTile: { alignItems: 'center', gap: spacing.sm },
    // The chosen tile is ringed in `accent` with a 3px gap of ground between:
    // a transparent ring on every tile keeps the unchosen ones the same size.
    iconRing: {
      borderColor: 'transparent',
      borderRadius: radius.lg + 5,
      borderWidth: 2,
      padding: 3,
    },
    iconRingChosen: { borderColor: colors.accent },
    iconImage: { borderRadius: radius.lg, height: 60, width: 60 },
    iconLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
    /** The kind a pair of channel rows belongs to, above them rather than beside. */
    kindTitle: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: spacing.lg },
    kindBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.xs },
  }
})
