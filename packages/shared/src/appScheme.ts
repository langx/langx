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
