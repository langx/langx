import type { MessageKey } from '../i18n/runtime'

/**
 * Every address the app sends someone to, in one table.
 *
 * They were scattered across v1's `environment.ts` (which is gitignored, so
 * half of them only exist in a build) and across `website/`'s `Socials.svelte`.
 * Neither is reachable from here, so this is a **hand-kept copy**: when a
 * handle changes on one side it silently goes stale on the other, and nothing
 * checks it. The workspace's `REPO_MAP.md` records the link for the next
 * person.
 *
 * Brand names are written here rather than in `messages/en.ts` on purpose:
 * "Discord" is a name, not copy, and it is the same word in all eight
 * languages. Everything a translator would actually change carries a key.
 */
export interface ExternalLink {
  /** Feather icon name; the screen is what knows about the icon set. */
  icon: string
  /** A brand name, identical in every language. */
  label?: string
  /** Anything a translator would change. Exactly one of these two is set. */
  labelKey?: MessageKey
  url: string
}

export interface LinkSection {
  titleKey: MessageKey
  rows: readonly ExternalLink[]
}

const SITE = 'https://langx.io'
const REPO = 'https://github.com/langx/langx'

/** The five the stores and the law expect to be reachable from inside the app. */
export const LEGAL_LINKS: readonly ExternalLink[] = [
  { icon: 'shield', labelKey: 'legal.privacy', url: `${SITE}/privacy-policy` },
  { icon: 'file-text', labelKey: 'legal.terms', url: `${SITE}/terms-conditions` },
  { icon: 'coffee', labelKey: 'legal.cookies', url: `${SITE}/cookie-policy` },
  { icon: 'trash-2', labelKey: 'legal.dataDeletion', url: `${SITE}/data-deletion` },
  { icon: 'lock', labelKey: 'legal.security', url: `${REPO}/blob/main/SECURITY.md` },
]

/**
 * "Our Kitchen" — v1's About Us page, section for section. What used to be an
 * in-app page there (the contributor list, the backers) is a link here: v2 has
 * no such screens, and a name on a list is worth more where it is maintained
 * than copied into an app release.
 */
export const KITCHEN_SECTIONS: readonly LinkSection[] = [
  {
    titleKey: 'kitchen.contributors',
    rows: [
      { icon: 'users', labelKey: 'kitchen.fundamentals', url: `${REPO}/graphs/contributors` },
      { icon: 'heart', labelKey: 'kitchen.backers', url: 'https://backer.langx.io' },
    ],
  },
  {
    titleKey: 'kitchen.support',
    rows: [
      { icon: 'message-circle', labelKey: 'kitchen.joinDiscord', url: 'https://discord.langx.io' },
      { icon: 'heart', labelKey: 'kitchen.patron', url: 'https://patreon.com/langx' },
      { icon: 'github', labelKey: 'kitchen.sponsor', url: 'https://github.com/sponsors/langx' },
      { icon: 'twitter', labelKey: 'kitchen.followX', url: 'https://x.com/langx_io' },
    ],
  },
  {
    titleKey: 'kitchen.token',
    rows: [
      { icon: 'circle', labelKey: 'kitchen.tokenWebsite', url: 'https://token.langx.io' },
      { icon: 'file-text', labelKey: 'kitchen.litepaper', url: 'https://docs.langx.io' },
    ],
  },
  {
    titleKey: 'kitchen.about',
    rows: [
      { icon: 'globe', labelKey: 'kitchen.website', url: SITE },
      { icon: 'bar-chart-2', labelKey: 'kitchen.insights', url: 'https://insight.langx.io' },
      { icon: 'list', labelKey: 'kitchen.backlog', url: 'https://backlog.langx.io' },
      { icon: 'github', label: 'GitHub', url: 'https://github.com/langx' },
      { icon: 'tag', labelKey: 'kitchen.releases', url: `${REPO}/releases` },
      { icon: 'alert-circle', labelKey: 'kitchen.issues', url: `${REPO}/issues` },
      {
        icon: 'git-branch',
        labelKey: 'kitchen.contributing',
        url: `${REPO}/blob/main/CONTRIBUTING.md`,
      },
      { icon: 'activity', labelKey: 'kitchen.status', url: 'https://status.langx.io' },
    ],
  },
  {
    titleKey: 'kitchen.social',
    rows: [
      { icon: 'message-circle', label: 'Discord', url: 'https://discord.langx.io' },
      { icon: 'message-square', label: 'Reddit', url: 'https://reddit.com/r/langx' },
      { icon: 'twitter', label: 'X', url: 'https://x.com/langx_io' },
      { icon: 'cloud', label: 'Bluesky', url: 'https://bsky.app/profile/langx.io' },
      { icon: 'send', label: 'Telegram', url: 'https://t.me/langxapp' },
      { icon: 'instagram', label: 'Instagram', url: 'https://instagram.com/langxapp' },
      { icon: 'music', label: 'TikTok', url: 'https://www.tiktok.com/@langXapp' },
      { icon: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/langxapp' },
      { icon: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@langxapp' },
      {
        icon: 'linkedin',
        label: 'LinkedIn',
        url: 'https://www.linkedin.com/company/new-chapter-technology-limited-liability-company',
      },
      { icon: 'edit-3', labelKey: 'kitchen.blog', url: 'https://blog.langx.io' },
    ],
  },
  {
    titleKey: 'kitchen.licenses',
    rows: [
      // v1 listed BSD-3 *and* MIT here, both pointing at the same file. This
      // repo has one licence and one LICENSE, so it says so once.
      { icon: 'file', label: 'BSD-3-Clause', url: `${REPO}/blob/main/LICENSE` },
      {
        icon: 'smile',
        labelKey: 'kitchen.codeOfConduct',
        url: `${REPO}/blob/main/CODE_OF_CONDUCT.md`,
      },
      { icon: 'lock', labelKey: 'legal.security', url: `${REPO}/blob/main/SECURITY.md` },
    ],
  },
]

/** Everything above, flat — for the test and for anything that needs a sweep. */
export function allExternalLinks(): readonly ExternalLink[] {
  return [...LEGAL_LINKS, ...KITCHEN_SECTIONS.flatMap((section) => section.rows)]
}
