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
  /** gender / country / distance / age / CEFR filters in discovery. */
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

/** Pro-only capabilities, keyed for the `403 UPGRADE_REQUIRED` payload. */
export const PRO_FEATURES = ['advancedFilters', 'profileViewerIdentities', 'incognito'] as const
export type ProFeature = (typeof PRO_FEATURES)[number]

export function hasFeature(tier: PlanTier, feature: ProFeature): boolean {
  return PLAN_LIMITS[tier][feature]
}

export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000
