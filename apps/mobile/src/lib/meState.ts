/**
 * Where a launch lands, once `/profiles/me` has settled.
 *
 * The distinction this exists to draw: **a request that failed is not a
 * profile that does not exist.** `index.tsx` read `!profile` as "no profile
 * yet", so a phone with no network — a tunnel, a lift, a basement — restored
 * its session from the keychain cache and then sent a member with a complete
 * profile into the onboarding wizard. Nothing they filled in there could be
 * saved (`createProfile` refuses a second one), and it did not heal when the
 * network came back: the redirect had already happened and `index`, the only
 * screen that asks this question, was gone with it. Only a relaunch fixed it.
 *
 * A 404 is the one answer that means "signed in, no profile" — that is what
 * the route was built to report. Everything else is a failure to answer, and a
 * failure is a screen with a retry button.
 *
 * Pure, and free of `api/client` on purpose: the status is read off the error
 * by `errorStatusOf` at the call site, so this module stays inside what the
 * mobile test setup can load.
 */
export type MeState = 'ready' | 'onboarding' | 'failed'

export function meState(input: {
  hasProfile: boolean
  /** The HTTP status the server answered with, or `undefined` if none did. */
  errorStatus: number | undefined
}): MeState {
  if (input.hasProfile) return 'ready'
  return input.errorStatus === 404 ? 'onboarding' : 'failed'
}
