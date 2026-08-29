import { describe, expect, it } from 'vitest'
import { isRepairable, streakDayId, streakFromDays } from './streakDays'

describe('streakFromDays', () => {
  const today = '2026-08-29'

  it('counts back from today while the days are unbroken', () => {
    const days = new Set(['2026-08-29', '2026-08-28', '2026-08-27'])
    expect(streakFromDays(days, today)).toBe(3)
  })

  /**
   * A user who has not sent anything yet today still has the run that ended
   * yesterday — the streak is not lost until a day passes without one.
   */
  it('starts from yesterday when today is not filled yet', () => {
    const days = new Set(['2026-08-28', '2026-08-27'])
    expect(streakFromDays(days, today)).toBe(2)
  })

  it('is zero once yesterday is missing too', () => {
    expect(streakFromDays(new Set(['2026-08-27']), today)).toBe(0)
    expect(streakFromDays(new Set(), today)).toBe(0)
  })

  /**
   * The reason a repair recomputes rather than increments: filling one square
   * can join two runs that were never adjacent while they were being lived.
   */
  it('joins two runs when the day between them is filled', () => {
    const broken = new Set(['2026-08-29', '2026-08-28', '2026-08-26', '2026-08-25'])
    expect(streakFromDays(broken, today)).toBe(2)

    const repaired = new Set([...broken, '2026-08-27'])
    expect(streakFromDays(repaired, today)).toBe(5)
  })

  it('ignores days after today', () => {
    const days = new Set(['2026-08-30', '2026-08-29'])
    expect(streakFromDays(days, today)).toBe(1)
  })
})

describe('isRepairable', () => {
  const now = new Date('2026-08-29T12:00:00.000Z')
  const today = '2026-08-29'

  it('refuses today, which is earned rather than bought', () => {
    expect(isRepairable(today, today, 'UTC', now)).toBe(false)
  })

  it('refuses a day that has not happened', () => {
    expect(isRepairable('2026-08-30', today, 'UTC', now)).toBe(false)
  })

  it('allows yesterday and the edge of the window', () => {
    expect(isRepairable('2026-08-28', today, 'UTC', now)).toBe(true)
    expect(isRepairable('2026-08-15', today, 'UTC', now)).toBe(true)
  })

  it('refuses one day past the window', () => {
    expect(isRepairable('2026-08-14', today, 'UTC', now)).toBe(false)
  })
})

describe('streakDayId', () => {
  /** The prefix range that reads a calendar off the primary index depends on it. */
  it('is the user and the day, in that order', () => {
    expect(streakDayId('u1', '2026-08-29')).toBe('u1:2026-08-29')
  })
})
