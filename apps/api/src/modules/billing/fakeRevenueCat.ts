import {
  TIER_ENTITLEMENTS,
  packageDefinition,
  tierFromEntitlementIds,
  type BillingPeriod,
  type EntitlementId,
  type PaidPlanTier,
  type RevenueCatEvent,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { RevenueCatClient, SubscriberEntitlement } from './revenueCatClient'

/**
 * RevenueCat, replaced by a Map — so that a purchase can be driven from end to
 * end on a laptop, with no App Store product, no Play product and no network.
 *
 * This exists because of a real gap rather than for convenience: none of
 * Faz 7's billing code could be exercised outside its unit tests until store
 * products existed (`docs/release-runbook.md` → "cannot be tested end to
 * end"), which is a long time to leave a paywall, a webhook handler and an
 * entitlement writer unverified against each other.
 *
 * **What this fakes and what it does not.** It stands in for RevenueCat's
 * *state* — what a subscriber holds — and it produces the events RevenueCat
 * would have sent. Everything downstream of that is the real thing: the
 * harness feeds those events to `processRevenueCatWebhook` and reads the
 * result back through `refreshEntitlement`, both untouched. So it proves our
 * half of the integration works, and says nothing about whether the store
 * receipt, the RevenueCat dashboard configuration or the webhook delivery do.
 * Those still need a Test Store purchase on a device.
 *
 * Guarded twice over: `loadEnv` refuses `REVENUECAT_FAKE_STORE` under
 * `NODE_ENV=production`, and the routes that drive it are only registered when
 * the flag is on.
 */
export interface FakeRevenueCat extends RevenueCatClient {
  /** Distinguishes this from the real client at runtime — see `asFakeRevenueCat`. */
  readonly isFake: true
  /**
   * Records a purchase and returns the `INITIAL_PURCHASE` RevenueCat would
   * have sent for it. Returns `null` for a package identifier `PACKAGES` does
   * not sell, so the caller can answer "no such package" rather than invent a
   * subscription nobody could have bought.
   */
  purchase(appUserId: string, packageId: string): RevenueCatEvent | null
  /** Stops the renewal, keeping access until it runs out — a `CANCELLATION`. */
  cancel(appUserId: string): RevenueCatEvent | null
  /** Ends access now — an `EXPIRATION`, the event the webhook reconciles on. */
  expire(appUserId: string): RevenueCatEvent | null
}

/**
 * Never one of RevenueCat's real store values (`app_store`, `play_store`,
 * `stripe`, …). It is written into `subscriptions.store` and
 * `profiles.entitlement.store` like any other purchase, and the one question
 * that must stay answerable afterwards is which rows the harness put there.
 */
export const FAKE_STORE = 'fake_store'

/**
 * How long each period lasts here.
 *
 * Deliberately not read from `PLAN_LIMITS` or anywhere else in config: these
 * are not product rules, they are how long a *simulated* subscription runs
 * before `getEntitlement` starts calling it expired. A real one is timed by
 * Apple or Google and we never compute it. `Record<BillingPeriod, …>` is what
 * makes a new period a compile error here instead of a subscription that
 * expires the moment it is bought.
 */
const PERIOD_MS: Record<BillingPeriod, number | null> = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
  /** Not "very long" — a lifetime has no expiry at all, and `null` is how the rest of the code spells that. */
  lifetime: null,
}

interface FakeSubscription {
  entitlementIds: EntitlementId[]
  productId: string
  expiresAt: Date | null
  willRenew: boolean
}

/**
 * A product identifier that could not be mistaken for one in App Store Connect
 * or Play Console, for the same reason `FAKE_STORE` is not `app_store`.
 */
function fakeProductId(tier: PaidPlanTier, period: BillingPeriod): string {
  return `fake.${tier}.${period}`
}

function isActive(subscription: FakeSubscription, now: Date): boolean {
  return subscription.expiresAt === null || subscription.expiresAt.getTime() > now.getTime()
}

export function createFakeRevenueCat(): FakeRevenueCat {
  // In memory, and so lost on every restart. Persisting it would mean a
  // schema, an index and a collection that exist only for a harness; a
  // developer re-buying after `pnpm dev` restarts is the cheaper trade, and
  // `docs/billing-testing.md` says so.
  const subscribers = new Map<string, FakeSubscription>()

  function event(type: string, appUserId: string, subscription: FakeSubscription): RevenueCatEvent {
    return {
      // The unique index on `subscriptions.eventId` is the webhook's
      // idempotency guard, so every simulated event needs an id no other one
      // will ever repeat — including across restarts, which a counter would
      // not survive.
      id: `fake_${randomUUID()}`,
      type,
      app_user_id: appUserId,
      product_id: subscription.productId,
      store: FAKE_STORE,
      // RevenueCat's own value for a non-production purchase. The webhook
      // records it verbatim, so a row written here is identifiable as a test
      // one from two independent fields.
      environment: 'SANDBOX',
      expiration_at_ms: subscription.expiresAt ? subscription.expiresAt.getTime() : null,
      entitlement_ids: [...subscription.entitlementIds],
    }
  }

  return {
    isFake: true,

    purchase(appUserId: string, packageId: string): RevenueCatEvent | null {
      const definition = packageDefinition(packageId)
      // `free` is unreachable through `PACKAGES` today, but `PackageDefinition`
      // permits it, and a "purchase" of the free tier is not a thing to invent
      // a subscription for.
      if (definition === null || definition.tier === 'free') return null

      const tier: PaidPlanTier = definition.tier
      const lifetimeMs = PERIOD_MS[definition.period]
      const subscription: FakeSubscription = {
        entitlementIds: [...TIER_ENTITLEMENTS[tier]],
        productId: fakeProductId(tier, definition.period),
        expiresAt: lifetimeMs === null ? null : new Date(Date.now() + lifetimeMs),
        // A lifetime purchase is not a subscription and has nothing to renew.
        willRenew: definition.period !== 'lifetime',
      }
      subscribers.set(appUserId, subscription)
      return event('INITIAL_PURCHASE', appUserId, subscription)
    },

    cancel(appUserId: string): RevenueCatEvent | null {
      const subscription = subscribers.get(appUserId)
      if (!subscription) return null
      subscription.willRenew = false
      // Access deliberately survives: cancelling stops the next charge, and the
      // webhook's CANCELLATION branch only flips `willRenew` for that reason.
      return event('CANCELLATION', appUserId, subscription)
    },

    expire(appUserId: string): RevenueCatEvent | null {
      const subscription = subscribers.get(appUserId)
      if (!subscription) return null
      subscribers.delete(appUserId)
      // The event is built from the subscription that just ended — an
      // EXPIRATION names what stopped, not what is left, which is exactly the
      // ambiguity the webhook reconciles against `getEntitlement` below.
      return event('EXPIRATION', appUserId, subscription)
    },

    getEntitlement(appUserId: string): Promise<SubscriberEntitlement | null> {
      const subscription = subscribers.get(appUserId)
      if (!subscription || !isActive(subscription, new Date())) return Promise.resolve(null)

      // Resolved through the shared precedence rule rather than from a tier
      // stored alongside: a Pro+ subscriber holds both ids here exactly as they
      // do at RevenueCat, so the harness exercises that resolution instead of
      // trusting a field only it writes.
      const tier = tierFromEntitlementIds(subscription.entitlementIds)
      if (tier === null) return Promise.resolve(null)

      return Promise.resolve({
        tier,
        expiresAt: subscription.expiresAt,
        productId: subscription.productId,
        store: FAKE_STORE,
        // The harness has tracked this since it was written; it simply was not
        // reported, because `refreshEntitlement` overwrote it with `true`.
        willRenew: subscription.willRenew,
      })
    },

    grantLifetimeEntitlement(appUserId: string, entitlementId: string): Promise<void> {
      const existing = subscribers.get(appUserId)
      const entitlementIds = existing ? [...existing.entitlementIds] : []
      if (!entitlementIds.includes(entitlementId as EntitlementId)) {
        entitlementIds.push(entitlementId as EntitlementId)
      }
      // A promotional grant has no product and no expiry — which is why the v1
      // loyalty gift is expressed as one, and why it lands here as a lifetime
      // subscription with nothing to renew.
      subscribers.set(appUserId, {
        entitlementIds,
        productId: existing?.productId ?? 'fake.promotional',
        expiresAt: null,
        willRenew: false,
      })
      return Promise.resolve()
    },
  }
}

/**
 * The fake behind a `RevenueCatClient`, or `null` for the real one.
 *
 * The routes that drive the harness need capabilities the interface does not
 * have, and this is the only widening point — a caller that forgets to check
 * gets `null`, not a client that throws at the first simulated purchase.
 */
export function asFakeRevenueCat(client: RevenueCatClient): FakeRevenueCat | null {
  return 'isFake' in client && client.isFake === true ? (client as FakeRevenueCat) : null
}
