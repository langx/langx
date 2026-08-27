import { z } from 'zod'

export const PLAN_TIERS = ['free', 'pro'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]
export const planTierSchema = z.enum(PLAN_TIERS)

/** `null` means unlimited. */
export type Limit = number | null

export interface PlanLimits {
  /**
   * New conversations a user may *start* in any rolling 24 hours. Replying to
   * an inbound message never costs quota — only the first message into a
   * conversation the user has not spoken in before.
   */
  initiationsPer24h: Limit
  /** Machine translations per rolling 24 hours. */
  translationsPer24h: Limit
  /**
   * Corrections written per rolling 24 hours.
   *
   * Unlimited on both tiers, deliberately. Writing a correction is a favour to
   * the other person; rate-limiting free users would also shrink the value Pro
   * users receive. Pro's revenue rests on filters, translation and incognito.
   */
  correctionsPer24h: Limit
  /**
   * Image and voice messages per rolling 24 hours.
   *
   * Capped on the free tier where corrections are not, and the difference is
   * cost: a correction is text someone else benefits from, while an
   * attachment is bytes we store and serve forever. Set high enough that a
   * normal conversation never meets it — this is a ceiling on abuse, not a
   * paywall, and v1 offered both features free.
   */
  mediaPer24h: Limit
  /**
   * gender / country / age / level filters in discovery — the exact set is
   * `DISCOVERY_PRO_FILTER_KEYS`.
   *
   * This used to say "distance" as well. There is no distance filter and there
   * never was: `$geoNear` has to be an aggregation's first stage, which the
   * discovery pipeline cannot give it (`decisions.md:66-76`). Since the paywall
   * copy is derived from this list, leaving the word in was a route to selling
   * something that cannot be bought.
   */
  advancedFilters: boolean
  /** See *who* viewed the profile, not just how many. */
  profileViewerIdentities: boolean
  /** Browse without leaving a profileViews record. */
  incognito: boolean
  /**
   * Photos on a profile, avatar excluded.
   *
   * The same on both tiers on purpose. A gallery is how someone shows they are
   * a real person, and gating it would make free profiles look like the
   * throwaway accounts the product is trying to keep out.
   */
  maxPhotos: number
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    initiationsPer24h: 5,
    translationsPer24h: 20,
    correctionsPer24h: null,
    mediaPer24h: 50,
    advancedFilters: false,
    profileViewerIdentities: false,
    incognito: false,
    maxPhotos: 6,
  },
  pro: {
    initiationsPer24h: null,
    translationsPer24h: null,
    correctionsPer24h: null,
    mediaPer24h: null,
    advancedFilters: true,
    profileViewerIdentities: true,
    incognito: true,
    maxPhotos: 6,
  },
}

/** Quota buckets that are enforced with a rolling 24h timestamp array. */
export const QUOTA_KINDS = ['initiations', 'translations', 'corrections', 'media'] as const
export type QuotaKind = (typeof QUOTA_KINDS)[number]

const QUOTA_LIMIT_KEY = {
  initiations: 'initiationsPer24h',
  translations: 'translationsPer24h',
  corrections: 'correctionsPer24h',
  media: 'mediaPer24h',
} as const satisfies Record<QuotaKind, keyof PlanLimits>

export function quotaLimit(tier: PlanTier, kind: QuotaKind): Limit {
  return PLAN_LIMITS[tier][QUOTA_LIMIT_KEY[kind]]
}

/**
 * Pro-only *capabilities* — the boolean gates, keyed for the
 * `403 UPGRADE_REQUIRED` payload. `hasFeature` reads these directly off
 * `PLAN_LIMITS`, so this list cannot drift from what the server enforces.
 */
export const PRO_FEATURES = ['advancedFilters', 'profileViewerIdentities', 'incognito'] as const
export type ProFeature = (typeof PRO_FEATURES)[number]

/**
 * Everything Pro gives you, which is deliberately **wider** than
 * `PRO_FEATURES`: two of these are not capability flags at all but quotas that
 * stop applying, and a paywall that listed only the booleans would undersell
 * the plan by leaving out the limit most people actually hit.
 *
 * The paywall keys its copy off this list, so adding a benefit here without
 * writing the copy is a compile error, and describing a benefit on the paywall
 * that does not exist here is impossible. That is the whole point: the feature
 * list had drifted into three separate places — here, the rules test, and the
 * paywall screen — and the first one to change would have made the other two
 * quietly lie.
 */
export const PRO_BENEFITS = [
  'unlimitedInitiations',
  'advancedFilters',
  'unlimitedTranslation',
  'profileViewerIdentities',
  'incognito',
] as const
export type ProBenefit = (typeof PRO_BENEFITS)[number]

export function hasFeature(tier: PlanTier, feature: ProFeature): boolean {
  return PLAN_LIMITS[tier][feature]
}

export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * The tier a guard should actually enforce, given a stored entitlement.
 *
 * `tier` alone is not enough: a lapsed subscription whose RevenueCat
 * `EXPIRATION` webhook has not arrived — or never will, since delivery is not
 * guaranteed — must not keep granting Pro forever.
 *
 * Lives in `shared` because **both sides have to agree**. The server has
 * always applied this; the client read `entitlement.tier` directly, so a late
 * webhook produced an app showing a Pro interface while every Pro action was
 * refused. Two implementations of one rule is how that happened, so there is
 * now one — and it takes `expiresAt` as a `Date` or an ISO string, because the
 * server holds the first and JSON gives the client the second.
 */
export function effectivePlanTier(tier: PlanTier, expiresAt?: Date | string | null): PlanTier {
  if (tier !== 'pro' || !expiresAt) return tier
  const at = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt)
  // An unparseable date is not evidence of expiry — treat it as no expiry
  // rather than silently downgrading someone who is paying.
  if (Number.isNaN(at)) return tier
  return at <= Date.now() ? 'free' : tier
}
