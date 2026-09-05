import type { PaidPlanTier, PlanTier } from './limits'

/**
 * What tapping an offer would actually do for the person tapping it.
 *
 * - `buy` — nothing paid to change: the free tier, or a plan held as a
 *   promotional grant (the v1 loyalty gift), which no store can prorate
 *   against because no store sold it. A plain purchase.
 * - `upgrade` — a paid plan bought on **this** platform's store, moving to a
 *   higher tier. The store swaps the subscription and charges the
 *   difference; on the web it happens in RevenueCat's portal instead.
 * - `covered` — the offer's tier is the one held, or a lower one. Disabled:
 *   a Polyglot subscriber buying Fluent would be paying twice for less, and a
 *   downgrade is the store's own flow.
 * - `elsewhere` — a paid plan bought on **another** platform's store. Buying
 *   here would open a second subscription beside the first, so the answer is
 *   to change it where it was bought.
 */
export type PlanChange = 'buy' | 'upgrade' | 'covered' | 'elsewhere'

/** Where a purchase can be made from, in RevenueCat's own store vocabulary. */
export type BillingPlatform = 'ios' | 'android' | 'web'

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, pro_plus: 2 }

/**
 * The stores each platform can change a subscription in, by the values
 * RevenueCat writes into a subscriber's `store`. `promotional` is in none of
 * them on purpose — a grant is not a subscription anyone can swap.
 */
const PLATFORM_STORES: Record<BillingPlatform, readonly string[]> = {
  ios: ['app_store', 'mac_app_store'],
  android: ['play_store', 'amazon'],
  web: ['stripe', 'rc_billing'],
}

/**
 * The harness's store, `fakeRevenueCat.ts` → `FAKE_STORE`. Reachable from
 * every platform because the harness *is* every platform, so a fake Fluent is
 * upgradable wherever the paywall happens to be open.
 */
const FAKE_STORE = 'fake_store'

export interface HeldPlan {
  tier: PlanTier
  /** `profiles.entitlement.store`; absent for the free tier. */
  store?: string | null | undefined
}

export function planChangeFor(
  held: HeldPlan,
  offerTier: PaidPlanTier,
  platform: BillingPlatform,
): PlanChange {
  if (TIER_RANK[offerTier] <= TIER_RANK[held.tier]) return 'covered'
  if (held.tier === 'free') return 'buy'
  const store = held.store ?? ''
  if (store === FAKE_STORE || PLATFORM_STORES[platform].includes(store)) return 'upgrade'
  if (Object.values(PLATFORM_STORES).some((stores) => stores.includes(store))) return 'elsewhere'
  // `promotional`, `unknown`, or nothing recorded: there is no subscription
  // to change, only a tier to buy on top of.
  return 'buy'
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

/**
 * The subscription a Play upgrade replaces, out of what RevenueCat says is
 * active. Promotional grants appear in the same list under `rc_promo_*` and
 * are not subscriptions Play knows; a Play product with a base plan arrives
 * as `product:base-plan`, and Play wants the product alone.
 */
export function replaceableProductId(activeSubscriptions: readonly string[]): string | null {
  const store = activeSubscriptions.find((id) => !id.startsWith('rc_promo_'))
  return store ? (store.split(':')[0] ?? null) : null
}
