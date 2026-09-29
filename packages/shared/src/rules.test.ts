import { describe, expect, it } from 'vitest'
import { MINIMUM_AGE, birthDateSchema, meetsMinimumAge } from './age'
import { LANGUAGE_LEVELS, levelRank } from './level'
import {
  getLanguage,
  isLanguageCode,
  isTranslatableLanguage,
  LANGUAGES,
  languageCodeSchema,
} from './languages'
import { translateRequestSchema } from './translation'
import { DISCOVERY_BOOSTED_TIERS } from './discovery'
import { PACKAGES, packageDefinition, tierFromEntitlementIds } from './billing'
import {
  PLAN_LIMITS,
  PLAN_TIERS,
  PRO_FEATURES,
  effectivePlanTier,
  normalizePlanTier,
  hasFeature,
  isPaidTier,
  languageCapAllows,
  quotaLimit,
} from './limits'
import {
  TOKEN_RULES,
  activityScore,
  convertLegacyTokens,
  earnedDayOf,
  firstPayoutAt,
  newestPayableDay,
  poolShare,
  streakMilestoneBonus,
} from './token'

const NOW = new Date('2026-08-26T00:00:00Z')

describe('age gate', () => {
  it('is 16+', () => {
    expect(MINIMUM_AGE).toBe(16)
  })

  /**
   * Still counted by year, now that the whole date is known: somebody who
   * turns 16 in December is let in in January. Making that strict is a product
   * decision — the point of this test is that collecting the day did not
   * quietly change who gets in.
   */
  it('accepts someone turning 16 this year and rejects 15', () => {
    expect(meetsMinimumAge('2010-12-31', NOW)).toBe(true) // turns 16 in 2026
    expect(meetsMinimumAge('2011-01-01', NOW)).toBe(false)
  })

  it('rejects an underage birth date through the schema', () => {
    const schema = birthDateSchema(NOW)
    expect(schema.safeParse('1995-06-15').success).toBe(true)
    expect(schema.safeParse('2015-06-15').success).toBe(false)
    expect(schema.safeParse('2030-06-15').success).toBe(false) // future
    expect(schema.safeParse('1850-06-15').success).toBe(false)
  })

  it('rejects a date that never happened', () => {
    const schema = birthDateSchema(NOW)
    expect(schema.safeParse('2001-02-30').success).toBe(false)
    expect(schema.safeParse('1999-02-29').success).toBe(false) // not a leap year
    expect(schema.safeParse('2000-02-29').success).toBe(true) // this one is
    expect(schema.safeParse('15/06/1995').success).toBe(false)
    expect(schema.safeParse('1995-6-15').success).toBe(false)
  })
})

describe('plan limits', () => {
  it('gives free users 5 initiations per rolling 24h and pro unlimited', () => {
    expect(quotaLimit('free', 'initiations')).toBe(5)
    expect(quotaLimit('pro', 'initiations')).toBeNull()
  })

  it('leaves corrections unlimited on every tier', () => {
    // Rate-limiting corrections would shrink the value free users create for
    // Pro users. If this ever changes it is a product decision, not a tweak.
    for (const tier of PLAN_TIERS) {
      expect(PLAN_LIMITS[tier].correctionsPer24h).toBeNull()
    }
  })

  it('never caps Echo reviews, on any tier', () => {
    // The design document says "ever". A number here would mean a person who
    // wants to sit with their cards for an hour is told to stop, which is the
    // opposite of what the module is for.
    for (const tier of PLAN_TIERS) {
      expect(PLAN_LIMITS[tier].echoReviewsPerDay).toBeNull()
    }
  })

  it('charges every tier the same Echo capture ceiling', () => {
    // An abuse ceiling, not a paywall. The moment the paid tiers get a bigger
    // number it becomes something to sell, and the refusal in the app is a
    // plain alert that offers nothing to buy.
    for (const tier of PLAN_TIERS) {
      expect(PLAN_LIMITS[tier].echoCapturesPerDay, tier).toBe(PLAN_LIMITS.free.echoCapturesPerDay)
    }
    expect(PLAN_LIMITS.free.echoCapturesPerDay).toBeGreaterThan(0)
  })

  /** Iterates the real list rather than retyping it — a fourth feature added to
   *  `PRO_FEATURES` is then covered by this test automatically instead of
   *  silently escaping it. */
  it('gates every Pro capability behind Pro', () => {
    expect(PRO_FEATURES.length).toBeGreaterThan(0)
    for (const feature of PRO_FEATURES) {
      expect(hasFeature('free', feature)).toBe(false)
      expect(hasFeature('pro', feature)).toBe(true)
    }
  })

  /**
   * Media and photos are a fair-use ceiling, not something a plan sells: the
   * refusal is a plain alert. The same number on every row is what keeps it so.
   */
  it('gives every tier the same media and photo ceilings', () => {
    for (const tier of PLAN_TIERS) {
      expect(PLAN_LIMITS[tier].mediaPer24h, tier).toBe(500)
      expect(PLAN_LIMITS[tier].maxPhotos, tier).toBe(10)
    }
  })

  it('counts every tier but free as paid', () => {
    expect(isPaidTier('free')).toBe(false)
    expect(isPaidTier('pro')).toBe(true)
  })
})

/**
 * `pro_plus` is Polyglot's entitlement id; it cannot be renamed, so it keeps
 * arriving after the merge, and it means Pro.
 */
describe('tierFromEntitlementIds', () => {
  it('reads either entitlement as Pro', () => {
    expect(tierFromEntitlementIds(['pro'])).toBe('pro')
    expect(tierFromEntitlementIds(['pro_plus'])).toBe('pro')
    expect(tierFromEntitlementIds(['pro_plus', 'pro'])).toBe('pro')
  })

  /** Absent, empty and null all mean "this event tells us nothing". */
  it('returns null when there is nothing to read', () => {
    expect(tierFromEntitlementIds(undefined)).toBeNull()
    expect(tierFromEntitlementIds(null)).toBeNull()
    expect(tierFromEntitlementIds([])).toBeNull()
  })

  /** An entitlement configured in the dashboard before the code knows it must
   *  leave the user where they are, not throw the webhook into a retry loop. */
  it('ignores entitlements it does not sell', () => {
    expect(tierFromEntitlementIds(['something_new'])).toBeNull()
    expect(tierFromEntitlementIds(['toString'])).toBeNull()
    expect(tierFromEntitlementIds(['something_new', 'pro'])).toBe('pro')
  })
})

/**
 * `PACKAGES` mirrors identifiers typed into the RevenueCat dashboard, which no
 * compiler can see — so the mirror's own invariants are pinned here instead.
 */
describe('PACKAGES', () => {
  it('sells only paid tiers — a free package is a configuration mistake', () => {
    for (const definition of Object.values(PACKAGES)) {
      expect(isPaidTier(definition.tier)).toBe(true)
    }
  })

  it('matches the dashboard identifiers this project configured', () => {
    // The offering still holds `pro_plus_*` for apps released before the
    // single plan; leaving them out of this map is how current code ignores
    // them (see getOffers).
    expect(Object.keys(PACKAGES).sort()).toEqual(['$rc_annual', '$rc_lifetime', '$rc_monthly'])
  })

  it('resolves known ids and rejects unknown ones', () => {
    expect(packageDefinition('$rc_monthly')).toEqual({ tier: 'pro', period: 'monthly' })
    expect(packageDefinition('pro_plus_yearly')).toBeNull()
    expect(packageDefinition('$rc_six_month')).toBeNull()
  })
})

/**
 * The rule that used to exist twice — enforced on the server, ignored on the
 * client — so a late webhook showed a Pro interface the server would refuse.
 */
describe('effectivePlanTier', () => {
  const hour = 3_600_000

  it('leaves a free account alone whatever the date says', () => {
    expect(effectivePlanTier('free')).toBe('free')
    expect(effectivePlanTier('free', new Date(Date.now() - hour))).toBe('free')
  })

  it('keeps Pro with no expiry at all', () => {
    expect(effectivePlanTier('pro')).toBe('pro')
    expect(effectivePlanTier('pro', null)).toBe('pro')
  })

  it('keeps Pro while the subscription still has time on it', () => {
    expect(effectivePlanTier('pro', new Date(Date.now() + hour))).toBe('pro')
  })

  it('drops an expired Pro to free', () => {
    expect(effectivePlanTier('pro', new Date(Date.now() - hour))).toBe('free')
  })

  it('reads an ISO string as well as a Date — the client only ever has the string', () => {
    expect(effectivePlanTier('pro', new Date(Date.now() - hour).toISOString())).toBe('free')
    expect(effectivePlanTier('pro', new Date(Date.now() + hour).toISOString())).toBe('pro')
  })

  /** An unreadable date is not evidence of expiry — never downgrade a payer. */
  it('keeps Pro when the expiry cannot be parsed', () => {
    expect(effectivePlanTier('pro', 'not-a-date')).toBe('pro')
  })

  /** Stored rows may still say Polyglot until the merge script has run. */
  it('reads the retired pro_plus as Pro, and drops it on expiry like Pro', () => {
    expect(effectivePlanTier('pro_plus')).toBe('pro')
    expect(effectivePlanTier('pro_plus', new Date(Date.now() + hour))).toBe('pro')
    expect(effectivePlanTier('pro_plus', new Date(Date.now() - hour))).toBe('free')
  })

  /** `PLAN_LIMITS[unknown]` is `undefined` and every guard after it a 500. */
  it('reads a tier it does not know as free, never as undefined', () => {
    expect(effectivePlanTier('platinum')).toBe('free')
    expect(effectivePlanTier(undefined)).toBe('free')
    expect(effectivePlanTier(null)).toBe('free')
  })
})

describe('normalizePlanTier', () => {
  it('maps every stored spelling onto a row that exists', () => {
    expect(normalizePlanTier('free')).toBe('free')
    expect(normalizePlanTier('pro')).toBe('pro')
    expect(normalizePlanTier('pro_plus')).toBe('pro')
    expect(normalizePlanTier('PRO')).toBe('free')
    for (const stored of ['free', 'pro', 'pro_plus', 'x', undefined, null]) {
      expect(PLAN_LIMITS[normalizePlanTier(stored)]).toBeDefined()
    }
  })
})

describe('xp rules', () => {
  it('weights corrections above messages', () => {
    expect(TOKEN_RULES.award.correction).toBeGreaterThan(TOKEN_RULES.award.message)
  })

  it('scores activity with the message term capped', () => {
    const counters = { mutualConversations: 2, corrections: 3, messages: 500, distinctPartners: 4 }
    const { weights, messageCountCap } = TOKEN_RULES.pool
    expect(activityScore(counters)).toBe(
      weights.mutualConversations * 2 +
        weights.corrections * 3 +
        weights.messages * messageCountCap +
        weights.distinctPartners * 4,
    )
  })

  it('caps one user at maxShareOfPool no matter how dominant', () => {
    const { total, maxShareOfPool } = TOKEN_RULES.pool
    expect(poolShare(1_000_000, 1_000_001)).toBe(Math.floor(total * maxShareOfPool))
  })

  it('distributes nothing on a day with no activity', () => {
    expect(poolShare(0, 0)).toBe(0)
    expect(poolShare(10, 0)).toBe(0)
  })

  it('never distributes more than the pool across all users', () => {
    const scores = [50, 30, 20, 10, 5]
    const totalScore = scores.reduce((a, b) => a + b, 0)
    const paid = scores.reduce((sum, s) => sum + poolShare(s, totalScore), 0)
    expect(paid).toBeLessThanOrEqual(TOKEN_RULES.pool.total)
  })

  it('holds a closed day back until its payout hour', () => {
    // The day closes at 00:00 UTC but is not paid until 04:00, so for those
    // four hours the newest payable day is the one before yesterday.
    expect(newestPayableDay(new Date('2026-05-10T00:05:00.000Z'))).toBe('2026-05-08')
    expect(newestPayableDay(new Date('2026-05-10T03:59:59.000Z'))).toBe('2026-05-08')
    expect(newestPayableDay(new Date('2026-05-10T04:00:00.000Z'))).toBe('2026-05-09')
    expect(newestPayableDay(new Date('2026-05-10T23:59:00.000Z'))).toBe('2026-05-09')
  })

  it('tells a new account when its first share can actually land', () => {
    // Signed up mid-morning on the 10th. Today closes at 00:00 on the 11th,
    // which is under the 24-hour ramp-up, so today earns nothing however busy
    // it is. The 11th closes on the 12th, comfortably past it, and is settled
    // at 04:00 that morning.
    expect(
      firstPayoutAt(new Date('2026-05-10T09:30:00.000Z'), new Date('2026-05-10T10:00:00.000Z')),
    ).toEqual(new Date('2026-05-12T04:00:00.000Z'))

    // Signed up a week ago, so today is payable: settled tomorrow at 04:00.
    expect(
      firstPayoutAt(new Date('2026-05-03T09:30:00.000Z'), new Date('2026-05-10T10:00:00.000Z')),
    ).toEqual(new Date('2026-05-11T04:00:00.000Z'))

    // Between midnight and the payout hour, yesterday is still ahead of them.
    expect(
      firstPayoutAt(new Date('2026-05-03T09:30:00.000Z'), new Date('2026-05-10T02:00:00.000Z')),
    ).toEqual(new Date('2026-05-11T04:00:00.000Z'))

    // Created exactly at a UTC midnight: that day closes exactly 24 hours
    // later, and the ramp-up check is `<`, so it qualifies rather than slipping
    // a day. The boundary is worth pinning — it is the one an off-by-one here
    // would move without any test noticing.
    expect(
      firstPayoutAt(new Date('2026-05-10T00:00:00.000Z'), new Date('2026-05-10T10:00:00.000Z')),
    ).toEqual(new Date('2026-05-11T04:00:00.000Z'))
  })

  it('files a pool share under the day it rewards, not the day it was written', () => {
    // `awardTokens` stamps a pool row at `dayCloseAt(D)`, which is D+1.
    expect(earnedDayOf({ kind: 'dailyPool', day: '2026-05-10', refId: '2026-05-09' })).toBe(
      '2026-05-09',
    )
    expect(earnedDayOf({ kind: 'message', day: '2026-05-10', refId: 'abc' })).toBe('2026-05-10')
    // A pool row without a refId cannot be re-dated, so it keeps its own day.
    expect(earnedDayOf({ kind: 'dailyPool', day: '2026-05-10' })).toBe('2026-05-10')
  })

  it('pays streak milestones only on exact days', () => {
    expect(streakMilestoneBonus(7)).toBe(50)
    expect(streakMilestoneBonus(8)).toBe(0)
  })
})

describe('language + level tables', () => {
  it('exposes ISO 639-1 and 639-3 codes with unique entries', () => {
    const codes = LANGUAGES.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.length).toBeGreaterThan(150)
    expect(codes.every((c) => /^[a-z]{2,3}$/.test(c))).toBe(true)
  })

  /** The first code in the table that ISO 639-1 does not have. */
  it('lists American Sign Language, which has no written form to translate to', () => {
    expect(isLanguageCode('ase')).toBe(true)
    expect(getLanguage('ase')?.name).toBe('American Sign Language')
    expect(isTranslatableLanguage('ase')).toBe(false)
    expect(isTranslatableLanguage('en')).toBe(true)
    expect(isTranslatableLanguage('zz')).toBe(false)
    expect(translateRequestSchema.safeParse({ text: 'hi', targetLang: 'ase' }).success).toBe(false)
    expect(translateRequestSchema.safeParse({ text: 'hi', targetLang: 'en' }).success).toBe(true)
  })

  it('looks codes up and rejects unknown ones', () => {
    expect(getLanguage('tr')?.nativeName).toBe('Türkçe')
    expect(isLanguageCode('en')).toBe(true)
    expect(isLanguageCode('zz')).toBe(false)
    expect(languageCodeSchema.safeParse('zz').success).toBe(false)
  })

  it('ranks levels in order', () => {
    expect(LANGUAGE_LEVELS.map(levelRank)).toEqual([1, 2, 3, 4])
  })
})

describe('legacy token conversion', () => {
  it('divides the v1 balance and floors it', () => {
    // The measured distribution: median 20, p90 9136, p99 37821, max 2277521.
    expect(convertLegacyTokens(20)).toBe(0)
    expect(convertLegacyTokens(9136)).toBe(91)
    expect(convertLegacyTokens(37_821)).toBe(378)
    expect(convertLegacyTokens(2_277_521)).toBe(22_775)
  })

  it('keeps the top v1 account within reach of a new user', () => {
    // A very active v2 day is ~350 tokens (250 pool ceiling + the 100-message cap).
    const veryActiveDay =
      TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool + 100 * TOKEN_RULES.award.message
    const daysToCatchTheTop = convertLegacyTokens(2_277_521) / veryActiveDay
    // Roughly 65 days against the halved pool, up from 46 at the old one.
    expect(daysToCatchTheTop).toBeLessThan(90)
  })

  it('returns nothing for a missing or nonsensical balance', () => {
    expect(convertLegacyTokens(0)).toBe(0)
    expect(convertLegacyTokens(-5)).toBe(0)
    expect(convertLegacyTokens(Number.NaN)).toBe(0)
  })
})

describe('language allowances', () => {
  const KEYS = ['maxLearningLanguages', 'maxNativeLanguages'] as const

  /**
   * Asserted over a list rather than named one by one, so a third tiered array
   * cannot be added later without a row here.
   */
  it('rises with the tier and never starts below one', () => {
    for (const key of KEYS) {
      expect(PLAN_LIMITS.free[key]).toBeGreaterThanOrEqual(1)
      expect(PLAN_LIMITS.pro[key]).toBeGreaterThan(PLAN_LIMITS.free[key])
    }
  })

  /** Nothing may read one tier's language allowance off another's row. */
  it('is not uniform across tiers', () => {
    for (const key of KEYS) {
      expect(PLAN_LIMITS.free[key]).not.toBe(PLAN_LIMITS.pro[key])
    }
  })

  it('allows a list that fits the plan', () => {
    expect(languageCapAllows(1, 1, 1)).toBe(true)
    expect(languageCapAllows(2, 1, 1)).toBe(false)
  })

  /**
   * The grandfathering, which is the half everybody forgets. Somebody carrying
   * five from v1 on a plan allowing one must still be able to change a level
   * (same size), drop one (smaller), and be refused a sixth (larger) — in that
   * order, because "over the limit" must mean "cannot grow", never "frozen".
   */
  it('lets an over-limit list be edited and shrunk, but never grown', () => {
    expect(languageCapAllows(5, 5, 1)).toBe(true)
    expect(languageCapAllows(4, 5, 1)).toBe(true)
    expect(languageCapAllows(0, 5, 1)).toBe(true)
    expect(languageCapAllows(6, 5, 1)).toBe(false)
  })
})

describe('translation is never sold as unlimited', () => {
  /**
   * The one quota with a real per-request cost — Google bills per character —
   * so `null` here would be a promise made against somebody else's meter. This
   * pins the *shape*, not the numbers, so nobody can quietly put the word back.
   */
  it('is a finite number on every tier', () => {
    for (const tier of PLAN_TIERS) {
      expect(typeof PLAN_LIMITS[tier].translationsPer24h, tier).toBe('number')
    }
  })

  it('rises with the tier', () => {
    expect(PLAN_LIMITS.pro.translationsPer24h).toBeGreaterThan(PLAN_LIMITS.free.translationsPer24h)
  })
})

describe('the boosted strip', () => {
  /**
   * The strip's order is presentation and its membership is entitlement, and
   * they live in two files. This is what stops them disagreeing: move
   * `boostedProfile` between tiers and the list has to move with it, so a
   * plan that no longer buys the strip cannot keep a place in it.
   */
  it('lists exactly the tiers whose plan includes it', () => {
    const entitled = PLAN_TIERS.filter((tier) => PLAN_LIMITS[tier].boostedProfile)
    expect([...DISCOVERY_BOOSTED_TIERS].sort()).toEqual([...entitled].sort())
  })
})
