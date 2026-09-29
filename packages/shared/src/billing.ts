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
   * Read so that an event for an entitlement this code does not sell leaves
   * the profile alone rather than granting Pro.
   *
   * Nullable because RevenueCat sends `null` for events that belong to no
   * entitlement, and optional because a webhook from before this field
   * existed, or a test fixture, must still parse.
   */
  entitlement_ids: z.array(z.string()).nullable().optional(),
  /**
   * `TRIAL`, `INTRO` or `NORMAL` — whether the subscriber is paying yet.
   *
   * Read for one reason: a trial ending and a subscription ending are the
   * same three fields on a profile (`expiresAt` soon, `willRenew` false), so
   * without this there is no way to word a letter about the first without
   * sending it to the second. RevenueCat has always sent it; nothing here
   * looked.
   *
   * Optional and unconstrained, like every other field on this event: a
   * payload from before it existed, or a fixture, must still parse.
   */
  period_type: z.string().nullable().optional(),
})
export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>

/**
 * Whether an entitlement is being paid for yet. `null` is not "no" — it is
 * "RevenueCat did not say", which is what every event before this field was
 * read looks like, and what a promotional grant looks like today.
 */
export type BillingPeriodType = 'trial' | 'intro' | 'normal'

/** RevenueCat spells these in capitals, and only these three exist. */
export function periodTypeOf(raw: string | null | undefined): BillingPeriodType | null {
  const value = raw?.trim().toLowerCase()
  return value === 'trial' || value === 'intro' || value === 'normal' ? value : null
}

export const revenueCatWebhookBodySchema = z.object({
  api_version: z.string().optional(),
  event: revenueCatEventSchema,
})
export type RevenueCatWebhookBody = z.infer<typeof revenueCatWebhookBodySchema>

/**
 * RevenueCat entitlement identifier → the tier it grants. These strings are
 * configured in the RevenueCat dashboard and must match it exactly.
 *
 * Both map to `pro`. `pro_plus` was Polyglot's entitlement before the two paid
 * plans became one; an entitlement id cannot be renamed or retired while
 * anyone holds it, so it keeps arriving — on Polyglot subscriptions that are
 * still renewing, and on the v1 lifetime gifts that were granted as Polyglot —
 * and it means Pro. Every paid product also grants `pro` itself.
 */
export const ENTITLEMENT_TIERS = {
  pro: 'pro',
  pro_plus: 'pro',
} as const satisfies Record<string, PlanTier>

export type EntitlementId = keyof typeof ENTITLEMENT_TIERS

/**
 * The entitlement ids a paid tier hands out — the mirror image of
 * `tierFromEntitlementIds`. Written down once so that everything which has to
 * reproduce a purchase — the loyalty gift below, the fake store the local
 * harness buys from — says it the same way.
 */
export const TIER_ENTITLEMENTS = {
  pro: ['pro'],
} as const satisfies Record<PaidPlanTier, readonly EntitlementId[]>

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
 * packages are what the paywall *offers*.
 *
 * The offering still carries `pro_plus_monthly` and `pro_plus_yearly`, for the
 * apps released before the single plan — they draw a Polyglot column from
 * them, now at Pro's price. They are left out here on purpose: a package not
 * in this map does not render, which is how this code ignores them.
 */
export const PACKAGES = {
  $rc_monthly: { tier: 'pro', period: 'monthly' },
  $rc_annual: { tier: 'pro', period: 'yearly' },
  $rc_lifetime: { tier: 'pro', period: 'lifetime' },
} as const satisfies Record<string, PackageDefinition>

export function packageDefinition(id: string): PackageDefinition | null {
  return (PACKAGES as Record<string, PackageDefinition | undefined>)[id] ?? null
}

/**
 * The tier a set of active entitlement ids amounts to, or `null` when none of
 * them is one we sell. Unknown ids are ignored rather than rejected: an
 * entitlement added in the dashboard before the code knows about it should
 * leave the user where they are, not throw a webhook into RevenueCat's retry
 * loop.
 */
export function tierFromEntitlementIds(ids: readonly string[] | null | undefined): PlanTier | null {
  const known = ids?.find((id): id is EntitlementId =>
    Object.prototype.hasOwnProperty.call(ENTITLEMENT_TIERS, id),
  )
  return known ? ENTITLEMENT_TIERS[known] : null
}

export interface LifetimeGrantRung {
  /** Inclusive floor on the v1 token balance. */
  minLegacyTokenBalance: number
  /** The tier the recipient ends up on. */
  tier: PaidPlanTier
  /** Every entitlement to grant. */
  entitlements: readonly EntitlementId[]
}

/**
 * Lifetime access, given to the v1 accounts that genuinely earned in the old
 * economy — a thank-you, not a promotion.
 *
 * One rung, cut at v1's measured p90 (`v1-reference.md`, 1403 wallets: median
 * 20, p90 9,136, p99 37,821, max 2.28M) — roughly 150 people. There were two
 * while there were two paid plans (p99 got Polyglot); with one plan both rungs
 * give the same thing, so they are one.
 *
 * **This is granted through RevenueCat, never by writing `profiles.entitlement`
 * directly.** The server treats RevenueCat as the only authority on
 * entitlement — `refreshEntitlement` overwrites the stored tier with whatever
 * RevenueCat reports — so a database-only gift is erased by the next
 * `/billing/refresh` the app makes.
 */
export const LOYALTY_LIFETIME_GRANTS = [
  { minLegacyTokenBalance: 9_136, tier: 'pro', entitlements: TIER_ENTITLEMENTS.pro },
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
