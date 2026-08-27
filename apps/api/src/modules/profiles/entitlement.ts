import type { PlanTier } from '@langx/shared'
import type { Profile } from './profiles'

/**
 * The single place that turns a stored entitlement record into the tier a
 * guard actually enforces. `tier` alone isn't enough: a lapsed subscription
 * whose RevenueCat `EXPIRATION` webhook hasn't arrived yet — or never will,
 * webhook delivery isn't guaranteed — must not keep granting Pro forever.
 * Every quota/feature check goes through this, never
 * `profile.entitlement.tier` directly (see the plan's "if expiresAt has passed
 * guard reddeder").
 */
export function effectiveTier(profile: Pick<Profile, 'entitlement'>): PlanTier {
  const { tier, expiresAt } = profile.entitlement
  if (tier === 'pro' && expiresAt && expiresAt.getTime() <= Date.now()) return 'free'
  return tier
}
