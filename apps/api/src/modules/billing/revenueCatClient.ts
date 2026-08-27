import { ENTITLEMENT_PRECEDENCE, ENTITLEMENT_TIERS, type PlanTier } from '@langx/shared'

/**
 * One *active* entitlement, already resolved to the tier it grants.
 *
 * The predecessor of this type carried an `isActive: boolean` and left the
 * caller to honour it. Nothing enforced that, and a caller that forgot would
 * have granted Pro off an expired subscription — so an inactive entitlement is
 * now simply not returned, and `null` is the only way to say "free".
 */
export interface SubscriberEntitlement {
  tier: PlanTier
  expiresAt: Date | null
  productId: string
  store: string
}

export interface RevenueCatClient {
  /**
   * The highest tier this subscriber currently holds, or `null` when they hold
   * none. "Highest" is `ENTITLEMENT_PRECEDENCE`: Pro+ products grant `pro` as
   * well as `pro_plus`, so every Pro+ subscriber matches both and one of them
   * has to win.
   */
  getEntitlement(appUserId: string): Promise<SubscriberEntitlement | null>
}

/**
 * The parts of `GET /v1/subscribers/{app_user_id}` this client reads.
 *
 * Note what an entitlement entry does **not** carry: a `store`. It used to be
 * read off the entitlement anyway, which typechecked against this interface
 * and was `undefined` at runtime — the store lives on the *purchase*, under
 * `subscriptions` keyed by product id, or `non_subscriptions` for one-time
 * products like lifetime (whose values are arrays: one entry per purchase).
 */
interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: Record<string, { expires_date: string | null; product_identifier: string }>
    subscriptions?: Record<string, { store?: string }>
    non_subscriptions?: Record<string, { store?: string }[]>
  }
}

/** The store a product was bought in, from whichever purchase list holds it. */
function storeForProduct(
  subscriber: RevenueCatSubscriberResponse['subscriber'],
  productId: string,
): string {
  const oneTime = subscriber.non_subscriptions?.[productId]
  return (
    subscriber.subscriptions?.[productId]?.store ??
    // The most recent purchase of a one-time product, not the first: a
    // lifetime bought again after a refund should report where it lives now.
    oneTime?.[oneTime.length - 1]?.store ??
    'unknown'
  )
}

/** `null` expiry is a lifetime (or not-yet-elapsed non-renewing) grant, not a missing one. */
function isActive(expiresAt: Date | null): boolean {
  return expiresAt === null || expiresAt.getTime() > Date.now()
}

export function createRevenueCatClient(secretApiKey: string): RevenueCatClient {
  return {
    async getEntitlement(appUserId: string): Promise<SubscriberEntitlement | null> {
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
        { headers: { authorization: `Bearer ${secretApiKey}` } },
      )
      if (!response.ok) {
        throw new Error(
          `RevenueCat subscriber lookup failed (${response.status}): ${await response.text()}`,
        )
      }

      const body = (await response.json()) as RevenueCatSubscriberResponse

      // RevenueCat returns every entitlement the subscriber has ever held, so
      // presence proves nothing — each candidate is checked for expiry before
      // it can win, and precedence order means Pro+ is tried before Pro.
      for (const id of ENTITLEMENT_PRECEDENCE) {
        const entitlement = body.subscriber.entitlements[id]
        if (!entitlement) continue
        const expiresAt = entitlement.expires_date ? new Date(entitlement.expires_date) : null
        if (!isActive(expiresAt)) continue
        return {
          tier: ENTITLEMENT_TIERS[id],
          expiresAt,
          productId: entitlement.product_identifier,
          store: storeForProduct(body.subscriber, entitlement.product_identifier),
        }
      }
      return null
    },
  }
}

/** Mirrors storage/translation's not-configured fallback — the app boots, `/billing/refresh` fails clearly until a real key is set. */
export function createNotConfiguredRevenueCatClient(): RevenueCatClient {
  return {
    getEntitlement(): Promise<SubscriberEntitlement | null> {
      return Promise.reject(new Error('Billing is not configured — set REVENUECAT_SECRET_API_KEY'))
    },
  }
}
