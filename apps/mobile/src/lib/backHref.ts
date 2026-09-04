import type { Href } from 'expo-router'

/**
 * Where a full-screen route's back control should go when there is nothing to
 * pop.
 *
 * Until 4 September 2026 every screen under `(app)` was a `Tabs.Screen` with
 * `href: null`, so nothing was ever pushed and `router.back()` reset to the
 * first tab; every back control was a `replace` through this. The area is a
 * stack now and `goBackTo` pops first — this is the fallback for a deep link
 * opened in a fresh tab, where the history is empty and the `from` param is
 * the only record of where the reader came from.
 *
 * Separate file from `navigation.ts` so this stays testable — importing
 * `expo-router` for a value pulls in react-native, which the mobile test setup
 * cannot parse.
 */
export function backHref(from: string | undefined, fallback: Href): Href {
  return isAppRoute(from) ? from : fallback
}

/**
 * `from` arrives as a string off a URL, which anyone can write. Only routes
 * inside the signed-in area are honoured — a back button is not a place to
 * accept an arbitrary destination.
 *
 * Exported, because `navigation.ts` needs the same narrowing for the routes it
 * composes — and needs it to be a *predicate* for the reason below.
 *
 * A type predicate rather than a cast at the call site, and not for style.
 * `Href` is whatever expo-router's generated route types say it is: a union of
 * the app's route literals once `expo start` has written them, and a loose
 * string when it has not. So a cast is *required* locally and *redundant* in
 * CI, and either way one of the two lints fails. Asserting the narrowing here
 * is the honest description anyway — this is the trust boundary where a
 * checked string becomes a route.
 */
export function isAppRoute(value: string | undefined): value is Href & string {
  return typeof value === 'string' && value.startsWith('/(app)/') && !value.includes('..')
}
