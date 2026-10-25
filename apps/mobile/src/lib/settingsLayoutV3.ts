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
    { ids: ['about.community', 'about.moderators', 'about.rate'] },
    { ids: ['about.intro', 'about.tour'] },
  ],
}

/**
 * The rows `SettingsRowV3` draws, one case each. Its switch is exhaustive
 * over this list, so an id here without a case does not compile — and the
 * test holds this list, the blocks below and the registry to each other, so a
 * row placed above cannot fall through to a `default` that draws nothing.
 */
export const V3_ROW_IDS = [
  'privacy.hiddenMode',
  'privacy.boost',
  'privacy.activityMap',
  'privacy.weekChart',
  'privacy.hideCity',
  'privacy.allowCalls',
  'privacy.shareLocation',
  'privacy.updateLocation',
  'privacy.locationPermission',
  'privacy.analytics',
  'notifications.thisDevice',
  'notifications.permission',
  'appearance.language',
  'appearance.translateTo',
  'appearance.tips',
  'account.username',
  'account.signIn',
  'account.password',
  'account.devices',
  'account.blocked',
  'account.allPhrases',
  'account.export',
  'about.legal',
  'about.voices',
  'about.reportBug',
  'about.requestFeature',
  'about.community',
  'about.moderators',
  'about.rate',
  'about.intro',
  'about.tour',
] as const
export type V3RowId = (typeof V3_ROW_IDS)[number]

export function isV3RowId(id: string): id is V3RowId {
  return (V3_ROW_IDS as readonly string[]).includes(id)
}

/**
 * Rows a page draws as a block of its own rather than through
 * `SettingsRowV3`: the plan and share pages whole, and the three groups
 * `SettingsSectionPageV3` recognises by their one id.
 */
export const V3_BLOCK_IDS: ReadonlySet<string> = new Set([
  'plan.current',
  'plan.renewal',
  'plan.manage',
  'plan.features',
  'plan.upgrade',
  'share.profile',
  'share.invite',
  'appearance.theme',
  'appearance.appIcon',
  'account.delete',
])

/** The groups `SettingsSectionPageV3` swaps for a block, by their one id. */
export const V3_SOLO_BLOCK_IDS: ReadonlySet<string> = new Set([
  'appearance.theme',
  'appearance.appIcon',
  'account.delete',
])

/**
 * The privacy rows drawn inside hidden mode's own block, under its switch,
 * greyed out while it is off — today's indented rows. `HiddenModeNestV3`
 * draws these four by name, so the test pins the set to them.
 */
export const HIDDEN_MODE_CHILDREN: ReadonlySet<string> = new Set([
  'privacy.discoverable',
  'privacy.hideOnline',
  'privacy.refuseNewChats',
  'privacy.incognito',
])
