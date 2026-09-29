import {
  ENTITLEMENT_TIERS,
  type EntitlementId,
  periodTypeOf,
  type BillingPeriodType,
  type PlanTier,
} from '@langx/shared'

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
  /**
   * Whether they are paying yet. `null` for a lifetime grant and for anything
   * RevenueCat did not label — see `BillingPeriodType`.
   */
  periodType: BillingPeriodType | null
  /**
   * Whether it renews at `expiresAt`, or simply ends there.
   *
   * Read from the purchase rather than assumed. `refreshEntitlement` used to
   * hardcode `true`, and with no webhook endpoint configured the refresh path
   * is the *only* path — so every subscriber who had cancelled was still
   * recorded as renewing, and any UI showing a renewal date would have shown a
   * cancelled subscriber a date it will not happen on.
   *
   * Always `false` for a lifetime grant: there is nothing to renew. Paired with
   * `expiresAt: null`, that is what says "lifetime" rather than "ending".
   */
  willRenew: boolean
}

export interface RevenueCatClient {
  /**
   * The entitlement this subscriber holds that lasts longest, or `null` when
   * they hold none. See `pickEntitlement` for why "longest" and not a fixed
   * order of ids.
   */
  getEntitlement(appUserId: string): Promise<SubscriberEntitlement | null>

  /**
   * Gives an entitlement outright, with no purchase behind it — RevenueCat's
   * "promotional" grant, which is how the v1 loyalty gift is delivered.
   *
   * It has to go through RevenueCat rather than straight into
   * `profiles.entitlement` because RevenueCat is the only authority the server
   * recognises: `refreshEntitlement` replaces the stored tier with whatever
   * RevenueCat reports, so a gift written only to the database is erased by
   * the next `/billing/refresh`. Granted this way it also survives a reinstall
   * and a new device, and is visible and revocable in the dashboard.
   *
   * Lifetime only, on purpose. RevenueCat now prefers `end_time_ms` over the
   * older `duration` values, but there is no timestamp that means "never
   * expires" — `duration: 'lifetime'` is the only way to express it.
   */
  grantLifetimeEntitlement(appUserId: string, entitlementId: string): Promise<void>

  /**
   * The same promotional grant, ending at `endsAt` — a gift of some months of
   * Pro. RevenueCat lists it under a synthetic `rc_promo_…` product with a
   * real expiry, which `getEntitlement` reports as store `gift`.
   *
   * Safe to repeat with the same `endsAt`: RevenueCat treats a grant whose end
   * lands within two hours of the current one as a duplicate, which is what
   * lets a retry after a timeout ask again rather than wonder.
   *
   * There is deliberately no revoke beside it. RevenueCat's
   * `revoke_promotionals` removes *every* promotional grant on the
   * entitlement, and the v1 lifetime gift is one of those — cancelling a month
   * would take somebody's lifetime with it. A gift is ended by its date.
   */
  grantPromotionalEntitlement(appUserId: string, entitlementId: string, endsAt: Date): Promise<void>
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
    subscriptions?: Record<
      string,
      { store?: string; unsubscribe_detected_at?: string | null; period_type?: string | null }
    >
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

/**
 * Whether the purchase behind a product is still set to renew.
 *
 * `unsubscribe_detected_at` is RevenueCat's record that the subscriber turned
 * auto-renew off in the store; access continues to `expires_date` either way,
 * which is exactly the distinction between "Renews on" and "Ends on".
 *
 * A product with no `subscriptions` entry is a one-time purchase — a lifetime —
 * and renews by definition never. `billing_issues_detected_at` is deliberately
 * *not* consulted: a failed card is usually transient and retried by the store,
 * and telling someone their plan ends because one charge bounced would be
 * alarming and, most of the time, wrong.
 */
function willRenewProduct(
  subscriber: RevenueCatSubscriberResponse['subscriber'],
  productId: string,
): boolean {
  const subscription = subscriber.subscriptions?.[productId]
  if (!subscription) return false
  return !subscription.unsubscribe_detected_at
}

/** `null` expiry is a lifetime (or not-yet-elapsed non-renewing) grant, not a missing one. */
function isActive(expiresAt: Date | null): boolean {
  return expiresAt === null || expiresAt.getTime() > Date.now()
}

/**
 * A promotional grant made with `duration: 'lifetime'`.
 *
 * RevenueCat has no way to store "never", so it writes a lifetime promotion as
 * an expiry two hundred years out — `2226-07-18` on the first v1 loyalty
 * grant — under a synthetic product `rc_promo_<entitlement>_lifetime`, with a
 * `subscriptions` entry whose store is `promotional`. Read literally, that is
 * a subscription that renews in 2226, and Settings drew exactly that: "Renews
 * on 18/07/2226". It is a lifetime, and is reported as one — no expiry,
 * nothing to renew — which is what `SubscriberEntitlement` says a lifetime
 * looks like.
 */
function isPromotionalLifetime(productId: string): boolean {
  return productId.startsWith('rc_promo_') && productId.endsWith('_lifetime')
}

/**
 * A promotional grant with an end date — a gift of some months of Pro.
 *
 * Reported with the store `gift`, not RevenueCat's `promotional`, because
 * every paywall already released reads `promotional` as "lifetime" and would
 * tell somebody given a month that it is theirs forever. Nothing renews it and
 * nobody is paying for it.
 */
function isPromotionalTimed(productId: string): boolean {
  return productId.startsWith('rc_promo_') && !productId.endsWith('_lifetime')
}

/**
 * Which of several active entitlements to store: the one that ends last, a
 * lifetime beating any date, and on a tie the one somebody pays for.
 *
 * It used to be a fixed order — `pro_plus` before `pro` — which was right
 * while the two ids were two plans. With one plan behind both it is wrong: a
 * cancelled Polyglot subscription still running for a week, beside a new Pro
 * one renewing for a year, would store the week, and the account would drop
 * to free when it ran out with a paid year left.
 */
export function pickEntitlement(
  candidates: readonly SubscriberEntitlement[],
): SubscriberEntitlement | null {
  let best: SubscriberEntitlement | null = null
  for (const candidate of candidates) {
    if (!best) {
      best = candidate
      continue
    }
    const a = candidate.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY
    const b = best.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY
    const paid = (e: SubscriberEntitlement): boolean =>
      e.store !== 'promotional' && e.store !== 'gift'
    if (a > b || (a === b && paid(candidate) && !paid(best))) best = candidate
  }
  return best
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
      // it can be picked.
      const candidates: SubscriberEntitlement[] = []
      for (const [id, entitlement] of Object.entries(body.subscriber.entitlements)) {
        if (!Object.prototype.hasOwnProperty.call(ENTITLEMENT_TIERS, id)) continue
        const productId = entitlement.product_identifier
        const lifetime = isPromotionalLifetime(productId)
        const gift = isPromotionalTimed(productId)
        const expiresAt =
          !lifetime && entitlement.expires_date ? new Date(entitlement.expires_date) : null
        if (!isActive(expiresAt)) continue
        candidates.push({
          tier: ENTITLEMENT_TIERS[id as EntitlementId],
          expiresAt,
          productId,
          store: gift ? 'gift' : storeForProduct(body.subscriber, productId),
          willRenew: lifetime || gift ? false : willRenewProduct(body.subscriber, productId),
          periodType:
            lifetime || gift
              ? null
              : periodTypeOf(body.subscriber.subscriptions?.[productId]?.period_type),
        })
      }
      return pickEntitlement(candidates)
    },

    grantLifetimeEntitlement(appUserId: string, entitlementId: string): Promise<void> {
      return grantPromotional(secretApiKey, appUserId, entitlementId, { duration: 'lifetime' })
    },

    grantPromotionalEntitlement(
      appUserId: string,
      entitlementId: string,
      endsAt: Date,
    ): Promise<void> {
      return grantPromotional(secretApiKey, appUserId, entitlementId, {
        end_time_ms: endsAt.getTime(),
      })
    },
  }
}

/**
 * One promotional grant, lifetime or dated — the body is the only difference,
 * and the subscriber-not-found dance below is the part neither may lose.
 */
async function grantPromotional(
  secretApiKey: string,
  appUserId: string,
  entitlementId: string,
  body: { duration: 'lifetime' } | { end_time_ms: number },
): Promise<void> {
  const grant = (): Promise<Response> =>
    fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entitlementId)}/promotional`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secretApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

  let response = await grant()
  /**
   * RevenueCat refuses to grant to a subscriber it has never heard of, and
   * that is the *ordinary* case for the caller this was written for. The v1
   * loyalty gift is handed out the moment an email is verified — a link
   * often opened on a laptop, before the phone has ever launched the app
   * and told RevenueCat who this is. So the subscriber does not exist yet,
   * the grant answers `404 {"code":7259,"message":"The subscriber was not
   * found."}`, and `tryGrantLifetime` swallows it as a failed gift.
   *
   * Measured against the live project on 3 September 2026, which is also
   * where the fix comes from: a plain `GET /subscribers/{id}` answers 201
   * and creates the record, after which the same grant succeeds. It is a
   * "make sure this exists" call, not a read — nothing is done with the
   * body.
   *
   * Only on the 404, not before every grant: every other path reaches an
   * id the SDK has already registered, and should not pay for a round trip
   * to learn that. A gift of months meets the same wall — an operator can
   * give one to somebody whose app has never told RevenueCat who they are —
   * so both grants share it.
   */
  if (response.status === 404) {
    await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { authorization: `Bearer ${secretApiKey}` },
    })
    response = await grant()
  }

  if (!response.ok) {
    throw new Error(
      `RevenueCat promotional grant failed (${response.status}): ${await response.text()}`,
    )
  }
}

/** Mirrors storage/translation's not-configured fallback — the app boots, `/billing/refresh` fails clearly until a real key is set. */
export function createNotConfiguredRevenueCatClient(): RevenueCatClient {
  return {
    getEntitlement(): Promise<SubscriberEntitlement | null> {
      return Promise.reject(new Error(NOT_CONFIGURED))
    },
    grantLifetimeEntitlement(): Promise<void> {
      return Promise.reject(new Error(NOT_CONFIGURED))
    },
    grantPromotionalEntitlement(): Promise<void> {
      return Promise.reject(new Error(NOT_CONFIGURED))
    },
  }
}

const NOT_CONFIGURED = 'Billing is not configured — set REVENUECAT_SECRET_API_KEY'
