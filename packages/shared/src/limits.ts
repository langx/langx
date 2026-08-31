import { z } from 'zod'

/**
 * Deliberately **not** an ordered scale. Nothing in the codebase compares
 * tiers (`tier > 'free'` appears nowhere), and that is what makes adding a
 * third one cheap: `PLAN_LIMITS` below is a `Record<PlanTier, PlanLimits>`,
 * so TypeScript demands exactly one new row and every existing `hasFeature` /
 * `quotaLimit` call keeps working untouched.
 *
 * Keep it that way. The moment one guard asks "is this tier at least X", the
 * table stops being the single source of truth and the ordering becomes a
 * second one that can disagree with it.
 */
export const PLAN_TIERS = ['free', 'pro', 'pro_plus'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]
export const planTierSchema = z.enum(PLAN_TIERS)

/** The tiers that can actually be bought — what a paywall has columns for. */
export const PAID_PLAN_TIERS = ['pro', 'pro_plus'] as const
export type PaidPlanTier = (typeof PAID_PLAN_TIERS)[number]

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
   * Unlimited on every tier, deliberately. Writing a correction is a favour to
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
   * Gender, "only my gender" and city in discovery — the exact set is
   * `DISCOVERY_PRO_FILTER_KEYS`.
   *
   * Country, age and CEFR level used to be here and are free. They are how
   * somebody finds a partner they can actually talk to, and charging for that
   * made the free tier worse at the one thing the product is for. What stayed
   * paid narrows *who* rather than *how well they fit*.
   *
   * This used to say "distance" as well, and still must not. Distance is a
   * Pro+ *sort* (`nearby` below), not a Pro filter, and the two are bought
   * separately — since the paywall copy is derived from this list, naming
   * distance here would sell a Pro subscriber something their tier does not
   * include.
   */
  advancedFilters: boolean
  /** See *who* viewed the profile, not just how many. */
  profileViewerIdentities: boolean
  /** Browse without leaving a profileViews record. */
  incognito: boolean
  /**
   * Turn off the green dot: nobody sees you as online, and you still see them.
   *
   * Separate from `incognito`, which is about *who viewed my profile* and has
   * never touched presence. One flag doing both would make the store's
   * privacy description and the paywall copy wrong about each other.
   */
  hideOnlineStatus: boolean
  /**
   * Distance-sorted discovery (`sort=nearby`).
   *
   * Pro+ only, and gates the *sort* alone. Sharing a location is free and
   * always was: a paid-only pool would have nobody in it on the day it
   * shipped, and the people worth finding nearby are mostly not the people
   * paying to look.
   */
  nearby: boolean
  /**
   * The AI language copilot — the one paid feature v1 ever promised publicly
   * (`architecture.md:425`).
   *
   * Pro+ only, and the actual justification for the price gap: unlike nearby,
   * a copilot call has a real per-request cost. **Still unimplemented** — the
   * flag exists so the entitlement, the paywall copy and the eventual guard
   * read one definition instead of three.
   */
  copilot: boolean
  /**
   * Photos on a profile, avatar excluded.
   *
   * The same on every tier on purpose. A gallery is how someone shows they are
   * a real person, and gating it would make free profiles look like the
   * throwaway accounts the product is trying to keep out.
   *
   * Because it is identical everywhere, two call sites read `PLAN_LIMITS.free`
   * directly rather than the viewer's tier (`profiles.ts` addPhoto,
   * `edit-profile.tsx`). That is safe **only while this stays uniform** — give
   * one tier a different allowance and those two places go quietly wrong.
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
    hideOnlineStatus: false,
    nearby: false,
    copilot: false,
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
    hideOnlineStatus: true,
    nearby: false,
    copilot: false,
    maxPhotos: 6,
  },
  /**
   * A strict superset of `pro` — every value here is pro's, with `nearby` and
   * `copilot` flipped on. That is the whole difference, and it is why the
   * RevenueCat Pro+ products grant both the `pro_plus` **and** the `pro`
   * entitlement: a subscriber who is one is always also the other.
   */
  pro_plus: {
    initiationsPer24h: null,
    translationsPer24h: null,
    correctionsPer24h: null,
    mediaPer24h: null,
    advancedFilters: true,
    profileViewerIdentities: true,
    incognito: true,
    hideOnlineStatus: true,
    nearby: true,
    copilot: true,
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
export const PRO_FEATURES = [
  'advancedFilters',
  'profileViewerIdentities',
  'incognito',
  'hideOnlineStatus',
] as const
export type ProFeature = (typeof PRO_FEATURES)[number]

/**
 * Capabilities only `pro_plus` unlocks. Split from `PRO_FEATURES` rather than
 * appended to it because the rules test asserts every `PRO_FEATURES` entry is
 * true on `pro` — merging the two lists would have made that assertion false
 * and, worse, made a Pro subscriber's refused nearby request look like a bug
 * in the guard rather than the tier boundary working.
 */
export const PRO_PLUS_FEATURES = ['nearby', 'copilot'] as const
export type ProPlusFeature = (typeof PRO_PLUS_FEATURES)[number]

/** Every gated capability, whichever tier unlocks it. */
export const PLAN_FEATURES = [...PRO_FEATURES, ...PRO_PLUS_FEATURES] as const
export type PlanFeature = ProFeature | ProPlusFeature

/**
 * Everything Pro gives you, which is deliberately **wider** than
 * `PRO_FEATURES`: two of these are not capability flags at all but quotas that
 * stop applying, and a paywall that listed only the booleans would undersell
 * the plan by leaving out the limit most people actually hit.
 *
 * The paywall keys its copy off this list, so adding a benefit here without
 * writing the copy is a compile error, and describing a benefit on the paywall
 * that does not exist here is impossible. That is the whole point: the feature
 * list had drifted into three separate places — here, the rules test and the
 * paywall screen — and the first one to change would have made the other two
 * quietly lie.
 */
export const PRO_BENEFITS = [
  'unlimitedInitiations',
  'advancedFilters',
  'unlimitedTranslation',
  'profileViewerIdentities',
  'incognito',
  'hideOnlineStatus',
  /**
   * A one-off welcome pack — cosmetics and streak freezes, never token. See
   * `PRO_WELCOME_PACKS`, and the note there on why granting token for money is
   * the one thing this economy cannot do.
   *
   * Last in the list on purpose: it is a nice-to-have beside five capabilities,
   * and leading with it would sell the subscription on a gift.
   */
  'welcomePack',
] as const
export type ProBenefit = (typeof PRO_BENEFITS)[number]

/**
 * What Pro+ adds **on top of** Pro — not a replacement list. The paywall
 * renders `PRO_BENEFITS` for the Pro column and these two extra rows for the
 * Pro+ one, so the superset relationship is visible in the copy instead of
 * being re-typed and left to drift.
 */
export const PRO_PLUS_BENEFITS = ['nearby', 'copilot'] as const
export type ProPlusBenefit = (typeof PRO_PLUS_BENEFITS)[number]

export function hasFeature(tier: PlanTier, feature: PlanFeature): boolean {
  return PLAN_LIMITS[tier][feature]
}

/** Any tier that is not `free`. Not an ordering — see `PLAN_TIERS`. */
export function isPaidTier(tier: PlanTier): boolean {
  return tier !== 'free'
}

/**
 * The cheapest tier that unlocks a capability, for a paywall that has been
 * told *why* it was opened and has to point at the right column.
 *
 * This is the one place that leans on `PAID_PLAN_TIERS` being listed
 * cheapest-first, and it is a presentation concern rather than the tier
 * ordering ruled out on `PLAN_TIERS`: no guard calls it, and getting it wrong
 * upsells someone to a plan they did not need instead of letting them past a
 * gate. It still reads the real `PLAN_LIMITS` rows, so a capability moved
 * between tiers moves the answer with it.
 */
export function tierUnlocking(feature: PlanFeature): PaidPlanTier | null {
  for (const tier of PAID_PLAN_TIERS) {
    if (PLAN_LIMITS[tier][feature]) return tier
  }
  return null
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
 *
 * The guard below reads `tier === 'free'` rather than `tier !== 'pro'`. With
 * only two tiers those were the same test; with three, the second one lets a
 * **Pro+ subscription expire without ever dropping** — it would return early
 * and hand back `pro_plus` forever.
 */
export function effectivePlanTier(tier: PlanTier, expiresAt?: Date | string | null): PlanTier {
  if (tier === 'free' || !expiresAt) return tier
  const at = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt)
  // An unparseable date is not evidence of expiry — treat it as no expiry
  // rather than silently downgrading someone who is paying.
  if (Number.isNaN(at)) return tier
  return at <= Date.now() ? 'free' : tier
}
