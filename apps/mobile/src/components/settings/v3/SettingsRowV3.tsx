import {
  HANDLE_CHANGE_COOLDOWN_DAYS,
  LOCALE_NAMES,
  translateTargetFor,
  translateTargetOptions,
} from '@langx/shared'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Platform, Text, View } from 'react-native'
import { useBlocks } from '../../../api/queries'
import type { SettingsModel } from '../../../hooks/useSettingsModel'
import { useDisplayNames, useLocale } from '../../../i18n'
import { relativeTime } from '../../../lib/format'
import { openPaywall } from '../../../lib/paywall'
import { isV3RowId, type V3RowId } from '../../../lib/settingsLayoutV3'
import { openStoreListing } from '../../../lib/storeListing'
import { makeStyles, type PartnerHue } from '../../../lib/theme'
import { Toggle } from '../../ui/Toggle'
import { ProTagV3, SettingsItemV3, type Glyph } from './SettingsKitV3'

/**
 * One setting under `flags.v3Home`, drawn from its id — the v3 twin of
 * `SettingsRow`, with the same handlers on the same `SettingsModel`. Only
 * the drawing changes: every switch writes what it wrote, every row opens
 * what it opened, and a row that today draws nothing (no calls service, no
 * analytics, not sharing a location, the web) draws nothing here.
 *
 * The plan, sharing, theme and app-icon rows are not here: their pages draw
 * them as blocks rather than rows (`SettingsSectionPageV3`).
 */
export function SettingsRowV3({ id, model }: { id: string; model: SettingsModel }) {
  const names = useDisplayNames()
  const { t, profile, update, setPrivacy } = model
  const { busyValue, hidden } = privacyState(model)
  if (!isV3RowId(id)) return null
  const { icon, hue } = ROW_LOOK[id]

  switch (id) {
    case 'privacy.hiddenMode':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.hiddenMode')}
          subtitle={t('settings.hiddenModeBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.hiddenMode')}
              {...busyValue('hiddenMode', hidden.stored)}
              onValueChange={(hiddenMode) => setPrivacy({ hiddenMode })}
            />
          }
        />
      )
    case 'privacy.boost':
      // Same branches as today's row: the switch for a plan with boosting,
      // off and inert while hidden from Discover; a locked switch that opens
      // the paywall for one without.
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.boost')}
          tag={model.canBoost ? undefined : model.boostBadge}
          subtitle={
            model.canBoost && profile?.settings.discoverable === false
              ? t('settings.boostHidden')
              : t('settings.boostBody')
          }
          accessory={
            model.canBoost ? (
              <Toggle
                accessibilityLabel={t('settings.boost')}
                disabled={profile?.settings.discoverable === false}
                value={
                  profile?.settings.discoverable !== false && (profile?.settings.boosted ?? true)
                }
                onValueChange={(boosted) =>
                  update.mutate({ settings: { ...profile?.settings, boosted } })
                }
              />
            ) : (
              <LockedToggle
                label={t('settings.boost')}
                onPress={() => openPaywall('boostedProfile', '/(app)/settings/privacy')}
              />
            )
          }
        />
      )
    case 'privacy.activityMap':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.activityMap')}
          subtitle={t('settings.activityMapBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.activityMap')}
              {...busyValue('activityMapVisible', profile?.privacy.activityMapVisible ?? true)}
              onValueChange={(activityMapVisible) => setPrivacy({ activityMapVisible })}
            />
          }
        />
      )
    case 'privacy.weekChart':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.showWeekChart')}
          subtitle={t('settings.showWeekChartBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.showWeekChart')}
              {...busyValue('weekChartVisible', profile?.privacy.weekChartVisible ?? true)}
              onValueChange={(weekChartVisible) => setPrivacy({ weekChartVisible })}
            />
          }
        />
      )
    case 'privacy.allowCalls': {
      if (!model.callsRow) return null
      // Stored as its opposite, `refuseCalls`; drawn as "allow", as today.
      const refuse = busyValue('refuseCalls', profile?.privacy.refuseCalls ?? false)
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.allowCalls')}
          subtitle={t('settings.allowCallsBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.allowCalls')}
              busy={refuse.busy}
              value={!refuse.value}
              onValueChange={(allow) => setPrivacy({ refuseCalls: !allow })}
            />
          }
        />
      )
    }
    case 'privacy.hideCity':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.hideCity')}
          subtitle={t('settings.hideCityBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.hideCity')}
              {...busyValue('hideCity', profile?.privacy.hideCity ?? false)}
              onValueChange={(hideCity) => setPrivacy({ hideCity })}
            />
          }
        />
      )
    case 'privacy.shareLocation':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.shareLocation')}
          subtitle={t('settings.shareLocationBody')}
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
      if (!model.sharingLocation) return null
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.updateLocation')}
          subtitle={
            profile?.locationUpdatedAt
              ? t('settings.locationUpdated', {
                  time: relativeTime(profile.locationUpdatedAt, { t, locale: model.activeLocale }),
                })
              : undefined
          }
          value={model.shareLocation.isPending ? t('settings.updating') : undefined}
          onPress={() => void model.toggleLocation(true)}
        />
      )
    case 'privacy.locationPermission':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('location.guide.rowTitle')}
          subtitle={t('location.guide.rowBody')}
          onPress={() => router.push('/(app)/settings/location')}
        />
      )
    case 'privacy.analytics':
      if (!model.analyticsRow) return null
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.shareUsage')}
          subtitle={t('settings.shareUsageBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.shareUsage')}
              value={model.analytics.enabled}
              onValueChange={(next) => void model.analytics.setEnabled(next)}
            />
          }
        />
      )

    case 'notifications.thisDevice':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.pushThisDevice')}
          subtitle={t('settings.pushThisDeviceBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('settings.pushThisDevice')}
              value={model.pushOnThisDevice}
              onValueChange={(next) => void model.togglePushOnThisDevice(next)}
            />
          }
        />
      )
    case 'notifications.permission':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('notifications.guide.rowTitle')}
          subtitle={t('notifications.guide.rowBody')}
          onPress={() => router.push('/(app)/settings/push')}
        />
      )

    case 'appearance.language':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.appLanguage')}
          value={
            model.locale === 'auto'
              ? t('settings.languageAuto', { name: LOCALE_NAMES[model.deviceLocale] })
              : LOCALE_NAMES[model.locale]
          }
          onPress={() => router.push('/(app)/app-language')}
        />
      )
    case 'appearance.translateTo': {
      if (!profile) return null
      const target = translateTargetFor(profile)
      if (!target) return null
      const canChoose = translateTargetOptions(profile).length > 1
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.translateTo')}
          subtitle={t('settings.translateToBody')}
          value={names.language(target)}
          onPress={canChoose ? () => router.push('/(app)/translate-language') : undefined}
        />
      )
    }
    case 'appearance.tips':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('tips.show')}
          subtitle={t('tips.showBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('tips.show')}
              value={model.tips.enabled}
              onValueChange={model.tips.setEnabled}
            />
          }
        />
      )

    case 'account.username':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.username')}
          subtitle={t('settings.usernameBody', { days: HANDLE_CHANGE_COOLDOWN_DAYS })}
          value={profile ? `@${profile.handle}` : undefined}
          onPress={() => router.push('/(app)/settings/username')}
        />
      )
    case 'account.signIn':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.signInMethods')}
          subtitle={t('settings.signInMethodsBody')}
          onPress={() => router.push('/(app)/settings/sign-in-methods')}
        />
      )
    case 'account.password':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.password')}
          subtitle={t('settings.passwordBody')}
          onPress={() => router.push('/(app)/settings/password')}
        />
      )
    case 'account.devices':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('linkDevice.title')}
          subtitle={t('settings.linkDeviceBody')}
          onPress={() => router.push('/(app)/link-device')}
        />
      )
    case 'account.blocked':
      return <BlockedRow icon={icon} hue={hue} title={t('settings.blockedPeople')} />
    case 'account.allPhrases':
      // Drawn on every tier and gated on press, as today.
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.exportPhrases')}
          subtitle={t('settings.exportPhrasesBody')}
          tag={model.canDeckExport ? undefined : model.deckExportBadge}
          onPress={() =>
            model.canDeckExport
              ? router.push('/(app)/all-phrases')
              : openPaywall('deckExport', '/(app)/settings/account')
          }
        />
      )
    case 'account.export':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.exportData')}
          subtitle={model.exporting ? t('settings.exportDataPreparing') : undefined}
          onPress={() => void model.exportData()}
        />
      )

    case 'about.legal':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.legalSection')}
          onPress={() => router.push('/(app)/legal')}
        />
      )
    case 'about.moderators':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.moderators')}
          onPress={() => router.push('/(app)/settings/moderators')}
        />
      )
    case 'about.voices':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.voiceCredits')}
          onPress={() => router.push('/(app)/settings/voices')}
        />
      )
    case 'about.reportBug':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('feedback.bugTitle')}
          subtitle={t('feedback.bugRowBody')}
          onPress={() => router.push('/(app)/settings/feedback?kind=bug')}
        />
      )
    case 'about.requestFeature':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('feedback.featureTitle')}
          subtitle={t('feedback.featureRowBody')}
          onPress={() => router.push('/(app)/settings/feedback?kind=feature')}
        />
      )
    case 'about.community':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('kitchen.title')}
          subtitle={t('kitchen.intro')}
          onPress={() => router.push('/(app)/kitchen')}
        />
      )
    case 'about.intro':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.showIntro')}
          onPress={model.replayIntro}
        />
      )
    case 'about.tour':
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.showTour')}
          subtitle={t('settings.showTourBody')}
          onPress={() => void model.replayTour()}
        />
      )
    case 'about.rate':
      if (Platform.OS === 'web') return null
      return (
        <SettingsItemV3
          icon={icon}
          hue={hue}
          title={t('settings.rateApp')}
          external
          onPress={() => void openStoreListing()}
        />
      )
    default: {
      // Exhaustive over `V3_ROW_IDS`: an id listed there without a case here
      // does not compile, rather than drawing nothing with the flag on.
      const unhandled: never = id
      return unhandled
    }
  }
}

/**
 * The four rows hidden mode governs, inside its block and under its switch:
 * greyed out and inert while it is off, as today's indented rows are.
 */
export function HiddenModeNestV3({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { t, profile, update, setPrivacy } = model
  const { busyValue, hidden } = privacyState(model)
  const child = (field: Parameters<typeof busyValue>[0], stored: boolean) => {
    const toggle = busyValue(field, stored)
    return { busy: toggle.busy || hidden.pending, value: toggle.value, disabled: !hidden.on }
  }
  return (
    <View
      style={[styles.nest, !hidden.on && styles.nestOff]}
      accessibilityState={{ disabled: !hidden.on }}
    >
      <View style={styles.nestInner}>
        <NestRow
          title={t('settings.hideFromDiscover')}
          body={t('settings.hideFromDiscoverBody')}
          control={
            <Toggle
              accessibilityLabel={t('settings.hideFromDiscover')}
              value={profile?.settings.discoverable === false}
              busy={hidden.pending}
              disabled={!hidden.on}
              onValueChange={(hide) =>
                update.mutate({ settings: { ...profile?.settings, discoverable: !hide } })
              }
            />
          }
        />
        <NestRow
          title={t('settings.hideOnline')}
          body={t('settings.hideOnlineBody')}
          control={
            <Toggle
              accessibilityLabel={t('settings.hideOnline')}
              {...child('hideOnlineStatus', profile?.privacy.hideOnlineStatus ?? false)}
              onValueChange={(hideOnlineStatus) => setPrivacy({ hideOnlineStatus })}
            />
          }
        />
        <NestRow
          title={t('settings.refuseNewChats')}
          body={t('settings.refuseNewChatsBody')}
          control={
            <Toggle
              accessibilityLabel={t('settings.refuseNewChats')}
              {...child('refuseNewChats', profile?.privacy.refuseNewChats ?? false)}
              onValueChange={(refuseNewChats) => setPrivacy({ refuseNewChats })}
            />
          }
        />
        <NestRow
          title={t('settings.incognito')}
          tag={model.canIncognito ? undefined : model.incognitoBadge}
          body={t('settings.incognitoBody')}
          control={
            model.canIncognito ? (
              <Toggle
                accessibilityLabel={t('settings.incognito')}
                {...child('incognito', profile?.privacy.incognito ?? false)}
                onValueChange={(incognito) => setPrivacy({ incognito })}
              />
            ) : (
              <LockedToggle
                label={t('settings.incognito')}
                disabled={!hidden.on}
                onPress={() => openPaywall('incognito', '/(app)/settings/privacy')}
              />
            )
          }
        />
      </View>
    </View>
  )
}

function NestRow({
  title,
  body,
  tag,
  control,
}: {
  title: string
  body: string
  tag?: string | null | undefined
  control: ReactNode
}) {
  const styles = useStyles()
  return (
    <View style={styles.nestRow}>
      <View style={styles.nestText}>
        <View style={styles.nestTitleLine}>
          <Text style={styles.nestTitle}>{title}</Text>
          {tag ? <ProTagV3 label={tag} /> : null}
        </View>
        <Text style={styles.caption}>{body}</Text>
      </View>
      {control}
    </View>
  )
}

/**
 * A switch the plan does not include: still there, visibly not live, and a
 * press opens the paywall — today's locked switch, unchanged.
 */
function LockedToggle({
  label,
  onPress,
  disabled = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  const styles = useStyles()
  return (
    <View style={styles.locked}>
      <Toggle
        accessibilityLabel={label}
        value={false}
        disabled={disabled}
        onValueChange={onPress}
      />
    </View>
  )
}

/** Its own component because the count is a query, as `BlockedPeopleRow` is. */
function BlockedRow({
  icon,
  hue,
  title,
}: {
  icon: Glyph
  hue?: PartnerHue | undefined
  title: string
}) {
  const { locale } = useLocale()
  const total = useBlocks().data?.pages[0]?.total
  return (
    <SettingsItemV3
      icon={icon}
      hue={hue}
      title={title}
      value={total === undefined ? undefined : total.toLocaleString(locale)}
      onPress={() => router.push('/(app)/blocked')}
    />
  )
}

/**
 * Today's privacy reading, unchanged (`SettingsRow`): a switch shows what was
 * asked for while its request is in flight, and hidden mode is worked out
 * the way the server works it out when an older API sends no `hiddenMode`.
 */
function privacyState(model: SettingsModel) {
  const { profile, pendingPrivacy } = model
  type Field = keyof NonNullable<typeof pendingPrivacy>
  const busyValue = (field: Field, stored: boolean) => {
    const pending = pendingPrivacy?.[field]
    return { busy: pending !== undefined, value: pending ?? stored }
  }
  const privacy = profile?.privacy
  const stored =
    privacy?.hiddenMode ??
    (profile?.settings.discoverable === false ||
      privacy?.hideOnlineStatus === true ||
      privacy?.refuseNewChats === true ||
      (privacy?.incognito === true && model.canIncognito))
  const pending = pendingPrivacy?.hiddenMode !== undefined
  const on = pendingPrivacy?.hiddenMode ?? stored
  return { busyValue, hidden: { stored, pending, on } }
}

/**
 * Each row's glyph, and a partner hue for the ones the drawings colour. The
 * hues mark kinds of thing, not importance: who finds you, what reaches you,
 * how you get in.
 */
const ROW_LOOK: Record<V3RowId, { icon: Glyph; hue?: PartnerHue }> = {
  'privacy.hiddenMode': { icon: 'eye-off', hue: 'lilac' },
  'privacy.boost': { icon: 'trending-up', hue: 'tangerine' },
  'privacy.activityMap': { icon: 'grid', hue: 'mint' },
  'privacy.weekChart': { icon: 'bar-chart-2', hue: 'aqua' },
  'privacy.hideCity': { icon: 'map-pin' },
  'privacy.allowCalls': { icon: 'phone', hue: 'mint' },
  'privacy.shareLocation': { icon: 'navigation', hue: 'sky' },
  'privacy.updateLocation': { icon: 'refresh-cw' },
  'privacy.locationPermission': { icon: 'settings' },
  'privacy.analytics': { icon: 'activity' },
  'notifications.thisDevice': { icon: 'smartphone', hue: 'sky' },
  'notifications.permission': { icon: 'settings' },
  'appearance.language': { icon: 'globe', hue: 'sky' },
  'appearance.translateTo': { icon: 'repeat', hue: 'aqua' },
  'appearance.tips': { icon: 'info', hue: 'tangerine' },
  'account.username': { icon: 'at-sign', hue: 'tangerine' },
  'account.signIn': { icon: 'key', hue: 'sky' },
  'account.password': { icon: 'lock', hue: 'sky' },
  'account.devices': { icon: 'monitor', hue: 'sky' },
  'account.blocked': { icon: 'slash' },
  'account.allPhrases': { icon: 'layers', hue: 'lilac' },
  'account.export': { icon: 'download' },
  'about.legal': { icon: 'file-text' },
  'about.voices': { icon: 'mic' },
  'about.reportBug': { icon: 'alert-circle', hue: 'tangerine' },
  'about.requestFeature': { icon: 'zap', hue: 'lime' },
  'about.community': { icon: 'coffee', hue: 'mint' },
  'about.moderators': { icon: 'shield', hue: 'aqua' },
  'about.rate': { icon: 'heart', hue: 'lime' },
  'about.intro': { icon: 'play-circle', hue: 'sky' },
  'about.tour': { icon: 'compass', hue: 'sky' },
}

const useStyles = makeStyles(({ v3 }) => ({
  nest: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    marginBottom: v3.space[10],
    marginHorizontal: v3.space[10],
    overflow: 'hidden',
  },
  nestOff: { opacity: 0.5 },
  // The first row's hairline tucked under the block's edge, as in `SettingsGroupV3`.
  nestInner: { marginTop: -1 },
  nestRow: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  nestText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  nestTitleLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  nestTitle: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '800' },
  caption: { ...v3.type.caption, color: v3.colors.muted },
  locked: { opacity: 0.6 },
}))
