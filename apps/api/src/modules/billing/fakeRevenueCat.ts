import {
  ENTITLEMENT_TIERS,
  TIER_ENTITLEMENTS,
  packageDefinition,
  type BillingPeriod,
  type EntitlementId,
  type PaidPlanTier,
  type RevenueCatEvent,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import {
  pickEntitlement,
  type RevenueCatClient,
  type SubscriberEntitlement,
} from './revenueCatClient'

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
 * A subscriber holds two things separately, as they do at RevenueCat: at most
 * one **store subscription**, and any **promotional grants**. They used to
 * share one record, which meant buying anything destroyed the v1 loyalty gift
 * underneath it — the one coexistence `pickEntitlement` exists to resolve,
 * and the one the harness could not rehearse.
 *
 * Guarded twice over: `loadEnv` refuses `REVENUECAT_FAKE_STORE` under
 * `NODE_ENV=production`, and the routes that drive it are only registered when
 * the flag is on.
 */
export interface FakeRevenueCat extends RevenueCatClient {
  /** Distinguishes this from the real client at runtime — see `asFakeRevenueCat`. */
  readonly isFake: true
  /**
   * Records a purchase and returns the event RevenueCat would have sent for
   * it: `INITIAL_PURCHASE` for a first subscription, `PRODUCT_CHANGE` when it
   * replaces one that is still running — which is what a store does for an
   * upgrade. Returns `null` for a package identifier `PACKAGES` does not
   * sell, so the caller can answer "no such package" rather than invent a
   * subscription nobody could have bought.
   */
  purchase(appUserId: string, packageId: string): RevenueCatEvent | null
  /** Stops the renewal, keeping access until it runs out — a `CANCELLATION`. */
  cancel(appUserId: string): RevenueCatEvent | null
  /**
   * Ends the store subscription now — an `EXPIRATION`, the event the webhook
   * reconciles on. A promotional grant survives it, exactly as it does at
   * RevenueCat, so a gifted lifetime outlives a bought subscription that lapses.
   */
  expire(appUserId: string): RevenueCatEvent | null
  /**
   * Ends every dated promotional grant now and returns the `EXPIRATION`
   * RevenueCat sends for one — `store: 'PROMOTIONAL'`, which is how the
   * webhook tells a gift running out from a subscription lapsing. A lifetime
   * grant is untouched, as it is at RevenueCat.
   */
  expireGift(appUserId: string): RevenueCatEvent | null
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

interface FakeSubscriber {
  subscription: FakeSubscription | null
  /** Promotional lifetime grants: no product, no expiry, nothing to renew. */
  promotional: EntitlementId[]
  /**
   * Dated promotional grants — gifts of months. A list rather than one date
   * per entitlement because RevenueCat keeps each grant, and the entitlement
   * lasts as long as the latest of them.
   */
  gifts: { entitlementId: EntitlementId; expiresAt: Date }[]
}

/**
 * A product identifier that could not be mistaken for one in App Store Connect
 * or Play Console, for the same reason `FAKE_STORE` is not `app_store`.
 */
function fakeProductId(tier: PaidPlanTier, period: BillingPeriod): string {
  return `fake.${tier}.${period}`
}

/** Named like RevenueCat names its own promotional products, so `isPromotionalLifetime` recognises it. */
function promoProductId(entitlementId: EntitlementId): string {
  return `rc_promo_${entitlementId}_lifetime`
}

/** A dated promotional product: `rc_promo_` without `_lifetime`, which is what `isPromotionalTimed` reads as a gift. */
function giftProductId(entitlementId: EntitlementId): string {
  return `rc_promo_${entitlementId}_custom`
}

function isActive(subscription: FakeSubscription, now: Date): boolean {
  return subscription.expiresAt === null || subscription.expiresAt.getTime() > now.getTime()
}

export function createFakeRevenueCat(): FakeRevenueCat {
  // In memory, and so lost on every restart. Persisting it would mean a
  // schema, an index and a collection that exist only for a harness; a
  // developer re-buying after `pnpm dev` restarts is the cheaper trade, and
  // `docs/billing-testing.md` says so.
  const subscribers = new Map<string, FakeSubscriber>()

  function subscriber(appUserId: string): FakeSubscriber {
    let record = subscribers.get(appUserId)
    if (!record) {
      record = { subscription: null, promotional: [], gifts: [] }
      subscribers.set(appUserId, record)
    }
    return record
  }

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
      const record = subscriber(appUserId)
      const replaces = record.subscription !== null && isActive(record.subscription, new Date())
      record.subscription = subscription
      // What a store sends when a running subscription is swapped for another
      // product — an upgrade, here — rather than started from nothing. The
      // webhook treats both as grants; the harness exists so that it is seen
      // doing so with the event type the store would actually use.
      return event(replaces ? 'PRODUCT_CHANGE' : 'INITIAL_PURCHASE', appUserId, subscription)
    },

    cancel(appUserId: string): RevenueCatEvent | null {
      const subscription = subscribers.get(appUserId)?.subscription
      if (!subscription) return null
      subscription.willRenew = false
      // Access deliberately survives: cancelling stops the next charge, and the
      // webhook's CANCELLATION branch only flips `willRenew` for that reason.
      return event('CANCELLATION', appUserId, subscription)
    },

    expire(appUserId: string): RevenueCatEvent | null {
      const record = subscribers.get(appUserId)
      const subscription = record?.subscription
      if (!record || !subscription) return null
      record.subscription = null
      // The event is built from the subscription that just ended — an
      // EXPIRATION names what stopped, not what is left, which is exactly the
      // ambiguity the webhook reconciles against `getEntitlement` below.
      return event('EXPIRATION', appUserId, subscription)
    },

    expireGift(appUserId: string): RevenueCatEvent | null {
      const record = subscribers.get(appUserId)
      const gift = record?.gifts.at(-1)
      if (!record || !gift) return null
      record.gifts = []
      return {
        id: `fake_${randomUUID()}`,
        type: 'EXPIRATION',
        app_user_id: appUserId,
        product_id: giftProductId(gift.entitlementId),
        // RevenueCat's own spelling for a promotional grant's events, upper
        // case like every webhook store value.
        store: 'PROMOTIONAL',
        environment: 'SANDBOX',
        expiration_at_ms: Date.now(),
        entitlement_ids: [gift.entitlementId],
      }
    },

    getEntitlement(appUserId: string): Promise<SubscriberEntitlement | null> {
      const record = subscribers.get(appUserId)
      if (!record) return Promise.resolve(null)
      const now = new Date()
      const subscription =
        record.subscription && isActive(record.subscription, now) ? record.subscription : null

      // Both holdings are offered to the same `pickEntitlement` the real
      // client uses, so a gifted lifetime under a bought subscription is
      // resolved here exactly as it is there.
      const candidates: SubscriberEntitlement[] = []
      if (subscription) {
        const id = subscription.entitlementIds[0]
        if (id) {
          candidates.push({
            tier: ENTITLEMENT_TIERS[id],
            expiresAt: subscription.expiresAt,
            productId: subscription.productId,
            store: FAKE_STORE,
            willRenew: subscription.willRenew,
            periodType: null,
          })
        }
      }
      for (const id of record.promotional) {
        candidates.push({
          tier: ENTITLEMENT_TIERS[id],
          expiresAt: null,
          productId: promoProductId(id),
          store: 'promotional',
          willRenew: false,
          periodType: null,
        })
      }
      for (const gift of record.gifts) {
        if (gift.expiresAt.getTime() <= now.getTime()) continue
        candidates.push({
          tier: ENTITLEMENT_TIERS[gift.entitlementId],
          expiresAt: gift.expiresAt,
          productId: giftProductId(gift.entitlementId),
          store: 'gift',
          willRenew: false,
          periodType: null,
        })
      }
      return Promise.resolve(pickEntitlement(candidates))
    },

    grantLifetimeEntitlement(appUserId: string, entitlementId: string): Promise<void> {
      const record = subscriber(appUserId)
      // A promotional grant has no product and no expiry — which is why the v1
      // loyalty gift is expressed as one, and why it lives beside the store
      // subscription here rather than inside it.
      if (!record.promotional.includes(entitlementId as EntitlementId)) {
        record.promotional.push(entitlementId as EntitlementId)
      }
      return Promise.resolve()
    },

    grantPromotionalEntitlement(
      appUserId: string,
      entitlementId: string,
      endsAt: Date,
    ): Promise<void> {
      const record = subscriber(appUserId)
      // A repeat of the same end is the duplicate RevenueCat ignores, so a
      // retried grant leaves one row here too.
      const id = entitlementId as EntitlementId
      if (
        !record.gifts.some(
          (g) => g.entitlementId === id && g.expiresAt.getTime() === endsAt.getTime(),
        )
      ) {
        record.gifts.push({ entitlementId: id, expiresAt: new Date(endsAt) })
      }
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
