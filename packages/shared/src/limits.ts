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
  /**
   * Machine translations per rolling 24 hours.
   *
   * Finite on **every** tier, unlike the other quotas here. Translation is the
   * one feature with a real per-request cost — Google bills per character — so
   * "unlimited" was a promise made against somebody else's meter. A number
   * high enough that ordinary use never meets it is honest; the word was not.
   */
  translationsPer24h: number
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
  /**
   * Sending your own message with a translation under it, rather than tapping
   * one you received to read it.
   *
   * Polyglot, beside the copilot, because the two are the same kind of thing:
   * the only capabilities in this file with a real per-request cost. Reading
   * is occasional and metered at `translationsPer24h`; *sending* translated is
   * per message, so somebody writing a hundred messages a day bills roughly a
   * hundred translations a day. At Google's per-character price that is more
   * per month than a subscription costs, which makes a generous free
   * allowance a promise made against somebody else's meter — the same
   * sentence `translationsPer24h` is here for.
   *
   * **Reading stays free.** The free tier loses nothing it had: tap-to-
   * translate is untouched at 20 a day. This gates the composer mode only,
   * which is why it is a capability and not a smaller number.
   */
  sendTranslation: boolean
  /**
   * Exporting a conversation's saved phrases as a file — CSV, and the same
   * file imports into Anki.
   *
   * Polyglot, and the rare paid feature that takes nothing from anyone: the
   * deck itself, and saving to it, are free on every tier. This sells getting
   * it *out*, which is what somebody studying seriously wants and nobody else
   * misses. Costs nothing per request, so it is not here for the reason
   * `sendTranslation` is — it is here because it is worth money to the person
   * it is worth anything to.
   */
  deckExport: boolean
  /**
   * See *who* viewed the profile, not just how many.
   *
   * Polyglot, not Fluent. Fluent sells what makes the app work better for you
   * — unlimited conversations, the filters, more languages. This one is about
   * other people, which is what the higher tier is for.
   */
  profileViewerIdentities: boolean
  /**
   * Browse without leaving a profileViews record.
   *
   * Polyglot, for the same reason as `profileViewerIdentities`: the two are a
   * pair — one is seeing who looked, the other is not being seen looking — and
   * splitting them across tiers would sell half a promise.
   */
  incognito: boolean
  /**
   * `hideOnlineStatus` used to live here as a paid capability and is now free
   * on every tier, so it is not a plan limit at all — it is a privacy setting,
   * like `activityMapVisible` beside it in `profile.privacy`.
   *
   * It was freed when the app started *rendering* `lastActiveAt`. The field was
   * already on the wire but nothing had ever drawn it, so showing "last seen
   * three months ago" publishes something about a dormant user that nobody had
   * seen before — and charging for the switch that turns off a disclosure we
   * have just started making is not defensible. Same argument as level, age and
   * country going back to the free tier above.
   *
   * Do not re-add it as a uniform `true`: `hasFeature` and `tierUnlocking`
   * would then keep answering a question that has no paid answer.
   */
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
   * A ladder, and it was not always one: every tier had six until the gallery
   * became something a subscription buys. Free still gets five, which is a
   * real gallery — enough to show you are a person rather than a throwaway
   * account, which is the thing the product cannot afford to gate.
   *
   * Read it off the **viewer's** tier, always. While it was uniform two call
   * sites read `PLAN_LIMITS.free` directly and were correct by accident; both
   * take the tier now, and nothing may go back to the free row except the v1
   * restore in `legacyProfiles.ts`, where a claiming account really is free.
   */
  maxPhotos: number
  /**
   * Languages a profile may list, learning and native.
   *
   * Enforced at write time only. Zod cannot express a tier-dependent maximum:
   * a route schema is registered at boot, before any request exists, so it has
   * no tier to consult. See `updateProfile`.
   */
  maxLearningLanguages: number
  /**
   * The same ladder as learning languages, so it is one rule rather than two.
   *
   * Worth knowing what it costs, though: discovery's mutual-fit match reads the
   * viewer's `nativeLanguages`, so a tier held to one native language is not
   * only limited — they are findable by fewer people. For somebody raised
   * bilingual a second native language is an identity fact, not a feature.
   */
  maxNativeLanguages: number
  /**
   * Replies the @langx assistant will give this account in any twenty-four
   * hours.
   *
   * Per tier because the assistant is the one limit here with a real marginal
   * cost — every reply is a paid model call — and a flat number would have
   * meant an account paying nothing and an account paying for a year getting
   * the same allowance. Worked from the price list: the ceiling for a tier is
   * kept under what that tier brings in, in the script that costs most to
   * write. See `OFFICIAL_ASSISTANT` for the arithmetic.
   *
   * It gates the assistant, never the thing behind it. Reporting somebody from
   * their profile, sending feedback from Settings and writing to the support
   * address are unlimited on every tier, including free — what a tier buys is
   * the convenience of doing it in a conversation.
   */
  assistantRepliesPerDay: number
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    initiationsPer24h: 5,
    translationsPer24h: 20,
    correctionsPer24h: null,
    mediaPer24h: 50,
    advancedFilters: false,
    sendTranslation: false,
    deckExport: false,
    profileViewerIdentities: false,
    incognito: false,
    nearby: false,
    copilot: false,
    maxPhotos: 5,
    maxLearningLanguages: 1,
    maxNativeLanguages: 1,
    assistantRepliesPerDay: 5,
  },
  pro: {
    initiationsPer24h: null,
    translationsPer24h: 300,
    correctionsPer24h: null,
    mediaPer24h: null,
    advancedFilters: true,
    sendTranslation: false,
    deckExport: false,
    profileViewerIdentities: false,
    incognito: false,
    nearby: false,
    copilot: false,
    maxPhotos: 10,
    maxLearningLanguages: 2,
    maxNativeLanguages: 2,
    assistantRepliesPerDay: 10,
  },
  /**
   * A strict superset of `pro` — every value here is pro's, with `nearby` and
   * `copilot` flipped on. That is the whole difference, and it is why the
   * RevenueCat Pro+ products grant both the `pro_plus` **and** the `pro`
   * entitlement: a subscriber who is one is always also the other.
   */
  pro_plus: {
    initiationsPer24h: null,
    translationsPer24h: 1000,
    correctionsPer24h: null,
    mediaPer24h: null,
    advancedFilters: true,
    sendTranslation: true,
    deckExport: true,
    profileViewerIdentities: true,
    incognito: true,
    nearby: true,
    copilot: true,
    maxPhotos: 10,
    maxLearningLanguages: 5,
    maxNativeLanguages: 5,
    assistantRepliesPerDay: 15,
  },
}

/**
 * What the plans are called, in one place.
 *
 * Brand marks, not copy: the same words in every locale, and what the store
 * listing and the receipt say. They lived as literals in six places — the
 * paywall, `TierBadge`, `me`, three rows of Settings and the filters header —
 * which is five opportunities for a rename to be half-applied.
 *
 * These are **display only**. The RevenueCat entitlement ids and the `PACKAGES`
 * keys stay `pro` / `pro_plus` forever: an entitlement identifier cannot be
 * renamed after creation, and fixing one was free exactly once, before there
 * were customers.
 */
export const TIER_NAMES: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Fluent',
  pro_plus: 'Polyglot',
}

/**
 * The short form for a chip, or `null` where there should be no chip at all.
 *
 * Free is `null` rather than `'FREE'`: an absent badge is the free state, and a
 * chip reading "FREE" is an insult, not information.
 */
export const TIER_BADGES: Record<PlanTier, string | null> = {
  free: null,
  pro: 'FLUENT',
  pro_plus: 'POLYGLOT',
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
export const PRO_FEATURES = ['advancedFilters'] as const
export type ProFeature = (typeof PRO_FEATURES)[number]

/**
 * Capabilities only `pro_plus` unlocks. Split from `PRO_FEATURES` rather than
 * appended to it because the rules test asserts every `PRO_FEATURES` entry is
 * true on `pro` — merging the two lists would have made that assertion false
 * and, worse, made a Pro subscriber's refused nearby request look like a bug
 * in the guard rather than the tier boundary working.
 */
export const PRO_PLUS_FEATURES = [
  'profileViewerIdentities',
  'incognito',
  'nearby',
  'copilot',
  'sendTranslation',
  'deckExport',
] as const
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
  'translationQuota',
  'learningLanguages',
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
/**
 * What Polyglot adds **on top of** Fluent — not a replacement list.
 *
 * `translationQuota` and `learningLanguages` appear in *both* lists on purpose:
 * the paywall renders Fluent's benefits, then these plus "everything in
 * Fluent", and Polyglot genuinely raises both of those *numbers* again.
 * Omitting them would let "everything in Fluent" imply the same allowance,
 * which is the quiet kind of mis-sell the `shipped` flag on the copy table
 * exists to prevent.
 */
export const PRO_PLUS_BENEFITS = [
  'profileViewerIdentities',
  'incognito',
  'nearby',
  'copilot',
  'sendTranslation',
  'deckExport',
  'translationQuota',
  'learningLanguages',
] as const
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
