/**
 * v2 ships as an update to the live App Store / Play Store listings, not a
 * new app, so both URL schemes have to keep working:
 *
 * - `langx` is the scheme this rewrite registers going forward.
 * - `tech.newchapter.languagexchange` (lowercase x) is what v1
 *   (`langx-angular` 0.15.0) already registered. Dropping it breaks every
 *   deep link already shared or bookmarked by an installed v1 user.
 *
 * One source of truth because two things have to agree on it: Expo's
 * `scheme` config (`apps/mobile/app.config.ts`) and the API's Better Auth
 * `trustedOrigins` (`apps/api/src/auth.ts`) — the OAuth redirect back into
 * the app is rejected unless the API trusts the scheme it's redirecting to.
 */
export const APP_SCHEME = 'langx'
export const V1_URL_SCHEME = 'tech.newchapter.languagexchange'
export const APP_SCHEMES = [APP_SCHEME, V1_URL_SCHEME] as const

/**
 * What that QR actually encodes: a link that opens the app, not the website.
 *
 * The picture is scanned with the phone's own camera, and the phone is where
 * the session already is. Encoding an `https://` address sent it to a browser
 * on that same phone, where nobody is signed in — the one place the approval
 * cannot happen. A scheme URL hands it to the installed app instead, which is
 * both a shorter path and the only one that works.
 *
 * Not a universal link on the web host: those need `.well-known` files served
 * from a host that currently answers with v1, which is an infrastructure move
 * rather than a change to a QR code.
 *
 * Lives here rather than in `appIdentity.ts` because it needs `APP_SCHEME`,
 * and neither file may import the other — see the note at the top of that
 * file.
 */
export function deviceLinkTarget(userCode: string): string {
  return `${APP_SCHEME}://link-device?user_code=${encodeURIComponent(userCode)}`
}
