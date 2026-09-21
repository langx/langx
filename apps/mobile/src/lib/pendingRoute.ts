import type { Href } from 'expo-router'

/**
 * Where a route left by an App Intent is allowed to land.
 *
 * It was two string comparisons inside `usePendingRoute` while there were two
 * routes. `OpenConversationIntent` writes `/chat/<id>`, which cannot be
 * compared against a constant, so the rule moved here — pure, and therefore
 * tested, which is the point of the move rather than a side effect of it.
 *
 * **An allowlist, although the value is ours.** The App Group container is
 * written only by this app and its own extensions, so this is not a trust
 * boundary in the way a push payload is. It is still checked: an intent from
 * a build newer than the app can leave a route this version has no screen
 * for, and `router.push` of a path that does not exist is a blank screen with
 * nothing to say why. Returning null lands the person wherever they already
 * were.
 *
 * `Href` is a type-only import for the reason `notificationRoute.ts` gives:
 * typed routes make `router.push` reject a plain string, and a value import
 * of `expo-router` would pull native modules into a file vitest loads
 * directly.
 */
export function pendingRouteHref(route: string | null): Href | null {
  if (route === '/echo' || route === '/chats') return route

  /*
   * The id is bounded rather than merely non-empty. Anything past the prefix
   * goes into a path, so the shape that is accepted is the shape the app's
   * own ids have — hex, and the length Mongo's are — instead of "not empty",
   * which would accept a traversal or a query string as readily as an id.
   */
  const conversation = /^\/chat\/([a-f\d]{1,64})$/.exec(route ?? '')
  return conversation ? `/chat/${conversation[1]}` : null
}
