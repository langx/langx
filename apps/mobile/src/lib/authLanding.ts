/**
 * Where a signed-out user belongs: the intro until it has been watched, the
 * sign-in form from then on.
 *
 * A shared function rather than the literal at each call site, because there
 * are three of them — the group's entry point, signing out, and deleting an
 * account — and the one that forgets to look at the flag is the one that makes
 * Settings' "Show intro again" appear broken while nothing fails.
 *
 * Routing to `/(auth)` and letting the group's index decide would say it once
 * instead. It is not done that way because route strings are not checked in
 * this checkout: `typedRoutes` is on, but no declaration is generated outside
 * a running Expo process, so `tsc` accepts any string here and a group path
 * that failed to resolve would be silent.
 */
export type AuthLandingHref = '/(auth)/intro' | '/(auth)/sign-in'

export function authLandingHref(seenIntro: boolean): AuthLandingHref {
  return seenIntro ? '/(auth)/sign-in' : '/(auth)/intro'
}
