import { effectivePlanTier, type PlanTier } from '@langx/shared'
import type { Profile } from './profiles'

/**
 * The single place that turns a stored entitlement record into the tier a
 * guard actually enforces. Every quota and feature check goes through this,
 * never `profile.entitlement.tier` directly.
 *
 * The rule itself lives in `packages/shared` so the client enforces the same
 * one — it used to read `tier` straight off the profile, which meant a late
 * webhook showed someone a Pro interface the server would refuse to honour.
 */
export function effectiveTier(profile: Pick<Profile, 'entitlement'>): PlanTier {
  return effectivePlanTier(profile.entitlement.tier, profile.entitlement.expiresAt)
}
