import { z } from 'zod'
import type { PaidPlanTier, PlanTier } from './limits'

/**
 * RevenueCat's own webhook payload has many more fields; this only declares
 * what `processRevenueCatWebhook` actually reads. `.passthrough()` (implicit
 * — extra keys are simply ignored by not being in the shape) means a new
 * field RevenueCat adds later can't break parsing.
 */
export const revenueCatEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  /**
   * Optional because `TRANSFER` events genuinely do not have it — they carry
   * `transferred_from`/`transferred_to` arrays instead (per RevenueCat's
   * event-fields reference). This field was required until that was checked,
   * which meant every real TRANSFER webhook failed body validation with a 400
   * and RevenueCat retried it forever.
   */
  app_user_id: z.string().min(1).optional(),
  /** `TRANSFER` only: the app user ids losing the transactions. */
  transferred_from: z.array(z.string()).nullable().optional(),
  /** `TRANSFER` only: the app user ids receiving them. */
  transferred_to: z.array(z.string()).nullable().optional(),
  product_id: z.string().optional(),
  store: z.string().optional(),
  environment: z.string().optional(),
  expiration_at_ms: z.number().nullable().optional(),
  /**
   * Which entitlements the event is about.
   *
   * Absent from this schema until Pro+ existed, and the omission was a real
   * bug rather than a gap: with no way to tell which entitlement had been
   * bought, the handler wrote `tier: 'pro'` on all eight grant events. With
   * two paid tiers that turns `PRODUCT_CHANGE` — the upgrade/downgrade event —
   * into one that silently downgrades every Pro+ subscriber who touches it.
   *
   * Nullable because RevenueCat sends `null` for events that belong to no
   * entitlement, and optional because a webhook from before this field
   * existed, or a test fixture, must still parse.
   */
  entitlement_ids: z.array(z.string()).nullable().optional(),
})
export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>

export const revenueCatWebhookBodySchema = z.object({
  api_version: z.string().optional(),
  event: revenueCatEventSchema,
})
export type RevenueCatWebhookBody = z.infer<typeof revenueCatWebhookBodySchema>

/**
 * RevenueCat entitlement identifier → the tier it grants. These strings are
 * configured in the RevenueCat dashboard and must match it exactly; the names
 * were chosen to equal the `PlanTier` values, but the mapping is written out
 * rather than assumed so that renaming one side is a compile error instead of
 * a silent downgrade to free.
 */
export const ENTITLEMENT_TIERS = {
  pro: 'pro',
  pro_plus: 'pro_plus',
} as const satisfies Record<string, PlanTier>

export type EntitlementId = keyof typeof ENTITLEMENT_TIERS

/** How often a package bills. Not a duration — only what the paywall labels it. */
export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime'

export interface PackageDefinition {
  tier: PlanTier
  period: BillingPeriod
}

/**
 * RevenueCat *package* identifier → what that package sells.
 *
 * A sibling of `ENTITLEMENT_TIERS` and configured in the same dashboard, but a
 * genuinely different thing: entitlements are what a subscriber *has*,
 * packages are what the paywall *offers*. Pro's three keep RevenueCat's
 * reserved identifiers because they were created with the project; Pro+ had to
 * use custom ones, since a reserved identifier can be used only once per
 * offering.
 *
 * `period` is carried here rather than read off the SDK's `packageType`
 * precisely *because* of that split: a custom identifier reports
 * `packageType: 'CUSTOM'`, so the SDK can describe Pro's cadence and not
 * Pro+'s. Deriving both from one table is the only way the two columns get
 * labelled by the same rule.
 *
 * The paywall groups its columns off this map, so a package added in the
 * dashboard and not here simply does not render — visibly missing, rather than
 * silently landing in the wrong column at the wrong price.
 */
export const PACKAGES = {
  $rc_monthly: { tier: 'pro', period: 'monthly' },
  $rc_annual: { tier: 'pro', period: 'yearly' },
  $rc_lifetime: { tier: 'pro', period: 'lifetime' },
  pro_plus_monthly: { tier: 'pro_plus', period: 'monthly' },
  pro_plus_yearly: { tier: 'pro_plus', period: 'yearly' },
} as const satisfies Record<string, PackageDefinition>

export function packageDefinition(id: string): PackageDefinition | null {
  return (PACKAGES as Record<string, PackageDefinition | undefined>)[id] ?? null
}

/**
 * Which tier wins when a subscriber holds more than one entitlement at once.
 *
 * This is **not** a general ordering of `PlanTier` — see the note there. It is
 * a resolution rule for one specific situation: Pro+ products deliberately
 * grant `pro` as well as `pro_plus`, so every Pro+ subscriber holds both, and
 * something has to say which one to store.
 */
export const ENTITLEMENT_PRECEDENCE = ['pro_plus', 'pro'] as const

/**
 * The tier a set of active entitlement ids amounts to, or `null` when none of
 * them is one we sell. Unknown ids are ignored rather than rejected: an
 * entitlement added in the dashboard before the code knows about it should
 * leave the user where they are, not throw a webhook into RevenueCat's retry
 * loop.
 */
export function tierFromEntitlementIds(ids: readonly string[] | null | undefined): PlanTier | null {
  if (!ids?.length) return null
  for (const candidate of ENTITLEMENT_PRECEDENCE) {
    if (ids.includes(candidate)) return ENTITLEMENT_TIERS[candidate]
  }
  return null
}

export interface LifetimeGrantRung {
  /** Inclusive floor on the v1 token balance. */
  minLegacyTokenBalance: number
  /** The tier the recipient ends up on. */
  tier: PaidPlanTier
  /**
   * Every entitlement to grant, the tier-defining one first.
   *
   * Pro+ lists `pro` as well, mirroring how the Pro+ *products* are configured:
   * a bought Pro+ subscriber holds both ids, and a gifted one should be
   * indistinguishable from them. Precedence would resolve `pro_plus` alone
   * correctly today, so this is insurance rather than necessity — but the day
   * something asks only about `pro`, the gift keeps working.
   */
  entitlements: readonly EntitlementId[]
}

/**
 * Lifetime access, given to the v1 accounts that genuinely earned in the old
 * economy — a thank-you, not a promotion.
 *
 * Two rungs, cut at v1's measured percentiles (`v1-reference.md`, 1403
 * wallets: median 20, p90 9,136, p99 37,821, max 2.28M):
 *
 * | rung | v1 balance | gift          | roughly |
 * | ---- | ---------- | ------------- | ------- |
 * | p99  | ≥ 37,821   | lifetime Pro+ | 14      |
 * | p90  | ≥ 9,136    | lifetime Pro  | 140     |
 *
 * Ordered **highest first**, and `lifetimeGrantFor` takes the first match, so
 * a p99 balance gets Pro+ rather than also matching the p90 rung below it.
 * The median wallet holds 20 tokens, so either cut separates cleanly; nobody
 * lands here by accident.
 *
 * **This is granted through RevenueCat, never by writing `profiles.entitlement`
 * directly.** The server treats RevenueCat as the only authority on
 * entitlement — `refreshEntitlement` overwrites the stored tier with whatever
 * RevenueCat reports — so a database-only gift is erased by the next
 * `/billing/refresh` the app makes.
 */
export const LOYALTY_LIFETIME_GRANTS = [
  { minLegacyTokenBalance: 37_821, tier: 'pro_plus', entitlements: ['pro_plus', 'pro'] },
  { minLegacyTokenBalance: 9_136, tier: 'pro', entitlements: ['pro'] },
] as const satisfies readonly LifetimeGrantRung[]

/**
 * The rung a v1 balance earns, or `null` for the great majority who earn none.
 * A missing or nonsensical balance never qualifies — an absent number is not a
 * large one.
 */
export function lifetimeGrantFor(
  legacyTokenBalance: number | undefined | null,
): LifetimeGrantRung | null {
  if (typeof legacyTokenBalance !== 'number' || !Number.isFinite(legacyTokenBalance)) return null
  return (
    LOYALTY_LIFETIME_GRANTS.find((rung) => legacyTokenBalance >= rung.minLegacyTokenBalance) ?? null
  )
}

/**
 * Event types that grant or extend paid access. `TRANSFER` is the odd one out
 * twice over: it has no `app_user_id` (the recipient comes from
 * `transferred_to`) and no `entitlement_ids`, so the handler reconciles the
 * recipient against RevenueCat instead of reading the event. The
 * `transferred_from` side (the account losing access) isn't revoked by this
 * MVP; a stale grant there self-corrects at its own `expiresAt` or the next
 * real event.
 */
export const ENTITLEMENT_GRANT_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'TRANSFER',
] as const

/** Definitive, immediate loss of access. */
export const ENTITLEMENT_REVOKE_EVENTS = ['EXPIRATION'] as const

/** Access continues until `expiresAt`; only `willRenew` flips. */
export const ENTITLEMENT_CANCEL_EVENTS = ['CANCELLATION'] as const
