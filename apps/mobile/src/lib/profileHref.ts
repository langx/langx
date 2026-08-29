/**
 * The route to somebody's profile, carrying where to come back to.
 *
 * The screen it points at is a full-screen route, so it has no back stack of
 * its own — `from` is how it finds its way home, and `backHref` is what decides
 * whether to trust the value. Encoding it here rather than at each call site is
 * the point: it was written out by hand in four places, none of which agreed
 * about anything except by accident.
 *
 * Separate file from `navigation.ts`, for the reason stated on `backHref`:
 * importing `expo-router` for a value pulls in react-native, which the mobile
 * test setup cannot parse, and this is worth testing.
 */
export function profileHref(handle: string, from: string): string {
  // Handles arrive both ways — `feedAuthorSchema.handle` is bare, anything
  // copied out of a mention is not — and the route segment must be bare.
  const bare = handle.startsWith('@') ? handle.slice(1) : handle
  return `/(app)/profile/${bare}?from=${encodeURIComponent(from)}`
}
