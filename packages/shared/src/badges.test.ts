import { describe, expect, it } from 'vitest'
import { BADGES, findBadge } from './badges'
import { TOKEN_RULES } from './token'

describe('badge catalogue', () => {
  it('derives its streak badges from the milestones that pay out', () => {
    const streakBadges = BADGES.filter((badge) => badge.kind === 'streak').map((b) => b.threshold)
    const milestones = Object.keys(TOKEN_RULES.streakMilestones)
      .map(Number)
      .sort((a, b) => a - b)
    // Not a fixed list: a badge for a streak length the economy does not pay
    // would promise a reward nobody receives.
    expect(streakBadges).toEqual(milestones)
  })

  it('has no duplicate ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
  })

  it('orders each kind by ascending threshold, so "next" is the first unearned', () => {
    for (const kind of ['streak', 'correction'] as const) {
      const thresholds = BADGES.filter((b) => b.kind === kind).map((b) => b.threshold)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
    }
  })

  it('finds by id and returns undefined for anything else', () => {
    expect(findBadge('streak.7')?.threshold).toBe(7)
    expect(findBadge('streak.8')).toBeUndefined()
  })
})
