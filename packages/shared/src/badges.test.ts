import { describe, expect, it } from 'vitest'
import { BADGES, BADGE_KINDS, findBadge } from './badges'
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

  it('orders each kind by ascending threshold', () => {
    // Over `BADGE_KINDS`, not a literal pair: the list this used to hardcode
    // left every kind added after it untested.
    for (const kind of BADGE_KINDS) {
      const thresholds = BADGES.filter((b) => b.kind === kind).map((b) => b.threshold)
      expect(thresholds, kind).toEqual([...thresholds].sort((a, b) => a - b))
    }
  })

  it('has at least one badge for every kind', () => {
    for (const kind of BADGE_KINDS) {
      expect(
        BADGES.some((badge) => badge.kind === kind),
        kind,
      ).toBe(true)
    }
  })

  /**
   * `streakMilestoneDates` dates a streak badge by mapping a ledger row's
   * amount back to the milestone that paid it — the row records the day and
   * the amount, never which milestone it was for. Two milestones sharing an
   * amount would silently attribute both to the earlier row, and a user would
   * see the wrong date on a badge with nothing failing anywhere.
   */
  it('pays a distinct amount at every streak milestone', () => {
    const payouts = Object.values(TOKEN_RULES.streakMilestones)
    expect(new Set(payouts).size).toBe(payouts.length)
  })

  it('pays more for a longer streak', () => {
    const byDays = Object.entries(TOKEN_RULES.streakMilestones)
      .map(([days, payout]) => ({ days: Number(days), payout }))
      .sort((a, b) => a.days - b.days)
    const payouts = byDays.map((entry) => entry.payout)
    expect(payouts).toEqual([...payouts].sort((a, b) => a - b))
  })

  it('finds by id and returns undefined for anything else', () => {
    expect(findBadge('streak.7')?.threshold).toBe(7)
    expect(findBadge('streak.8')).toBeUndefined()
  })

  /**
   * The grid draws `icon` directly, so it has to be a Feather name — an empty
   * string would render nothing at all in a slot sized for a glyph.
   */
  it('gives every badge an icon', () => {
    for (const badge of BADGES) {
      expect(badge.icon.length, badge.id).toBeGreaterThan(0)
    }
  })
})
