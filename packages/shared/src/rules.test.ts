import { describe, expect, it } from 'vitest'
import { MINIMUM_AGE, birthDateSchema, meetsMinimumAge } from './age'
import { LANGUAGE_LEVELS, levelRank } from './level'
import { getLanguage, isLanguageCode, LANGUAGES, languageCodeSchema } from './languages'
import { PACKAGES, packageDefinition, tierFromEntitlementIds } from './billing'
import {
  PLAN_LIMITS,
  PLAN_TIERS,
  PRO_FEATURES,
  PRO_PLUS_FEATURES,
  effectivePlanTier,
  hasFeature,
  isPaidTier,
  quotaLimit,
} from './limits'
import {
  TOKEN_RULES,
  activityScore,
  convertLegacyTokens,
  earnedDayOf,
  newestPayableDay,
  poolShare,
  streakMilestoneBonus,
} from './token'

const NOW = new Date('2026-08-26T00:00:00Z')

describe('age gate', () => {
  it('is 18+', () => {
    expect(MINIMUM_AGE).toBe(18)
  })

  /**
   * Still counted by year, now that the whole date is known: somebody who
   * turns 18 in December is let in in January. Making that strict is a product
   * decision — the point of this test is that collecting the day did not
   * quietly change who gets in.
   */
  it('accepts someone turning 18 this year and rejects 17', () => {
    expect(meetsMinimumAge('2008-12-31', NOW)).toBe(true) // turns 18 in 2026
    expect(meetsMinimumAge('2009-01-01', NOW)).toBe(false)
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

  it('gates every Pro+ capability behind Pro+ — Pro does not get them', () => {
    expect(PRO_PLUS_FEATURES.length).toBeGreaterThan(0)
    for (const feature of PRO_PLUS_FEATURES) {
      expect(hasFeature('free', feature)).toBe(false)
      expect(hasFeature('pro', feature)).toBe(false)
      expect(hasFeature('pro_plus', feature)).toBe(true)
    }
  })

  /**
   * The packaging promise, asserted rather than trusted: Pro+ is Pro plus two
   * flags. Written as a comparison of the real rows so that giving Pro+ a
   * *worse* value than Pro anywhere — the easy mistake when hand-copying a
   * table — fails here instead of shipping.
   */
  it('makes Pro+ a strict superset of Pro', () => {
    for (const feature of PRO_FEATURES) {
      expect(hasFeature('pro_plus', feature)).toBe(true)
    }
    expect(PLAN_LIMITS.pro_plus.initiationsPer24h).toBe(PLAN_LIMITS.pro.initiationsPer24h)
    expect(PLAN_LIMITS.pro_plus.translationsPer24h).toBe(PLAN_LIMITS.pro.translationsPer24h)
    expect(PLAN_LIMITS.pro_plus.mediaPer24h).toBe(PLAN_LIMITS.pro.mediaPer24h)
  })

  /**
   * Two call sites read `PLAN_LIMITS.free.maxPhotos` regardless of the viewer's
   * tier. That is only correct while the allowance is uniform, so the
   * assumption is pinned here rather than left as a comment.
   */
  it('keeps the photo allowance identical on every tier', () => {
    for (const tier of PLAN_TIERS) {
      expect(PLAN_LIMITS[tier].maxPhotos).toBe(PLAN_LIMITS.free.maxPhotos)
    }
  })

  it('counts every tier but free as paid', () => {
    expect(isPaidTier('free')).toBe(false)
    expect(isPaidTier('pro')).toBe(true)
    expect(isPaidTier('pro_plus')).toBe(true)
  })
})

/**
 * Pro+ products deliberately grant `pro` as well as `pro_plus`, so almost
 * every real payload names both and something has to pick.
 */
describe('tierFromEntitlementIds', () => {
  it('prefers Pro+ when a subscriber holds both', () => {
    expect(tierFromEntitlementIds(['pro', 'pro_plus'])).toBe('pro_plus')
    expect(tierFromEntitlementIds(['pro_plus', 'pro'])).toBe('pro_plus')
  })

  it('reads a lone entitlement', () => {
    expect(tierFromEntitlementIds(['pro'])).toBe('pro')
    expect(tierFromEntitlementIds(['pro_plus'])).toBe('pro_plus')
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
    // The three reserved ids came with the project; Pro+ needed custom ones
    // because a reserved id can be used once per offering. Renaming a package
    // in the dashboard must come here too, or it stops rendering on the
    // paywall (deliberately — see getOffers).
    expect(Object.keys(PACKAGES).sort()).toEqual([
      '$rc_annual',
      '$rc_lifetime',
      '$rc_monthly',
      'pro_plus_monthly',
      'pro_plus_yearly',
    ])
  })

  it('resolves known ids and rejects unknown ones', () => {
    expect(packageDefinition('$rc_monthly')).toEqual({ tier: 'pro', period: 'monthly' })
    expect(packageDefinition('pro_plus_yearly')).toEqual({ tier: 'pro_plus', period: 'yearly' })
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

  /**
   * The regression this guard was rewritten for. The original read
   * `tier !== 'pro'` and returned early, which with a third tier meant an
   * expired Pro+ subscription **never dropped at all** — the one failure mode
   * the whole function exists to prevent, reappearing on the new tier.
   */
  it('drops an expired Pro+ to free, exactly like Pro', () => {
    expect(effectivePlanTier('pro_plus', new Date(Date.now() - hour))).toBe('free')
    expect(effectivePlanTier('pro_plus', new Date(Date.now() - hour).toISOString())).toBe('free')
  })

  it('keeps Pro+ while it still has time on it', () => {
    expect(effectivePlanTier('pro_plus')).toBe('pro_plus')
    expect(effectivePlanTier('pro_plus', null)).toBe('pro_plus')
    expect(effectivePlanTier('pro_plus', new Date(Date.now() + hour))).toBe('pro_plus')
  })

  /** Downgrade is to `free`, never to the tier below — an expired subscription
   *  is not a cheaper subscription. */
  it('drops an expired Pro+ all the way to free, not to Pro', () => {
    expect(effectivePlanTier('pro_plus', new Date(Date.now() - hour))).not.toBe('pro')
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
  it('exposes ISO 639-1 codes with unique entries', () => {
    const codes = LANGUAGES.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.length).toBeGreaterThan(150)
    expect(codes.every((c) => /^[a-z]{2}$/.test(c))).toBe(true)
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
    // A very active v2 day is ~700 tokens (500 pool ceiling + the 100-message cap).
    const veryActiveDay =
      TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool + 100 * TOKEN_RULES.award.message
    const daysToCatchTheTop = convertLegacyTokens(2_277_521) / veryActiveDay
    expect(daysToCatchTheTop).toBeLessThan(60)
  })

  it('returns nothing for a missing or nonsensical balance', () => {
    expect(convertLegacyTokens(0)).toBe(0)
    expect(convertLegacyTokens(-5)).toBe(0)
    expect(convertLegacyTokens(Number.NaN)).toBe(0)
  })
})
