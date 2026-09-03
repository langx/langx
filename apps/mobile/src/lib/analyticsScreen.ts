/**
 * The screen name sent with every `$screen` event, from expo-router's segments.
 *
 * Segments rather than the pathname, and that is the whole point: `useSegments`
 * returns the route *files* — `['(app)', 'chat', '[id]']` — where `usePathname`
 * returns the URL with its values filled in. A conversation id, a handle or a
 * post id in a screen name is an identifier leaving the device for no reason,
 * and the funnel does not need it: it asks whether people reach the chat
 * screen, not which chat.
 *
 * The group segments stay. `(auth)/intro` and `(app)/intro` are different
 * screens with the same file name, and the parentheses are what tells them
 * apart.
 */
export function screenNameFromSegments(segments: readonly string[]): string {
  if (segments.length === 0) return 'index'
  return segments.join('/')
}
