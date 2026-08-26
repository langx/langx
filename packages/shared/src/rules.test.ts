import { describe, expect, it } from 'vitest'
import { MINIMUM_AGE, birthYearSchema, meetsMinimumAge } from './age'
import { CEFR_LEVELS, cefrRank } from './cefr'
import { getLanguage, isLanguageCode, LANGUAGES, languageCodeSchema } from './languages'
import { PLAN_LIMITS, hasFeature, quotaLimit } from './limits'
import { XP_RULES, activityScore, poolShare, streakMilestoneBonus } from './xp'

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

  it('keeps advanced filters, viewer identities and incognito Pro-only', () => {
    for (const feature of ['advancedFilters', 'profileViewerIdentities', 'incognito'] as const) {
      expect(hasFeature('free', feature)).toBe(false)
      expect(hasFeature('pro', feature)).toBe(true)
    }
  })
})

describe('xp rules', () => {
  it('weights corrections above messages', () => {
    expect(XP_RULES.award.correction).toBeGreaterThan(XP_RULES.award.message)
  })

  it('scores activity with the message term capped', () => {
    const counters = { mutualConversations: 2, corrections: 3, messages: 500, distinctPartners: 4 }
    const { weights, messageCountCap } = XP_RULES.pool
    expect(activityScore(counters)).toBe(
      weights.mutualConversations * 2 +
        weights.corrections * 3 +
        weights.messages * messageCountCap +
        weights.distinctPartners * 4,
    )
  })

  it('caps one user at maxShareOfPool no matter how dominant', () => {
    const { total, maxShareOfPool } = XP_RULES.pool
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
    expect(paid).toBeLessThanOrEqual(XP_RULES.pool.total)
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
