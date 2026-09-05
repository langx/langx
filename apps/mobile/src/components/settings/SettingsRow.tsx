import { ACCOUNT_DELETION_GRACE_DAYS, LOCALE_NAMES, NOTIFICATION_CHANNELS } from '@langx/shared'
import { router } from 'expo-router'
import { Image, Pressable, Text, View } from 'react-native'
import darkIcon from '../../../assets/icons/dark.png'
import defaultIcon from '../../../assets/icons/default.png'
import type { SettingsModel } from '../../hooks/useSettingsModel'
import { type MessageKey } from '../../i18n'
import { relativeTime } from '../../lib/format'
import { openExternal } from '../../lib/openExternal'
import { openPaywall } from '../../lib/paywall'
import { makeStyles, THEME_PREFERENCES, type ThemePreference } from '../../lib/theme'
import { ListRow } from '../ui/ListRow'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Toggle } from '../ui/Toggle'

/** Keys, not words: a module constant is fixed at import time. */
const THEME_LABELS: Record<ThemePreference, MessageKey> = {
  auto: 'theme.auto',
  light: 'theme.light',
  dark: 'theme.dark',
}

/**
 * Imported statically, because Metro resolves an image at build time: a path
 * assembled at runtime resolves to nothing.
 */
const ICON_PREVIEWS = { default: defaultIcon, dark: darkIcon }

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
 * The rows are rendered on their category's page and again in the landing
 * page's search results, so "incognito" finds the incognito *toggle* and it
 * can be flipped right there. That is why this is a function of the id and
 * the shared model rather than JSX that lives on a screen: two renderings,
 * one definition. Returns `null` for a row that does not apply right now — a
 * plan with nothing to manage, a device with no home screen — which is the
 * rule the old screen had too: no row where there is nowhere to send them,
 * rather than a disabled one.
 */
export function SettingsRow({ id, model, last = false }: SettingsRowProps) {
  const styles = useStyles()
  const { t, profile, update } = model

  switch (id) {
    case 'plan.current':
      return <ListRow title={t('settings.currentPlan')} value={model.tierName} last={last} />
    case 'plan.renewal':
      return model.renewal ? (
        <ListRow title={model.renewal.label} value={model.renewal.value} last={last} />
      ) : null
    case 'plan.upgrade':
      return model.tier === 'pro_plus' ? null : (
        <ListRow
          title={t('settings.upgrade')}
          last={last}
          onPress={() => openPaywall(undefined, '/(app)/settings')}
        />
      )
    case 'plan.manage':
      return model.manageUrl ? (
        <ListRow
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
      return (
        <ListRow
          title={t('settings.incognito')}
          subtitle={t('settings.incognitoBody')}
          last={last}
          accessory={
            <View style={styles.gated}>
              {model.canIncognito ? null : (
                <Text style={styles.proTag}>{model.incognitoBadge}</Text>
              )}
              <Toggle
                accessibilityLabel={t('settings.incognito')}
                disabled={!model.canIncognito}
                value={profile?.privacy.incognito ?? false}
                onValueChange={(incognito) => update.mutate({ privacy: { incognito } })}
              />
            </View>
          }
        />
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
              value={profile?.privacy.activityMapVisible ?? true}
              onValueChange={(activityMapVisible) =>
                update.mutate({ privacy: { activityMapVisible } })
              }
            />
          }
        />
      )
    case 'privacy.stats':
      // The numbers above the map — streak, corrections, tokens, the week's
      // chart — travel together, because hiding the chart and leaving the
      // counts would be a setting that does not do what it says.
      return (
        <ListRow
          title={t('settings.showStats')}
          subtitle={t('settings.showStatsBody')}
          last={last}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.showStats')}
              value={profile?.privacy.statsVisible ?? true}
              onValueChange={(statsVisible) => update.mutate({ privacy: { statsVisible } })}
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
              value={profile?.privacy.hideOnlineStatus ?? false}
              onValueChange={(hideOnlineStatus) => update.mutate({ privacy: { hideOnlineStatus } })}
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
              value={profile?.privacy.hideCity ?? false}
              onValueChange={(hideCity) => update.mutate({ privacy: { hideCity } })}
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
      // not in `profile.settings` — see `lib/theme/ThemeProvider`.
      return (
        <View style={styles.theme}>
          <Text style={styles.kindTitle}>{t('theme.section')}</Text>
          <SegmentedControl<ThemePreference>
            accessibilityLabel={t('theme.label')}
            options={THEME_PREFERENCES.map((value) => ({ value, label: t(THEME_LABELS[value]) }))}
            selected={[model.theme.preference]}
            onToggle={model.theme.setPreference}
          />
        </View>
      )
    case 'appearance.appIcon':
      // Only where there is a home screen to put it on: the web build and
      // Expo Go have neither the module nor anywhere for the icon to go.
      return model.iconSupported ? (
        <ListRow
          title={t('settings.appIcon')}
          subtitle={t('settings.appIconBody')}
          last={last}
          accessory={
            <View style={styles.gated}>
              {model.isPro ? null : <Text style={styles.proTag}>{model.paidBadge}</Text>}
              {model.appIcons.map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={t(`settings.appIcon_${name}` as MessageKey)}
                  accessibilityState={{ selected: model.appIcon === name }}
                  onPress={() => void model.chooseIcon(name)}
                  style={[styles.iconTile, model.appIcon === name && styles.iconTileChosen]}
                >
                  <Image source={ICON_PREVIEWS[name]} style={styles.iconImage} />
                </Pressable>
              ))}
            </View>
          }
        />
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
      return (
        <ListRow
          title={t('settings.blockedPeople')}
          last={last}
          onPress={() => router.push('/(app)/blocked')}
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
  /** The kind a pair of channel rows belongs to, above them rather than beside. */
  kindTitle: { ...font.body, color: colors.text, fontWeight: '600', marginTop: spacing.lg },
  kindBody: { ...font.caption, color: colors.textMuted, marginBottom: spacing.xs },
  theme: { gap: spacing.sm, paddingBottom: spacing.md },
}))
