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
export const PLAN_TIERS = ['free', 'pro'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]
export const planTierSchema = z.enum(PLAN_TIERS)

/**
 * Every tier a stored document may still carry.
 *
 * There used to be two paid plans, Fluent (`pro`) and Polyglot (`pro_plus`),
 * and they were merged into one. `pro_plus` survives in two places the merge
 * cannot reach at once: rows written before `scripts/merge-pro-tiers.ts` ran,
 * and the wire to apps released before the merge, which unlock features off
 * their own profile's tier and would lock half of Pro behind "Upgrade to
 * Polyglot" if they were told `pro` (`toOwnProfileWire`). So a stored tier is
 * read through `normalizePlanTier` — never indexed into `PLAN_LIMITS` raw,
 * where an unknown key is `undefined` and the request a 500.
 */
export const STORED_PLAN_TIERS = ['free', 'pro', 'pro_plus'] as const
export type StoredPlanTier = (typeof STORED_PLAN_TIERS)[number]
export const storedPlanTierSchema = z.enum(STORED_PLAN_TIERS)

/**
 * The tier a stored value means today: `pro_plus` is `pro`, and anything this
 * code does not know — a typo, a tier from a future or past schema — is
 * `free`, because a missing row in `PLAN_LIMITS` would otherwise throw.
 */
export function normalizePlanTier(stored: string | null | undefined): PlanTier {
  if (stored === 'pro' || stored === 'pro_plus') return 'pro'
  return 'free'
}

/** The tiers that can actually be bought. One since the Fluent/Polyglot merge. */
export const PAID_PLAN_TIERS = ['pro'] as const
export type PaidPlanTier = (typeof PAID_PLAN_TIERS)[number]
/** A paid tier as a stored document may still spell it. */
export type StoredPaidPlanTier = Exclude<StoredPlanTier, 'free'>

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
   * New Echo cards a person may start reviewing in a day.
   *
   * Unlimited on every tier, and the one Echo row that may ever be metered.
   * It exists from the first day so that capping intake later is a config
   * change rather than a migration — but nothing in the app, on the website
   * or in the store copy says "forever".
   */
  echoNewCardsPerDay: Limit
  /**
   * Messages and posts turned into Echo cards per rolling 24 hours.
   *
   * The same number on every tier, deliberately. Capture asks the server to
   * translate a sentence that was not translated in the thread, so it has a
   * real per-request cost — this is the ceiling that stops Add echo becoming
   * a free translator, and it is set high enough that ordinary use never
   * meets it. **Not a paywall**, and it must never be sold as one: a refusal
   * shows a plain alert, not the upgrade screen.
   */
  echoCapturesPerDay: Limit
  /**
   * Cards reviewed per rolling 24 hours.
   *
   * Unlimited on every tier, ever. Reviewing is the thing the module is for
   * and it costs us nothing; a person who wants to sit with their cards for
   * an hour is the best outcome this feature has.
   */
  echoReviewsPerDay: Limit
  /**
   * Cards a person may have read aloud by the server voice per rolling 24
   * hours — one unit per card, however many voices it is read in.
   *
   * Finite on every tier, like `translationsPer24h`, and for a cousin of that
   * reason: synthesis is CPU seconds on a machine of ours rather than a bill
   * from someone else's, so the number is a ceiling on how long that machine
   * stays awake, not a meter on cost. A pack's readings do not count — they
   * were made once, offline, and a card started from a pack arrives with them.
   */
  echoVoicesPerDay: Limit
  /**
   * Messages a person may have read aloud in chat per rolling 24 hours — one
   * unit per reading, and only when nobody has had that sentence read before.
   *
   * Its own ceiling rather than a share of `echoVoicesPerDay`, because the two
   * behave nothing alike. An Echo card is kept deliberately, a few a day; a
   * chat message offers the button on every bubble. Sharing one bucket would
   * let an afternoon of chat silence the Echo button, and a limit nobody can
   * see reads as a broken feature rather than as a ceiling.
   *
   * The number is also the storage budget: a miss writes a permanent,
   * content-addressed object of 100-200 KB that nothing ever deletes. A hit
   * costs neither a unit nor a byte.
   */
  chatVoicesPerDay: Limit
  /**
   * Voice notes a person may have written out as text per rolling 24 hours —
   * one unit per note, and only for the first person to ask: the words are
   * kept on the note, so the other person, and the same person again, read
   * them for nothing.
   *
   * Finite on every tier, for `chatVoicesPerDay`'s reason: this is CPU on a
   * machine of ours, not somebody else's bill, so the number is a ceiling on
   * how long that machine stays awake. Lower than the readings beside it,
   * because a note can be two minutes of speech where a reading is one
   * sentence — a transcript costs the machine several times what a reading
   * does. **Not a paywall**: a refusal is a plain alert, like the readings'.
   */
  transcriptsPerDay: Limit
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
   * *sort* (`nearby` below), not a filter; the paywall copy is derived from
   * these lists and each names one thing.
   */
  advancedFilters: boolean
  /**
   * Appearing in the Boosted strip above the discovery list.
   *
   * Pro, which `DISCOVERY_BOOSTED_TIERS` names and `rules.test.ts` pins to
   * this flag. The switch on the profile is `settings.boosted`, and an absent
   * one means on: a first-time subscriber is boosted the moment the
   * entitlement lands, with no billing-side hook to write a default.
   *
   * The tier is re-read on every request, so an explicit `true` on a free
   * profile buys nothing — same shape as `incognito`, which is also stored
   * without a write-time tier guard.
   */
  boostedProfile: boolean
  /**
   * Sending your own message with a translation under it, rather than tapping
   * one you received to read it.
   *
   * Paid, beside the copilot, because the two are the same kind of thing:
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
   * Paid, and the rare paid feature that takes nothing from anyone: the
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
   * Paid, and one half of a pair with `incognito` below.
   */
  profileViewerIdentities: boolean
  /**
   * Browse without leaving a profileViews record.
   *
   * Paid, for the same reason as `profileViewerIdentities`: the two are a
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
   * Do not re-add it as a uniform `true`: `hasFeature` would then keep answering a question that has no paid answer.
   */
  /**
   * Distance-sorted discovery (`sort=nearby`).
   *
   * Paid, and gates the *sort* alone. Sharing a location is free and
   * always was: a paid-only pool would have nobody in it on the day it
   * shipped, and the people worth finding nearby are mostly not the people
   * paying to look.
   */
  nearby: boolean
  /**
   * The AI language copilot — the one paid feature v1 ever promised publicly
   * (`architecture.md:425`).
   *
   * Paid: unlike nearby, a copilot call has a real per-request cost. **Still unimplemented** — the
   * flag exists so the entitlement, the paywall copy and the eventual guard
   * read one definition instead of three.
   */
  copilot: boolean
  /**
   * Photos on a profile, avatar excluded.
   *
   * The same ten on every tier since the single Pro plan. It was a ladder for
   * a while (free had five), and apps from then still enforce five for a free
   * account on their own side — harmless, and nothing lowers it here.
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
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    initiationsPer24h: 5,
    translationsPer24h: 20,
    correctionsPer24h: null,
    mediaPer24h: 500,
    echoNewCardsPerDay: null,
    echoCapturesPerDay: 250,
    echoReviewsPerDay: null,
    echoVoicesPerDay: 50,
    chatVoicesPerDay: 100,
    transcriptsPerDay: 50,
    advancedFilters: false,
    boostedProfile: false,
    sendTranslation: false,
    deckExport: false,
    profileViewerIdentities: false,
    incognito: false,
    nearby: false,
    copilot: false,
    maxPhotos: 10,
    maxLearningLanguages: 1,
    maxNativeLanguages: 1,
  },
  /**
   * What Polyglot was, under Fluent's price. Media and photos are the same
   * number on both rows: they are a fair-use ceiling, not something a plan
   * sells, and refusing either shows a plain alert rather than the paywall.
   */
  pro: {
    initiationsPer24h: null,
    translationsPer24h: 1000,
    correctionsPer24h: null,
    mediaPer24h: 500,
    echoNewCardsPerDay: null,
    echoCapturesPerDay: 250,
    echoReviewsPerDay: null,
    echoVoicesPerDay: 500,
    chatVoicesPerDay: 1000,
    transcriptsPerDay: 400,
    advancedFilters: true,
    boostedProfile: true,
    sendTranslation: true,
    deckExport: true,
    profileViewerIdentities: true,
    incognito: true,
    nearby: true,
    copilot: true,
    maxPhotos: 10,
    maxLearningLanguages: 5,
    maxNativeLanguages: 5,
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
  pro: 'Pro',
}

/**
 * The short form for a chip, or `null` where there should be no chip at all.
 *
 * Free is `null` rather than `'FREE'`: an absent badge is the free state, and a
 * chip reading "FREE" is an insult, not information.
 */
export const TIER_BADGES: Record<PlanTier, string | null> = {
  free: null,
  pro: 'PRO',
}

/** Quota buckets that are enforced with a rolling 24h timestamp array. */
export const QUOTA_KINDS = [
  'initiations',
  'translations',
  'corrections',
  'media',
  'echoCaptures',
  'echoNewCards',
  'echoVoices',
  'chatVoices',
  'transcripts',
] as const
export type QuotaKind = (typeof QUOTA_KINDS)[number]

const QUOTA_LIMIT_KEY = {
  initiations: 'initiationsPer24h',
  translations: 'translationsPer24h',
  corrections: 'correctionsPer24h',
  media: 'mediaPer24h',
  echoCaptures: 'echoCapturesPerDay',
  echoNewCards: 'echoNewCardsPerDay',
  echoVoices: 'echoVoicesPerDay',
  chatVoices: 'chatVoicesPerDay',
  transcripts: 'transcriptsPerDay',
} as const satisfies Record<QuotaKind, keyof PlanLimits>

export function quotaLimit(tier: PlanTier, kind: QuotaKind): Limit {
  return PLAN_LIMITS[tier][QUOTA_LIMIT_KEY[kind]]
}

/**
 * Whether a language list of `next` entries may be written by somebody who has
 * `was` of them today, on a plan allowing `max`.
 *
 * The `next <= was` clause is the whole of the grandfathering, and it is not a
 * nicety. A migrated v1 user with five learning languages is over a free
 * tier's limit of one by definition — without it, every write they make
 * carries an over-limit array and is refused, so they could never change a
 * level, reorder their priorities, or even *remove* a language. The limit
 * would read as "your profile is frozen". Nothing is ever stripped, and
 * discovery keeps matching on whatever is stored; this only stops the list
 * growing.
 *
 * Here rather than in the API because both sides need the same answer, to the
 * character: the server decides whether to accept the write, and the client
 * decides whether "Add a language" opens the picker or explains itself. Two
 * implementations of one rule is how a dead, unexplained control gets shipped
 * — which is exactly what the edit-profile picker did, dimming every chip at
 * the cap with nothing to say why.
 */
export function languageCapAllows(next: number, was: number, max: number): boolean {
  return next <= max || next <= was
}

/**
 * Pro-only *capabilities* — the boolean gates, keyed for the
 * `403 UPGRADE_REQUIRED` payload. `hasFeature` reads these directly off
 * `PLAN_LIMITS`, so this list cannot drift from what the server enforces.
 */
export const PRO_FEATURES = [
  'advancedFilters',
  'boostedProfile',
  'profileViewerIdentities',
  'incognito',
  'nearby',
  'copilot',
  'sendTranslation',
  'deckExport',
] as const
export type ProFeature = (typeof PRO_FEATURES)[number]

/** Every gated capability. One list since there is one paid tier. */
export const PLAN_FEATURES = PRO_FEATURES
export type PlanFeature = ProFeature

/**
 * Everything Pro gives you, which is deliberately **wider** than
 * `PRO_FEATURES`: some of these are not capability flags at all but quotas
 * that stop applying or grow, and a paywall that listed only the booleans
 * would undersell the plan by leaving out the limit most people actually hit.
 *
 * The paywall keys its copy off this list, so adding a benefit here without
 * writing the copy is a compile error, and describing a benefit on the paywall
 * that does not exist here is impossible.
 */
export const PRO_BENEFITS = [
  'unlimitedInitiations',
  'advancedFilters',
  'boostedProfile',
  'profileViewerIdentities',
  'incognito',
  'nearby',
  'sendTranslation',
  'deckExport',
  'translationQuota',
  'learningLanguages',
  'copilot',
  /**
   * A one-off welcome pack — cosmetics and streak freezes, never token. See
   * `PRO_WELCOME_PACKS`, and the note there on why granting token for money is
   * the one thing this economy cannot do.
   *
   * Last in the list on purpose: it is a nice-to-have beside real
   * capabilities, and leading with it would sell the subscription on a gift.
   */
  'welcomePack',
] as const
export type ProBenefit = (typeof PRO_BENEFITS)[number]

export function hasFeature(tier: PlanTier, feature: PlanFeature): boolean {
  return PLAN_LIMITS[tier][feature]
}

/** Any tier that is not `free`. Not an ordering — see `PLAN_TIERS`. */
export function isPaidTier(tier: PlanTier): boolean {
  return tier !== 'free'
}

export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * How many accounts one network may open in a rolling day. Guest sessions are
 * not accounts and are not counted. See `docs/decisions.md` → _Sign-up refuses
 * throwaway addresses and caps accounts per network_.
 */
export const SIGN_UP_RULES = {
  accountsPerIp: 5,
  /**
   * The window those accounts are counted in, and the TTL of the counter's
   * rows in `indexes.ts`. Changing a live TTL is an `IndexOptionsConflict` at
   * boot, so a different window needs a new index name there too.
   */
  windowMs: 24 * 60 * 60 * 1000,
} as const

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
 * It also normalizes: the stored tier may still be the retired `pro_plus`, or
 * something this code has never heard of, and every caller wants a row that
 * exists in `PLAN_LIMITS`. See `normalizePlanTier`.
 */
export function effectivePlanTier(
  stored: string | null | undefined,
  expiresAt?: Date | string | null,
): PlanTier {
  const tier = normalizePlanTier(stored)
  if (tier === 'free' || !expiresAt) return tier
  const at = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt)
  // An unparseable date is not evidence of expiry — treat it as no expiry
  // rather than silently downgrading someone who is paying.
  if (Number.isNaN(at)) return tier
  return at <= Date.now() ? 'free' : tier
}
