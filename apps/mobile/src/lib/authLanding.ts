/**
 * Where a signed-out user belongs: the welcome screen, always.
 *
 * A shared function rather than the literal at each call site, because there
 * are three of them — the group's entry point, signing out, and deleting an
 * account.
 *
 * Routing to `/(auth)` and letting the group's index decide would say it once
 * instead. It is not done that way because route strings are not checked in
 * this checkout: `typedRoutes` is on, but no declaration is generated outside
 * a running Expo process, so `tsc` accepts any string here and a group path
 * that failed to resolve would be silent.
 */
export type AuthLandingHref = '/(auth)/welcome'

/**
 * There is no intro in front of this any more.
 *
 * Three slides of copy used to play before a welcome screen that already
 * showed what the first slide described — two screens describing an exchange
 * before one was offered, on the launch that decides whether there is a
 * second. What the other two slides said is now two lines on the welcome
 * screen itself, and the carousel survives behind Settings → "Show intro
 * again" for anyone who wants it.
 *
 * `introSeen` is deliberately still written by nothing and read by nothing:
 * an OTA update that rolls back to a build which reads it must find whatever
 * it left there, not a flag this version invented.
 */
export function authLandingHref(): AuthLandingHref {
  return '/(auth)/welcome'
}
