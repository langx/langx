import { HANDLE_PATTERN } from './handle'

/**
 * Handles nobody may take, because a profile lives at `/<handle>`.
 *
 * A root-level route makes every top-level path a potential collision. Static
 * routes win over the dynamic one, so taking `discover` would not break the
 * Discover screen — it would break *that user*, whose link silently resolves
 * to somebody else's page. The person who loses is the one who did nothing
 * wrong, which is why this is enforced at claim time rather than left to
 * whoever gets there first.
 *
 * Two halves, and only one of them is maintained by hand.
 *
 * `ROUTE_RESERVED` mirrors the `app/` tree. `routeLiterals.test.ts` walks that
 * tree already, and a test there asserts every route segment that could
 * legally be a handle appears below — so adding a screen without reserving its
 * name fails CI rather than shipping. Adding one here that no longer has a
 * screen is harmless; the list only ever needs to be a superset.
 */
const ROUTE_RESERVED = [
  'badges',
  'blocked',
  'chat',
  'chats',
  'compose',
  'corrections',
  'corrections',
  'discover',
  'done',
  'feed',
  'filters',
  'follows',
  'handle',
  'index',
  'invite',
  'scan',
  'link',
  'intro',
  'kitchen',
  'languages',
  'leaderboard',
  'learning',
  'levels',
  'likes',
  'me',
  'paywall',
  'photo',
  'post',
  'profile',
  'settings',
  'starred',
  'streak',
  'store',
  'tokens',
  'viewers',
  'welcome',
  'wallet',
] as const

/**
 * Words the app does not route to today but must never hand out: things a
 * future page will want, things infrastructure answers on, and the handful
 * that would let somebody impersonate the product.
 */
const INFRASTRUCTURE_RESERVED = [
  'about',
  'account',
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'blog',
  'cdn',
  'contact',
  'developers',
  'docs',
  'download',
  'help',
  'home',
  'jobs',
  'langx',
  'legal',
  'login',
  'logout',
  'mail',
  'new',
  'news',
  'null',
  'official',
  'press',
  'qr',
  'pricing',
  'privacy',
  'public',
  'register',
  'root',
  'search',
  'security',
  'signin',
  'signout',
  'signup',
  'static',
  'status',
  'support',
  'system',
  'team',
  'terms',
  'token',
  'undefined',
  'well_known',
  'www',
] as const

export const RESERVED_HANDLES: ReadonlySet<string> = new Set<string>([
  ...ROUTE_RESERVED,
  ...INFRASTRUCTURE_RESERVED,
])

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.trim().toLowerCase())
}

/**
 * Whether a string could be somebody's handle at all.
 *
 * Used by the test that keeps `ROUTE_RESERVED` honest: a route segment
 * containing a hyphen (`edit-profile`) or brackets (`[handle]`) can never
 * collide with a handle, so demanding it be reserved would be noise.
 */
export function couldBeHandle(segment: string): boolean {
  return HANDLE_PATTERN.test(segment)
}
