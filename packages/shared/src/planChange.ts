import { effectivePlanTier, type StoredPlanTier } from './limits'

/**
 * What tapping the offer would actually do for the person tapping it.
 *
 * - `buy` — nothing paid to cover it: the free tier, a lapsed plan, or a gift
 *   that runs out (`store: 'gift'`). Subscribing on top of a timed gift is the
 *   point — Pro carries on when the gift ends — so it is a plain purchase.
 * - `covered` — Pro is held and nothing will take it away on a date of ours: a
 *   subscription (which renews or is the store's to change) or a lifetime
 *   grant. Disabled.
 *
 * There used to be `upgrade` and `elsewhere` too, for moving between two paid
 * tiers. With one paid tier nothing can be upgraded to.
 */
export type PlanChange = 'buy' | 'covered'

/** Where a purchase can be made from, in RevenueCat's own store vocabulary. */
export type BillingPlatform = 'ios' | 'android' | 'web'

/**
 * The stores each platform sells through, by the values RevenueCat writes into
 * a subscriber's `store`. `promotional` and `gift` are in none of them on
 * purpose — a grant is not a subscription anyone can manage in a store.
 */
const PLATFORM_STORES: Record<BillingPlatform, readonly string[]> = {
  ios: ['app_store', 'mac_app_store'],
  android: ['play_store', 'amazon'],
  web: ['stripe', 'rc_billing'],
}

export interface HeldPlan {
  /** May still be the retired `pro_plus`; read through `effectivePlanTier`. */
  tier: StoredPlanTier
  /** `profiles.entitlement.store`; absent for the free tier. */
  store?: string | null | undefined
  /** `profiles.entitlement.expiresAt`; `null` for a lifetime grant. */
  expiresAt?: Date | string | null | undefined
}

export function planChangeFor(held: HeldPlan): PlanChange {
  if (effectivePlanTier(held.tier, held.expiresAt) === 'free') return 'buy'
  return held.store === 'gift' ? 'buy' : 'covered'
}

/**
 * Which platform's store sold the held plan, for telling someone where to go
 * and change it. `null` when no store did — a grant, or a store this app
 * does not sell through.
 */
export function platformOfStore(store: string | null | undefined): BillingPlatform | null {
  if (!store) return null
  for (const [platform, stores] of Object.entries(PLATFORM_STORES)) {
    if (stores.includes(store)) return platform as BillingPlatform
  }
  return null
}
