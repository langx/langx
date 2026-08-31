import type { Profile } from './profiles'

/**
 * Whether this profile's presence is hidden from everyone — both the green dot
 * and `lastActiveAt`, which `toPublicProfile` omits entirely rather than
 * nulling when this is true.
 *
 * No tier check, and there is no longer one anywhere: `hideOnlineStatus` is
 * free on every plan. It was a paid capability until the app began *rendering*
 * `lastActiveAt`; charging for the switch that turns off a disclosure we had
 * just started making was not defensible, so the flag left `PLAN_LIMITS`
 * instead.
 *
 * The reasoning that kept it out of `incognito`'s read-time tier check still
 * holds and is now unconditional: a privacy setting must never be revoked by a
 * billing event without telling the person who set it.
 */
export function hidesOnlineStatus(profile: Pick<Profile, 'privacy'>): boolean {
  return profile.privacy.hideOnlineStatus === true
}
