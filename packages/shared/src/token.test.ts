import { describe, expect, it } from 'vitest'
import { isRepairable, streakFromDays, streakHeadDay } from './token'

const days = (...list: string[]) => new Set(list)

describe('streakHeadDay', () => {
  it('is today when today has already qualified', () => {
    expect(streakHeadDay(days('2026-08-30', '2026-08-31'), '2026-08-31')).toBe('2026-08-31')
  })

  /** An unfinished today still has the run that ended yesterday. */
  it('falls back to yesterday when today has not qualified yet', () => {
    expect(streakHeadDay(days('2026-08-29', '2026-08-30'), '2026-08-31')).toBe('2026-08-30')
  })

  it('is null when neither today nor yesterday is filled', () => {
    expect(streakHeadDay(days('2026-08-20'), '2026-08-31')).toBeNull()
    expect(streakHeadDay(days(), '2026-08-31')).toBeNull()
  })

  /**
   * The two have to agree, because `repairDay` writes the streak length from
   * one and `streak.lastQualifiedDay` from the other. A head with no length, or
   * a length with no head, is the shape of the bug that let a bought day reset
   * the streak on the very next message.
   */
  it('is non-null exactly when the walk finds a run', () => {
    const cases: [string[], string][] = [
      [['2026-08-31'], '2026-08-31'],
      [['2026-08-30'], '2026-08-31'],
      [['2026-08-29'], '2026-08-31'],
      [[], '2026-08-31'],
      [['2026-08-29', '2026-08-30', '2026-08-31'], '2026-08-31'],
    ]
    for (const [list, today] of cases) {
      const set = days(...list)
      expect(streakHeadDay(set, today) === null).toBe(streakFromDays(set, today) === 0)
    }
  })

  /**
   * The head is what the next qualifying action reads to decide whether today
   * continues the run, so it must be the *newest* filled day, never the oldest.
   */
  it('names the newest day of the run, not the start of it', () => {
    const set = days('2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30')
    expect(streakHeadDay(set, '2026-08-31')).toBe('2026-08-30')
    expect(streakFromDays(set, '2026-08-31')).toBe(4)
  })
})

describe('isRepairable', () => {
  const today = '2026-08-29'

  it('refuses today, which is earned rather than bought', () => {
    expect(isRepairable(today, today)).toBe(false)
  })

  it('refuses a day that has not happened', () => {
    expect(isRepairable('2026-08-30', today)).toBe(false)
  })

  it('allows yesterday and the edge of the window', () => {
    expect(isRepairable('2026-08-28', today)).toBe(true)
    expect(isRepairable('2026-08-15', today)).toBe(true)
  })

  it('refuses one day past the window', () => {
    expect(isRepairable('2026-08-14', today)).toBe(false)
  })
})
