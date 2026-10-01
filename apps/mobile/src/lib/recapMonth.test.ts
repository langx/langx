import { describe, expect, it } from 'vitest'
import {
  monthName,
  recapMonthFor,
  recapMonthParam,
  recapYearFor,
  recapYearParam,
} from './recapMonth'

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

describe('recapYearFor', () => {
  it('offers the year so far from the 20th of December', () => {
    expect(recapYearFor(new Date(2026, 11, 19, 23))).toBeNull()
    expect(recapYearFor(new Date(2026, 11, 20, 0))).toBe('2026')
    expect(recapYearFor(new Date(2026, 11, 31, 23))).toBe('2026')
  })

  it('offers the year just ended in the first week of January, then nothing', () => {
    expect(recapYearFor(new Date(2027, 0, 1))).toBe('2026')
    expect(recapYearFor(new Date(2027, 0, 7, 23))).toBe('2026')
    expect(recapYearFor(new Date(2027, 0, 8))).toBeNull()
    expect(recapYearFor(new Date(2026, 8, 30))).toBeNull()
  })
})

describe('recapYearParam', () => {
  it('is a year only when the link names four digits', () => {
    expect(recapYearParam('2026')).toBe('2026')
    expect(recapYearParam('26')).toBeNull()
    expect(recapYearParam(undefined)).toBeNull()
    expect(recapYearParam(['2026'])).toBeNull()
  })
})

describe('monthName', () => {
  it('names the month in the given language', () => {
    expect(monthName('2026-09', 'en')).toBe('September')
  })
})
