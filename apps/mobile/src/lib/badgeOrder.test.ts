import { describe, expect, it } from 'vitest'
import { BADGES, type EarnedBadge } from '@langx/shared'
import { badgeLadderTips, badgesEarnedFirst } from './badgeOrder'

/** The catalogue, with the named ids marked earned. */
function shelf(earned: string[]): EarnedBadge[] {
  return BADGES.map((badge) => ({
    id: badge.id,
    kind: badge.kind,
    threshold: badge.threshold,
    label: badge.label,
    icon: badge.icon,
    earned: earned.includes(badge.id),
    earnedAt: null,
  }))
}

describe('badgesEarnedFirst', () => {
  it('lifts every earned badge above every locked one', () => {
    const ordered = badgesEarnedFirst(shelf(['streak.7', 'correction.1', 'tokens.10000']))
    const firstLocked = ordered.findIndex((badge) => !badge.earned)

    expect(ordered.slice(0, firstLocked).every((badge) => badge.earned)).toBe(true)
    expect(ordered.slice(firstLocked).some((badge) => badge.earned)).toBe(false)
    expect(firstLocked).toBe(3)
  })

  it('keeps catalogue order inside each half', () => {
    const catalogue = BADGES.map((badge) => badge.id)
    const ordered = badgesEarnedFirst(shelf(['tokens.10000', 'origin.v1', 'streak.30']))

    const rank = (id: string) => catalogue.indexOf(id)
    const earned = ordered.filter((badge) => badge.earned).map((badge) => badge.id)
    const locked = ordered.filter((badge) => !badge.earned).map((badge) => badge.id)

    expect(earned).toEqual([...earned].sort((a, b) => rank(a) - rank(b)))
    expect(locked).toEqual([...locked].sort((a, b) => rank(a) - rank(b)))
  })

  it('leaves the input alone', () => {
    const input = shelf(['veteran.365'])
    const before = input.map((badge) => badge.id)
    badgesEarnedFirst(input)

    expect(input.map((badge) => badge.id)).toEqual(before)
  })
})

describe('badgeLadderTips', () => {
  it('keeps the highest earned rung of a kind and the one above it', () => {
    const rows = badgeLadderTips(shelf(['correction.1', 'correction.10', 'correction.100']))
      .filter((badge) => badge.kind === 'correction')
      .map((badge) => badge.id)

    expect(rows).toEqual(['correction.100', 'correction.1000'])
  })

  it('offers the first rung of a kind nothing has been earned in', () => {
    const rows = badgeLadderTips(shelf([]))
      .filter((badge) => badge.kind === 'messages')
      .map((badge) => badge.id)

    expect(rows).toEqual(['messages.100'])
  })

  it('keeps a finished ladder without offering a rung that does not exist', () => {
    const every = BADGES.filter((badge) => badge.kind === 'veteran').map((badge) => badge.id)
    const rows = badgeLadderTips(shelf(every))
      .filter((badge) => badge.kind === 'veteran')
      .map((badge) => badge.id)

    expect(rows).toEqual(['veteran.1095'])
  })

  /**
   * The row `next` names is the lowest unearned rung of its kind, so the one
   * row that draws a fraction is never the one this drops.
   */
  it('never drops the rung the progress fraction lands on', () => {
    const rows = badgeLadderTips(shelf(['streak.7', 'streak.30'])).map((badge) => badge.id)

    expect(rows).toContain('streak.100')
  })

  /** Their shelf carries no locked rows, so this is the strip's rule again. */
  it('leaves one row per kind when nothing is locked', () => {
    const earnedOnly = shelf(['streak.7', 'streak.30', 'correction.1']).filter(
      (badge) => badge.earned,
    )

    expect(badgeLadderTips(earnedOnly).map((badge) => badge.id)).toEqual([
      'streak.30',
      'correction.1',
    ])
  })

  it('reads the tips off the thresholds, not off the order it was given', () => {
    const reversed = [...shelf(['correction.1', 'correction.10'])].reverse()
    const rows = badgeLadderTips(reversed)
      .filter((badge) => badge.kind === 'correction')
      .map((badge) => badge.id)

    expect(rows).toEqual(['correction.100', 'correction.10'])
  })

  it('leaves the input alone', () => {
    const input = shelf(['veteran.365'])
    const before = input.map((badge) => badge.id)
    badgeLadderTips(input)

    expect(input.map((badge) => badge.id)).toEqual(before)
  })
})
