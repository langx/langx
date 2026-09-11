import { webUrl } from './appIdentity'

/**
 * Links that go in an email and are spent by the app.
 *
 * A file of its own, and that is the whole point: **`appIdentity.ts` and
 * `appScheme.ts` are inputs to the runtime fingerprint**. `app.config.ts`
 * imports them by path, so `@expo/fingerprint` hashes their contents — and
 * the runtime version is what decides which binaries an OTA update may reach.
 * Editing either file, even to add a function nothing in the config calls,
 * changes that hash and cuts every already-shipped build off from every
 * update published afterwards. It happened once (10 September 2026, PR #1279)
 * and the symptom is silence: the update publishes, CI is green, and no phone
 * ever sees it. See `docs/decisions.md` → _Two files that must not be edited_.
 *
 * Importing them from here is free. The hazard is only in changing *their*
 * bytes.
 */

/**
 * Where an emailed address-verification link points: the app's own page,
 * carrying the token, and **not** Better Auth's `/verify-email` endpoint.
 *
 * The same reasoning as `magicLinkUrl`, and for a while the same bug. Better
 * Auth's own URL is a GET that spends the token and, with
 * `autoSignInAfterVerification`, sets the session cookie on whatever followed
 * it — the mail client's browser. The app never saw that session, so a new
 * account had to type its password a second time to get in. Our page spends
 * the token from inside the app instead, and the session lands where the
 * person is.
 */
export function verifyEmailUrl(token: string): string {
  return webUrl(`/verify-email?token=${encodeURIComponent(token)}`)
}
