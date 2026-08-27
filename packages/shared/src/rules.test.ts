import { describe, expect, it } from 'vitest'
import { MINIMUM_AGE, birthYearSchema, meetsMinimumAge } from './age'
import { CEFR_LEVELS, cefrRank } from './cefr'
import { getLanguage, isLanguageCode, LANGUAGES, languageCodeSchema } from './languages'
import { PLAN_LIMITS, PRO_FEATURES, effectivePlanTier, hasFeature, quotaLimit } from './limits'
import {
  TOKEN_RULES,
  activityScore,
  convertLegacyTokens,
  poolShare,
  streakMilestoneBonus,
} from './token'

const NOW = new Date('2026-08-26T00:00:00Z')

describe('age gate', () => {
  it('is 18+', () => {
    expect(MINIMUM_AGE).toBe(18)
  })

  it('accepts someone turning 18 this year and rejects 17', () => {
    expect(meetsMinimumAge(2008, NOW)).toBe(true) // turns 18 in 2026
    expect(meetsMinimumAge(2009, NOW)).toBe(false)
  })

  it('rejects an underage birth year through the schema', () => {
    const schema = birthYearSchema(NOW)
    expect(schema.safeParse(1995).success).toBe(true)
    expect(schema.safeParse(2015).success).toBe(false)
    expect(schema.safeParse(2030).success).toBe(false) // future
    expect(schema.safeParse(1850).success).toBe(false)
  })
})

describe('plan limits', () => {
  it('gives free users 5 initiations per rolling 24h and pro unlimited', () => {
    expect(quotaLimit('free', 'initiations')).toBe(5)
    expect(quotaLimit('pro', 'initiations')).toBeNull()
  })

  it('leaves corrections unlimited on both tiers', () => {
    // Rate-limiting corrections would shrink the value free users create for
    // Pro users. If this ever changes it is a product decision, not a tweak.
    expect(PLAN_LIMITS.free.correctionsPer24h).toBeNull()
    expect(PLAN_LIMITS.pro.correctionsPer24h).toBeNull()
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

  it('pays streak milestones only on exact days', () => {
    expect(streakMilestoneBonus(7)).toBe(50)
    expect(streakMilestoneBonus(8)).toBe(0)
  })
})

describe('language + cefr tables', () => {
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

  it('ranks CEFR levels in order', () => {
    expect(CEFR_LEVELS.map(cefrRank)).toEqual([1, 2, 3, 4, 5, 6])
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
