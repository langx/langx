import { describe, expect, it } from 'vitest'
import { historyMap } from './historyMap'

// Friday 16 October 2026, the board's own today.
const TODAY = '2026-10-16'

const map = (overrides: Partial<Parameters<typeof historyMap>[0]> = {}) =>
  historyMap({ today: TODAY, weeks: 9, days: [], ...overrides })

const stateOn = (result: ReturnType<typeof historyMap>, day: string) =>
  result.columns.flat().find((cell) => cell.day === day)?.state

describe('historyMap', () => {
  it('is nine Monday-first weeks ending on the week that holds today', () => {
    const result = map()
    expect(result.columns).toHaveLength(9)
    expect(result.columns[0]?.[0]?.day).toBe('2026-08-17')
    expect(result.columns[8]?.[6]?.day).toBe('2026-10-18')
    expect(result.columns.flat().find((cell) => cell.today)?.day).toBe(TODAY)
  })

  it('reads each square as the history list reads its row', () => {
    const result = map({
      days: [
        { day: '2026-10-16', actions: 3, source: 'activity' },
        { day: '2026-10-15', actions: 0, source: 'checkIn' },
        // Began as a check-in, then a message: a day of work, not an open.
        { day: '2026-10-14', actions: 4, source: 'checkIn' },
        { day: '2026-10-11', actions: 0, source: 'purchase' },
        { day: '2026-10-09', actions: 1, source: 'activity' },
      ],
    })
    expect(stateOn(result, '2026-10-16')).toBe('done')
    expect(stateOn(result, '2026-10-15')).toBe('opened')
    expect(stateOn(result, '2026-10-14')).toBe('done')
    expect(stateOn(result, '2026-10-11')).toBe('bought')
    expect(stateOn(result, '2026-10-12')).toBe('missed')
    expect(stateOn(result, '2026-10-17')).toBe('future')
    expect(result.counts).toEqual({ done: 3, opened: 1, bought: 1, missed: 3 })
  })

  /** An account made last week has not missed the two months before it. */
  it('calls nothing before the first day on record a miss', () => {
    const result = map({ days: [{ day: '2026-10-12', actions: 2, source: 'activity' }] })
    expect(stateOn(result, '2026-10-11')).toBe('none')
    expect(stateOn(result, '2026-08-17')).toBe('none')
    expect(stateOn(result, '2026-10-13')).toBe('missed')
    expect(result.counts.missed).toBe(3)
  })

  it('does not call an empty today a miss', () => {
    const result = map({ days: [{ day: '2026-10-15', actions: 2, source: 'activity' }] })
    expect(stateOn(result, TODAY)).toBe('none')
    expect(result.counts.missed).toBe(0)
  })

  /** Older accounts: a streak counter with no rows behind it still fills. */
  it('fills the current run the streak claims when it has no rows', () => {
    const result = map({ streak: { current: 3, lastQualifiedDay: '2026-10-15' } })
    expect(stateOn(result, '2026-10-15')).toBe('done')
    expect(stateOn(result, '2026-10-13')).toBe('done')
    expect(stateOn(result, '2026-10-12')).toBe('none')
  })

  it('counts every square up to today, and none after', () => {
    expect(map().elapsed).toBe(61)
  })

  it('names a month over the column it begins in, and the first column', () => {
    const { monthOf } = map()
    expect(monthOf[0]).toBe('2026-08-17')
    expect(monthOf[1]).toBeNull()
    expect(monthOf[2]).toBe('2026-09-01')
    expect(monthOf[6]).toBe('2026-10-01')
    expect(monthOf.filter(Boolean)).toHaveLength(3)
  })

  it('leaves the first column unnamed when a month begins right after it', () => {
    // First column 7–13 Sep: October begins three columns on, so both named.
    const later = historyMap({ today: '2026-11-05', weeks: 9, days: [] })
    expect(later.columns[0]?.[0]?.day).toBe('2026-09-07')
    expect(later.monthOf[0]).toBe('2026-09-07')
    // First column 24–30 Aug: September begins in the very next column.
    const tight = historyMap({ today: '2026-10-23', weeks: 9, days: [] })
    expect(tight.columns[0]?.[0]?.day).toBe('2026-08-24')
    expect(tight.monthOf[0]).toBeNull()
    expect(tight.monthOf[1]).toBe('2026-09-01')
  })
})
