import type { MessageKey } from '../i18n'
import type { SettingsSectionId } from './settingsRegistry'

/**
 * How each Settings page is grouped under `flags.v3Home` (`V-Set*`).
 *
 * Grouping only: which rows exist, and what each does, is still
 * `SETTINGS_SECTIONS` and the row components. The drawings put today's flat
 * lists into grey blocks, some under a heading, and this is that split —
 * kept apart from the components so a test can hold it to the registry: a
 * row added there and forgotten here would exist in the search and on the
 * old page, and silently nowhere on the new one.
 */
export interface SettingsGroupLayout {
  headingKey?: MessageKey
  ids: readonly string[]
  /**
   * `notifications`: the kinds, drawn as one table with a switch column per
   * channel rather than a block of rows.
   */
  kind?: 'notifications'
}

export const SETTINGS_V3_LAYOUT: Record<SettingsSectionId, readonly SettingsGroupLayout[]> = {
  plan: [
    { ids: ['plan.current'] },
    { ids: ['plan.renewal', 'plan.manage'] },
    { ids: ['plan.features'] },
    { ids: ['plan.upgrade'] },
  ],
  share: [{ ids: ['share.profile', 'share.invite'] }],
  privacy: [
    {
      headingKey: 'settings.findYouHeading',
      ids: [
        'privacy.hiddenMode',
        'privacy.discoverable',
        'privacy.hideOnline',
        'privacy.refuseNewChats',
        'privacy.incognito',
      ],
    },
    {
      headingKey: 'settings.whatTheySeeHeading',
      ids: ['privacy.boost', 'privacy.activityMap', 'privacy.weekChart', 'privacy.hideCity'],
    },
    {
      headingKey: 'settings.callsLocationHeading',
      ids: [
        'privacy.allowCalls',
        'privacy.shareLocation',
        'privacy.updateLocation',
        'privacy.locationPermission',
      ],
    },
    { ids: ['privacy.analytics'] },
  ],
  notifications: [
    { ids: ['notifications.thisDevice', 'notifications.permission'] },
    {
      headingKey: 'settings.whatReachesYouHeading',
      kind: 'notifications',
      ids: [
        'notifications.messages',
        'notifications.streak',
        'notifications.badges',
        'notifications.profileVisits',
        'notifications.meetings',
        'notifications.social',
        'notifications.wallet',
        'notifications.echo',
        'notifications.promotions',
      ],
    },
  ],
  appearance: [
    { ids: ['appearance.theme'] },
    { ids: ['appearance.appIcon'] },
    { ids: ['appearance.language', 'appearance.translateTo', 'appearance.tips'] },
  ],
  account: [
    { ids: ['account.username'] },
    { ids: ['account.signIn', 'account.password', 'account.devices'] },
    { ids: ['account.blocked'] },
    { ids: ['account.allPhrases', 'account.export'] },
    { ids: ['account.delete'] },
  ],
  about: [
    { ids: ['about.legal', 'about.voices'] },
    { ids: ['about.reportBug', 'about.requestFeature'] },
    { ids: ['about.community', 'about.rate'] },
    { ids: ['about.intro', 'about.tour'] },
  ],
}

/**
 * The privacy rows drawn inside hidden mode's own block, under its switch,
 * greyed out while it is off — today's indented rows.
 */
export const HIDDEN_MODE_CHILDREN: ReadonlySet<string> = new Set([
  'privacy.discoverable',
  'privacy.hideOnline',
  'privacy.refuseNewChats',
  'privacy.incognito',
])
