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
  /** gender / country / distance / age / CEFR filters in discovery. */
  advancedFilters: boolean
  /** See *who* viewed the profile, not just how many. */
  profileViewerIdentities: boolean
  /** Browse without leaving a profileViews record. */
  incognito: boolean
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    initiationsPer24h: 5,
    translationsPer24h: 20,
    correctionsPer24h: null,
    advancedFilters: false,
    profileViewerIdentities: false,
    incognito: false,
  },
  pro: {
    initiationsPer24h: null,
    translationsPer24h: null,
    correctionsPer24h: null,
    advancedFilters: true,
    profileViewerIdentities: true,
    incognito: true,
  },
}

/** Quota buckets that are enforced with a rolling 24h timestamp array. */
export const QUOTA_KINDS = ['initiations', 'translations', 'corrections'] as const
export type QuotaKind = (typeof QUOTA_KINDS)[number]

const QUOTA_LIMIT_KEY = {
  initiations: 'initiationsPer24h',
  translations: 'translationsPer24h',
  corrections: 'correctionsPer24h',
} as const satisfies Record<QuotaKind, keyof PlanLimits>

export function quotaLimit(tier: PlanTier, kind: QuotaKind): Limit {
  return PLAN_LIMITS[tier][QUOTA_LIMIT_KEY[kind]]
}

/** Pro-only capabilities, keyed for the `403 UPGRADE_REQUIRED` payload. */
export const PRO_FEATURES = ['advancedFilters', 'profileViewerIdentities', 'incognito'] as const
export type ProFeature = (typeof PRO_FEATURES)[number]

export function hasFeature(tier: PlanTier, feature: ProFeature): boolean {
  return PLAN_LIMITS[tier][feature]
}

export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000
