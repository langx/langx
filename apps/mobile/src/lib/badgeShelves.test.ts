import { BADGES, type EarnedBadge } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { celebrated, unseenIds } from './badgeSeen'
import { badgeShelves, rungOf, rungProgress } from './badgeShelves'

function catalogue(earned: readonly string[]): EarnedBadge[] {
  return BADGES.filter((b) => b.kind !== 'origin').map((b) => ({
    id: b.id,
    kind: b.kind,
    threshold: b.threshold,
    label: b.label,
    icon: b.icon,
    earned: earned.includes(b.id),
    earnedAt: null,
  }))
}

describe('badge shelves', () => {
  const badges = catalogue(['streak.7', 'streak.30', 'correction.1', 'messages.100'])
  const progress = { streak: 40, correction: 4, messages: 150, tokens: 0, veteran: 20 }

  it('puts every rung of a family on one shelf, earned, then one next, then locked', () => {
    const streak = badgeShelves(badges, progress, new Set()).find((s) => s.kind === 'streak')!
    expect(streak.rungs.map((r) => r.state)).toEqual([
      'earned',
      'earned',
      'next',
      'locked',
      'locked',
      'locked',
      'locked',
    ])
    expect(streak.earned).toBe(2)
    expect(rungProgress(streak.rungs[2]!)).toBeCloseTo(0.4)
  })

  it('leads with a shelf holding a new badge, then the ones furthest up', () => {
    const plain = badgeShelves(badges, progress, new Set()).map((s) => s.kind)
    expect(plain[0]).toBe('streak')
    const withNew = badgeShelves(badges, progress, new Set(['messages.100'])).map((s) => s.kind)
    expect(withNew[0]).toBe('messages')
  })

  it('draws no next rung where the server sent no progress', () => {
    const theirs = badgeShelves(badges, undefined, new Set())
    expect(theirs.flatMap((s) => s.rungs).some((r) => r.state === 'next')).toBe(false)
  })

  it('finds a rung and its place on the ladder', () => {
    const shelves = badgeShelves(badges, progress, new Set())
    expect(rungOf(shelves, 'streak.30')?.position).toBe(2)
    expect(rungOf(shelves, 'nobody.1')).toBeNull()
  })
})

describe('badges seen on this device', () => {
  const earned = catalogue(['streak.7', 'correction.1']).filter((b) => b.earned)

  it('seeds the first reading instead of calling everything new', () => {
    const { fresh, seed } = unseenIds(null, 'u1', earned)
    expect(fresh).toEqual([])
    expect(seed).toEqual(['streak.7', 'correction.1'])
  })

  it('reseeds for somebody else on the same phone', () => {
    expect(unseenIds({ userId: 'u2', ids: [] }, 'u1', earned).seed).not.toBeNull()
  })

  it('calls new what was earned since', () => {
    expect(unseenIds({ userId: 'u1', ids: ['streak.7'] }, 'u1', earned).fresh).toEqual([
      'correction.1',
    ])
  })

  it('celebrates the last of several in catalogue order', () => {
    const more = catalogue(['streak.7', 'streak.30']).filter((b) => b.earned)
    expect(celebrated(more, ['streak.7', 'streak.30'])?.id).toBe('streak.30')
    expect(celebrated(more, [])).toBeNull()
  })
})
