import { describe, expect, it } from 'vitest'
import {
  BADGES,
  BADGE_KINDS,
  BADGE_SHAPES,
  badgesMostRecentFirst,
  badgeStripMarks,
  findBadge,
  isCohortBadge,
  type EarnedBadge,
} from './badges'
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

describe('badgesMostRecentFirst', () => {
  function earned(id: string, earnedAt: string | null): EarnedBadge {
    const definition = findBadge(id)
    if (!definition) throw new Error(`no such badge: ${id}`)
    return {
      id: definition.id,
      kind: definition.kind,
      threshold: definition.threshold,
      label: definition.label,
      icon: definition.icon,
      earned: true,
      earnedAt,
    }
  }

  it('puts the latest dated badge first', () => {
    const order = badgesMostRecentFirst([
      earned('streak.7', '2026-01-10T00:00:00.000Z'),
      earned('streak.30', '2026-04-02T00:00:00.000Z'),
      earned('veteran.365', '2026-02-20T00:00:00.000Z'),
    ]).map((badge) => badge.id)

    expect(order).toEqual(['streak.30', 'veteran.365', 'streak.7'])
  })

  it('puts every dated badge ahead of every undated one', () => {
    const order = badgesMostRecentFirst([
      earned('correction.1', null),
      earned('streak.7', '2020-01-01T00:00:00.000Z'),
      earned('messages.100', null),
    ]).map((badge) => badge.id)

    expect(order[0]).toBe('streak.7')
  })

  /**
   * The load-bearing half of the fallback: a ladder climbs in the catalogue,
   * so its top rung is the one earned last even though nothing wrote a date.
   */
  it('leads an undated ladder with its top rung', () => {
    const order = badgesMostRecentFirst([
      earned('correction.1', null),
      earned('correction.10', null),
      earned('correction.100', null),
    ]).map((badge) => badge.id)

    expect(order).toEqual(['correction.100', 'correction.10', 'correction.1'])
  })

  it('treats an unparseable date as no date rather than as the epoch', () => {
    const order = badgesMostRecentFirst([
      earned('correction.10', null),
      earned('streak.7', 'not a date'),
    ]).map((badge) => badge.id)

    // Sorted as undated, so reverse catalogue order decides: the correction
    // rung is later in `BADGES` than the streak rung.
    expect(order).toEqual(['correction.10', 'streak.7'])
  })

  it('leaves the input alone', () => {
    const input = [earned('streak.7', null), earned('streak.30', null)]
    const before = input.map((badge) => badge.id)
    badgesMostRecentFirst(input)

    expect(input.map((badge) => badge.id)).toEqual(before)
  })
})

describe('badgeStripMarks', () => {
  function earned(id: string, earnedAt: string | null): EarnedBadge {
    const definition = findBadge(id)
    if (!definition) throw new Error(`no such badge: ${id}`)
    return {
      id: definition.id,
      kind: definition.kind,
      threshold: definition.threshold,
      label: definition.label,
      icon: definition.icon,
      earned: true,
      earnedAt,
    }
  }

  it('keeps one mark per kind', () => {
    const marks = badgeStripMarks([
      earned('correction.1', null),
      earned('correction.10', null),
      earned('correction.100', null),
      earned('messages.100', null),
    ]).map((badge) => badge.id)

    expect(marks).toEqual(['messages.100', 'correction.100'])
  })

  /** The half the sort is here for: catalogue order in, top rung out. */
  it('keeps the top rung of an undated ladder, not the first', () => {
    const marks = badgeStripMarks([
      earned('streak.7', null),
      earned('streak.30', null),
      earned('streak.365', null),
    ]).map((badge) => badge.id)

    expect(marks).toEqual(['streak.365'])
  })

  it('keeps the latest of a dated kind', () => {
    const marks = badgeStripMarks([
      earned('veteran.730', '2026-04-02T00:00:00.000Z'),
      earned('veteran.365', '2025-04-02T00:00:00.000Z'),
    ]).map((badge) => badge.id)

    expect(marks).toEqual(['veteran.730'])
  })

  /**
   * Six kinds, so the strip is bounded by the catalogue rather than by a
   * count — this is what replaced the cap the payload used to carry.
   */
  it('sends no more marks than there are kinds', () => {
    const everything = BADGES.map((badge) => earned(badge.id, null))

    expect(badgeStripMarks(everything).length).toBeLessThanOrEqual(BADGE_KINDS.length)
  })

  it('leaves the input alone', () => {
    const input = [earned('streak.7', null), earned('streak.30', null)]
    const before = input.map((badge) => badge.id)
    badgeStripMarks(input)

    expect(input.map((badge) => badge.id)).toEqual(before)
  })
})
