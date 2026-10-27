/**
 * The pages a guest who opens the app at their address lands on, rather than
 * on Home: the four public product pages, which describe something to anyone
 * and ask nothing of an account.
 *
 * An allow-list because every other address in `(app)` keeps landing a guest
 * on Home, as it always has. Settings, the Kitchen, a thread — those are an
 * account's own pages, and a guest following a link to one has nothing there.
 *
 * Keyed by the address's one path segment; the values are the routes, written
 * with their group so `routeLiterals.test.ts` checks each one exists.
 */
export const GUEST_LINK_PAGES = {
  token: '/(app)/token',
  transparency: '/(app)/transparency',
  venus: '/(app)/venus',
  copilot: '/(app)/copilot',
} as const

export type GuestLinkPage = (typeof GUEST_LINK_PAGES)[keyof typeof GUEST_LINK_PAGES]

/**
 * The page an address names, when it is one of `GUEST_LINK_PAGES`; null for
 * anything else, a deeper path under one of them included.
 *
 * Reads the web build's own address, an app link (`https://app.langx.io/venus`)
 * and the app's scheme alike. Not `new URL`, for the reason
 * `inviteHandleFromUrl` gives: under `langx://venus` the page sits where a host
 * would, and runtimes disagree about whether that lands in `hostname` or in
 * `pathname`. So a web address loses its host, the app's scheme only its
 * scheme, and whatever is left is read as the path.
 */
export function guestLinkPage(url: string | null | undefined): GuestLinkPage | null {
  if (!url) return null
  const address = url.split(/[?#]/)[0] ?? ''
  const path = /^https?:/i.test(address)
    ? address.replace(/^https?:\/\/[^/]*/i, '')
    : address.replace(/^[a-z][a-z0-9+.-]*:/i, '')
  const segments = path.split('/').filter(Boolean)
  if (segments.length !== 1) return null
  // A lookup by key would answer "constructor" with a function.
  return Object.entries(GUEST_LINK_PAGES).find(([key]) => key === segments[0])?.[1] ?? null
}
