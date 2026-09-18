import { describe, expect, it } from 'vitest'
import { BADGES, BADGE_KINDS, BADGE_SHAPES, findBadge, isCohortBadge } from './badges'
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
   * The grid draws `icon` directly, so it has to be a real glyph name — an
   * empty string would render nothing at all in a slot sized for one.
   */
  it('gives every badge an icon', () => {
    for (const badge of BADGES) {
      expect(badge.icon.length, badge.id).toBeGreaterThan(0)
    }
  })

  it('says which shape every kind is', () => {
    expect(isCohortBadge('origin')).toBe(true)
    for (const kind of BADGE_KINDS) {
      if (kind === 'origin') continue
      expect(isCohortBadge(kind), kind).toBe(false)
    }
  })

  /**
   * A cohort badge is a fact, not a rung: a second one of the same kind would
   * mean a scale, and a scale is what `counter` is for. The threshold is the
   * boolean's `1`, and `getBadgeSummary` compares against it like any other.
   */
  it('gives every cohort kind exactly one badge, at a threshold of one', () => {
    for (const kind of BADGE_KINDS) {
      if (BADGE_SHAPES[kind] !== 'cohort') continue
      const badges = BADGES.filter((badge) => badge.kind === kind)
      expect(badges.length, kind).toBe(1)
      expect(badges[0]?.threshold, kind).toBe(1)
    }
  })

  /**
   * The screen draws this array in order, and a cohort badge is the one row on
   * it a reader cannot work towards — so it leads, rather than sitting between
   * the eighth streak and the third token total.
   *
   * Asserted rather than left to whoever edits the array next: the natural
   * thing to do with a new entry is append it, and appending a cohort badge
   * would sink it to the bottom with nothing failing.
   */
  it('puts every cohort badge above every ladder', () => {
    const lastCohort = BADGES.map((badge) => isCohortBadge(badge.kind)).lastIndexOf(true)
    const firstCounter = BADGES.map((badge) => isCohortBadge(badge.kind)).indexOf(false)
    expect(lastCohort).toBeLessThan(firstCounter)
  })

  /**
   * `app/(app)/badges.tsx` passes a badge's label straight into
   * `createShareCardSchema.headline`, which is `.max(40)`. A longer label does
   * not fail here — it 400s when somebody tries to share that badge, which is
   * a worse place to find out.
   */
  it('keeps every label inside the share card headline', () => {
    for (const badge of BADGES) {
      expect(badge.label.length, badge.id).toBeLessThanOrEqual(40)
    }
  })
})
