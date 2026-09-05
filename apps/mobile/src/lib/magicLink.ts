import { APP_SCHEME } from '@langx/shared'

/**
 * Where the verify call sends a failure, as a path on the API. Better Auth
 * answers every magic-link failure with a redirect to this URL; the API
 * serves a 400 there whose code the app already maps to "no longer valid".
 */
export const MAGIC_LINK_FAILED_PATH = '/auth/magic-link/failed'

/**
 * The same link as the emailed one, on the app's own scheme.
 *
 * The escape hatch for a phone where the https link opened a browser instead
 * of the app — an Android build whose app link is not verified, or a link
 * pasted into Safari, which never hands its own domain to an app. The web
 * page offers this as "Open in the LangX app"; the app then spends the
 * token exactly as it would have from the universal link.
 */
export function appLinkForToken(token: string): string {
  return `${APP_SCHEME}://magic-link?token=${encodeURIComponent(token)}`
}
