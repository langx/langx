import { describe, expect, it } from 'vitest'
import { BADGES, type EarnedBadge } from '@langx/shared'
import { badgesEarnedFirst } from './badgeOrder'

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
