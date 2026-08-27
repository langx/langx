/** The one entitlement this app sells — see the plan's "RevenueCat tek entitlement". Must match the identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT_ID = 'pro'

export interface SubscriberEntitlement {
  isActive: boolean
  expiresAt: Date | null
  productId: string
  store: string
}

export interface RevenueCatClient {
  /** `null` when the subscriber has no active/known "pro" entitlement at all. */
  getProEntitlement(appUserId: string): Promise<SubscriberEntitlement | null>
}

interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: Record<
      string,
      { expires_date: string | null; product_identifier: string; store: string }
    >
  }
}

export function createRevenueCatClient(secretApiKey: string): RevenueCatClient {
  return {
    async getProEntitlement(appUserId: string): Promise<SubscriberEntitlement | null> {
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
        { headers: { authorization: `Bearer ${secretApiKey}` } },
      )
      if (!response.ok) {
        throw new Error(`RevenueCat subscriber lookup failed (${response.status}): ${await response.text()}`)
      }

      const body = (await response.json()) as RevenueCatSubscriberResponse
      const entitlement = body.subscriber.entitlements[PRO_ENTITLEMENT_ID]
      if (!entitlement) return null

      const expiresAt = entitlement.expires_date ? new Date(entitlement.expires_date) : null
      return {
        // No expiry (lifetime/non-renewing already elapsed check) or a future date both count as active.
        isActive: expiresAt === null || expiresAt.getTime() > Date.now(),
        expiresAt,
        productId: entitlement.product_identifier,
        store: entitlement.store,
      }
    },
  }
}

/** Mirrors storage/translation's not-configured fallback — the app boots, `/billing/refresh` fails clearly until a real key is set. */
export function createNotConfiguredRevenueCatClient(): RevenueCatClient {
  return {
    getProEntitlement(): Promise<SubscriberEntitlement | null> {
      return Promise.reject(new Error('Billing is not configured — set REVENUECAT_SECRET_API_KEY'))
    },
  }
}
