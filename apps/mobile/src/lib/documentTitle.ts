import type { MessageKey } from '../i18n/runtime'
import { unreadBadge } from './unreadBadge'

/**
 * The browser tab's title on the web build.
 *
 * expo-router turns React Navigation's own document title off, so nothing
 * names a page unless something here does. A pure module for the reason the
 * others in `src/lib` are: vitest reaches nothing else.
 */

/**
 * Which heading each page's tab carries, by the path the browser shows —
 * groups like `(app)` and `(tabs)` never appear in it.
 *
 * The keys are the ones the screens already draw as their own heading, so the
 * tab and the page say the same word in the reader's language. A path missing
 * from here is not an error: its tab reads "LangX", which is what every tab
 * read before this. Onboarding is left out on purpose — it is one flow, and a
 * title per step would announce a change the person did not make.
 */
const PAGE_TITLES: Readonly<Record<string, MessageKey>> = {
  '/discover': 'tabs.discover',
  '/chats': 'tabs.chats',
  '/echo': 'tabs.echo',
  '/feed': 'tabs.feed',
  '/me': 'tabs.me',
  '/notifications': 'inbox.title',
  '/all-phrases': 'chat.allPhrases',
  '/app-language': 'settings.appLanguage',
  '/badges': 'leaderboard.badges',
  '/blocked': 'blocked.title',
  '/chat-media': 'chatMedia.title',
  '/corrections': 'corrections.combinedTitle',
  '/echo/cards': 'echo.cards',
  '/echo/edit': 'echo.editTitle',
  '/echo/leaderboard': 'leaderboard.title',
  '/echo/new': 'echo.newTitle',
  '/echo/packs': 'echo.packs',
  '/echo/session': 'echo.title',
  '/edit-profile': 'editProfile.title',
  '/filters': 'filters.title',
  '/gift': 'gift.title',
  '/how-it-works': 'howItWorks.title',
  '/invite': 'invite.title',
  '/kitchen': 'kitchen.title',
  '/languages': 'languages.title',
  '/legal': 'settings.legalSection',
  '/link-device': 'linkDevice.title',
  '/paywall': 'paywall.screenTitle',
  '/phrases': 'chat.phraseDeck',
  '/post-corrections': 'corrections.publicTitle',
  '/scan': 'scan.title',
  '/share-profile': 'shareProfile.title',
  '/starred': 'starred.title',
  '/stickers': 'chat.stickers',
  '/streak': 'streak.title',
  '/streak/history': 'tokens.history',
  '/streak/leaderboard': 'leaderboard.streakTitle',
  '/translate-language': 'settings.translateTo',
  '/viewers': 'viewers.title',
  '/wallet': 'wallet.title',
  '/wallet/history': 'tokens.history',
  '/wallet/leaderboard': 'leaderboard.title',
  '/wallet/pool': 'tokens.poolTitle',
  '/wallet/store': 'wallet.storeTitle',
  '/settings': 'settings.title',
  '/settings/about': 'settings.aboutSection',
  '/settings/account': 'settings.accountSection',
  '/settings/appearance': 'settings.appearanceSection',
  '/settings/delete-account': 'settings.deleteAccount',
  '/settings/notifications': 'settings.notificationsSection',
  '/settings/password': 'settings.changePassword',
  '/settings/plan': 'settings.subscriptionSection',
  '/settings/privacy': 'settings.privacySection',
  '/settings/push': 'settings.pushThisDevice',
  '/settings/share': 'settings.shareSection',
  '/settings/sign-in-methods': 'settings.signInMethods',
  '/settings/username': 'settings.usernameTitle',
  '/settings/voices': 'settings.voiceCredits',
  '/sign-in': 'auth.signIn',
  '/sign-up': 'auth.signUp',
  '/forgot-password': 'auth.resetTitle',
  '/reset-password': 'auth.resetTitle',
  '/check-email': 'auth.checkEmailTitle',
  '/qr': 'linkDevice.title',
  '/suspended': 'suspended.title',
}

/**
 * The prefix a dynamic page falls back to while its own name is loading. A
 * thread and a profile replace it with the person's name once they have it;
 * see `WebTitle`.
 */
const DYNAMIC_TITLES: readonly (readonly [string, MessageKey])[] = [
  ['/chat/', 'chat.title'],
  ['/echo/card/', 'echo.cardTitle'],
  ['/echo/pack/', 'echo.packs'],
]

export function pageTitleKey(pathname: string): MessageKey | undefined {
  // A trailing slash is the same page: `/settings/` must not lose its title.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PAGE_TITLES[path] ?? DYNAMIC_TITLES.find(([prefix]) => path.startsWith(prefix))?.[1]
}

export const APP_TITLE = 'LangX'

/**
 * `(3) Chats · LangX`.
 *
 * The count leads because a pinned or crowded tab shows only the first few
 * characters, and the count is the part worth seeing from another tab. It is
 * capped like the Chats tab's badge, from the same function, so the two can
 * never disagree about what "99+" means.
 */
export function documentTitle(page: string | undefined, unread: number | undefined): string {
  const name = page?.trim()
  // The `@langx` channel is called LangX, and "LangX · LangX" says nothing twice.
  const base = name && name !== APP_TITLE ? `${name} · ${APP_TITLE}` : APP_TITLE
  const count = unreadBadge(unread)
  return count ? `(${count}) ${base}` : base
}
