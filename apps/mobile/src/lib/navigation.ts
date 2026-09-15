import { router, type Href } from 'expo-router'
import { backHref, isAppRoute } from './backHref'
import { profileHref } from './profileHref'

/**
 * Go to this screen's parent.
 *
 * Pops when there is something to pop — which, now that the signed-in area is
 * a stack, is every screen reached by a push — and otherwise replaces to
 * where the caller says it came from, or to its fallback. The second branch is
 * the web deep link: a `/profile/sofia` opened in a fresh tab has no history,
 * and the `from` param is how the header's arrow still knows where to go.
 */
export function goBackTo(fallback: Href, from?: string): void {
  if (router.canGoBack()) {
    router.back()
    return
  }
  router.replace(backHref(from, fallback))
}

/**
 * Push a route this app composed itself.
 *
 * The narrowing goes through `isAppRoute` rather than an `as Href`, and that is
 * not a style preference — it is the only spelling that survives both worlds.
 * `Href` is a union of generated route literals once `expo start` has written
 * them and a plain string when it has not, so an assertion is *required*
 * locally and *redundant* in CI, and `no-unnecessary-type-assertion` fails on
 * whichever of the two it is not. A predicate is not an assertion expression,
 * so it narrows in both worlds and is flagged in neither. `backHref` documents
 * the same trap from the other side; this is what it costs to meet it with a
 * cast instead.
 *
 * It throws rather than quietly not navigating: the only way to fail here is to
 * have composed the route wrong, and a button that silently does nothing is a
 * worse bug than a loud one.
 */
function push(href: string): void {
  // Held separately because the failing branch narrows `href` to `never` in the
  // world where `Href` is a plain string — leaving a thrown message that cannot
  // name the route it is complaining about.
  const attempted: string = href
  if (!isAppRoute(href)) throw new Error(`Not an app route: ${attempted}`)
  router.push(href)
}

/** Open somebody's profile, remembering where to come back to. */
export function openProfile(handle: string, from: string): void {
  push(profileHref(handle, from))
}

/** Open the thread on a post — the sentence and every correction of it. */
export function openPost(postId: string, from: string): void {
  push(`/(app)/post/${postId}?from=${encodeURIComponent(from)}`)
}

/**
 * Open whatever a notification row is about.
 *
 * Takes a finished href rather than the row, so `notificationInbox` can decide
 * the destination without importing `expo-router` — that module has to stay
 * loadable by vitest, which cannot parse the native side of it.
 */
export function openNotification(href: string): void {
  push(href)
}

/**
 * The languages screen, and its picker.
 *
 * Helpers rather than `router.push` at the call sites for the reason the whole
 * file exists — `Href` is a generated union locally and a plain string in CI,
 * so a literal has to go through `isAppRoute` to narrow in both worlds. The
 * picker takes `replacing` when it is changing a language rather than adding
 * one, which is the difference between a write that keeps the list's length
 * and one that grows it.
 */
export function openLanguages(from?: string): void {
  // Two whole literals rather than one with the query interpolated onto the
  // end: `routeLiterals.test.ts` reads an interpolation as a wildcard path
  // segment, so `/(app)/languages${…}` asks it to find a screen one level
  // deeper than the one this opens.
  push(from ? `/(app)/languages?from=${encodeURIComponent(from)}` : '/(app)/languages')
}

export function openLanguagePicker(list: 'native' | 'learning', replacing?: string): void {
  push(`/(app)/languages/pick?list=${list}${replacing ? `&replacing=${replacing}` : ''}`)
}

/** Who liked one post or one correction. */
export function openLikers(targetType: string, targetId: string, from: string): void {
  push(
    `/(app)/likes?targetType=${targetType}&targetId=${targetId}&from=${encodeURIComponent(from)}`,
  )
}

/** Somebody's followers, or the people they follow. */
export function openFollows(userId: string, tab: 'followers' | 'following', from: string): void {
  push(`/(app)/follows?userId=${userId}&tab=${tab}&from=${encodeURIComponent(from)}`)
}
