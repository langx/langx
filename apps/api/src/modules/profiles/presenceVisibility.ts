import type { Profile } from './profiles'

/**
 * Whether this profile's online status is hidden from everyone.
 *
 * Deliberately unlike `incognito`, which re-checks the tier at read time
 * (`profileViews.ts`). Doing that here would mean a lapsed subscription
 * silently makes someone visible as online again — a privacy setting revoked
 * by a billing event, without telling them. This is gated on *write* instead:
 * only a paid tier can turn it on, and turning it off is always allowed, so
 * nobody is ever stuck hidden either.
 */
export function hidesOnlineStatus(profile: Pick<Profile, 'privacy'>): boolean {
  return profile.privacy.hideOnlineStatus === true
}
