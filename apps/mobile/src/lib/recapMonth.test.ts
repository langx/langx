import { describe, expect, it } from 'vitest'
import { monthName, recapMonthFor, recapMonthParam } from './recapMonth'

describe('recapMonthFor', () => {
  it('offers last month during the first seven days only', () => {
    expect(recapMonthFor(new Date(2026, 9, 1, 9))).toBe('2026-09')
    expect(recapMonthFor(new Date(2026, 9, 7, 23))).toBe('2026-09')
    expect(recapMonthFor(new Date(2026, 9, 8, 0))).toBeNull()
  })

  it('crosses the year boundary in January', () => {
    expect(recapMonthFor(new Date(2027, 0, 3))).toBe('2026-12')
  })
})

describe('recapMonthParam', () => {
  it('keeps a month the link names', () => {
    expect(recapMonthParam('2026-08', new Date(2026, 8, 30))).toBe('2026-08')
  })

  it('falls back to last month when the link names none, any day of the month', () => {
    // `/recap` typed or reloaded on the web: the screen used to wait forever.
    expect(recapMonthParam(undefined, new Date(2026, 8, 30))).toBe('2026-08')
    expect(recapMonthParam('', new Date(2027, 0, 20))).toBe('2026-12')
    expect(recapMonthParam('2026-13', new Date(2026, 9, 2))).toBe('2026-09')
    expect(recapMonthParam(['2026-08'], new Date(2026, 9, 2))).toBe('2026-09')
  })
})

describe('monthName', () => {
  it('names the month in the given language', () => {
    expect(monthName('2026-09', 'en')).toBe('September')
  })
})
