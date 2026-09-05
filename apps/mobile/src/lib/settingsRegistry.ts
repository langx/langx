import { NOTIFICATION_TYPES } from '@langx/shared'
import type { MessageKey, TranslateFn } from '../i18n'

/**
 * Every setting the app has, as data.
 *
 * Settings was one 714-line scroll: nine kicker headings over thirty-four
 * rows, with no grouping beyond the kicker. It is categories with sub-pages
 * now, and the same list draws three things that must never disagree — the
 * landing page's categories, each category's page, and the search results
 * at the top of the landing page. A row that exists here exists in all three;
 * one that does not, exists nowhere. `SettingsRow` is the other half: it
 * turns an id into the live control.
 */
export type SettingsSectionId =
  'plan' | 'privacy' | 'notifications' | 'appearance' | 'account' | 'about'

export interface SettingsItem {
  id: string
  titleKey: MessageKey
  bodyKey?: MessageKey
}

export interface SettingsSection {
  id: SettingsSectionId
  titleKey: MessageKey
  /** One line under the category on the landing page. */
  bodyKey: MessageKey
  route: `/(app)/settings/${SettingsSectionId}`
  items: readonly SettingsItem[]
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'plan',
    titleKey: 'settings.subscriptionSection',
    bodyKey: 'settings.subscriptionBody',
    route: '/(app)/settings/plan',
    items: [
      { id: 'plan.current', titleKey: 'settings.currentPlan' },
      { id: 'plan.renewal', titleKey: 'settings.plan' },
      { id: 'plan.upgrade', titleKey: 'settings.upgrade' },
      { id: 'plan.manage', titleKey: 'settings.manageSubscription' },
    ],
  },
  {
    id: 'privacy',
    titleKey: 'settings.privacySection',
    bodyKey: 'settings.privacyBody',
    route: '/(app)/settings/privacy',
    items: [
      {
        id: 'privacy.discoverable',
        titleKey: 'settings.showInDiscover',
        bodyKey: 'settings.showInDiscoverBody',
      },
      {
        id: 'privacy.incognito',
        titleKey: 'settings.incognito',
        bodyKey: 'settings.incognitoBody',
      },
      {
        id: 'privacy.activityMap',
        titleKey: 'settings.activityMap',
        bodyKey: 'settings.activityMapBody',
      },
      { id: 'privacy.stats', titleKey: 'settings.showStats', bodyKey: 'settings.showStatsBody' },
      {
        id: 'privacy.hideOnline',
        titleKey: 'settings.hideOnline',
        bodyKey: 'settings.hideOnlineBody',
      },
      { id: 'privacy.hideCity', titleKey: 'settings.hideCity', bodyKey: 'settings.hideCityBody' },
      {
        id: 'privacy.shareLocation',
        titleKey: 'settings.shareLocation',
        bodyKey: 'settings.shareLocationBody',
      },
      { id: 'privacy.updateLocation', titleKey: 'settings.updateLocation' },
      {
        id: 'privacy.analytics',
        titleKey: 'settings.shareUsage',
        bodyKey: 'settings.shareUsageBody',
      },
    ],
  },
  {
    id: 'notifications',
    titleKey: 'settings.notificationsSection',
    bodyKey: 'settings.notificationsBody',
    route: '/(app)/settings/notifications',
    items: [
      /*
       * First, above the kinds, because it outranks them: the kinds say
       * *what* and are account-wide, this says *where* and belongs to the
       * phone it is read on. Turning it off here leaves the account's other
       * devices receiving.
       */
      {
        id: 'notifications.thisDevice',
        titleKey: 'settings.pushThisDevice',
        bodyKey: 'settings.pushThisDeviceBody',
      },
      // Then one item per kind; the row draws the kind's two channels under it.
      ...NOTIFICATION_TYPES.map((type) => ({
        id: `notifications.${type}`,
        titleKey: `notifications.${type}` as MessageKey,
        bodyKey: `notifications.${type}Body` as MessageKey,
      })),
    ],
  },
  {
    id: 'appearance',
    titleKey: 'settings.appearanceSection',
    bodyKey: 'settings.appearanceBody',
    route: '/(app)/settings/appearance',
    items: [
      { id: 'appearance.theme', titleKey: 'theme.section' },
      { id: 'appearance.appIcon', titleKey: 'settings.appIcon', bodyKey: 'settings.appIconBody' },
      { id: 'appearance.language', titleKey: 'settings.appLanguage' },
      { id: 'appearance.tips', titleKey: 'tips.show', bodyKey: 'tips.showBody' },
    ],
  },
  {
    id: 'account',
    titleKey: 'settings.accountSection',
    bodyKey: 'settings.accountBody',
    route: '/(app)/settings/account',
    items: [
      {
        id: 'account.signIn',
        titleKey: 'settings.signInMethods',
        bodyKey: 'settings.signInMethodsBody',
      },
      { id: 'account.devices', titleKey: 'linkDevice.title', bodyKey: 'settings.linkDeviceBody' },
      { id: 'account.blocked', titleKey: 'settings.blockedPeople' },
      { id: 'account.export', titleKey: 'settings.exportData' },
      { id: 'account.delete', titleKey: 'settings.deleteAccount' },
    ],
  },
  {
    id: 'about',
    titleKey: 'settings.aboutSection',
    bodyKey: 'settings.aboutBody',
    route: '/(app)/settings/about',
    items: [
      { id: 'about.legal', titleKey: 'settings.legalSection' },
      { id: 'about.community', titleKey: 'kitchen.title', bodyKey: 'kitchen.intro' },
      { id: 'about.intro', titleKey: 'settings.showIntro' },
    ],
  },
]

export function settingsSection(id: SettingsSectionId): SettingsSection {
  const section = SETTINGS_SECTIONS.find((s) => s.id === id)
  if (!section) throw new Error(`No settings section ${id}`)
  return section
}

export interface SettingsMatch {
  section: SettingsSection
  item: SettingsItem
}

/** Lower-cased, with diacritics stripped, so "turkce" finds "Türkçe" and "Ubersetzung" finds "Übersetzung". */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * The rows whose *localized* title or body contains the query. Over the
 * translations rather than a keyword table, so it works in all eight
 * languages without one being written; under two characters, nothing —
 * "no results" under a single letter would be answering a question nobody
 * finished asking.
 */
export function matchSettings(
  sections: readonly SettingsSection[],
  query: string,
  t: TranslateFn,
): SettingsMatch[] {
  const needle = fold(query.trim())
  if (needle.length < 2) return []
  const matches: SettingsMatch[] = []
  for (const section of sections) {
    for (const item of section.items) {
      const haystack = fold(`${t(item.titleKey)} ${item.bodyKey ? t(item.bodyKey) : ''}`)
      if (haystack.includes(needle)) matches.push({ section, item })
    }
  }
  return matches
}
