import { describe, expect, it } from 'vitest'
import { monthName, recapMonthFor } from './recapMonth'

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

describe('monthName', () => {
  it('names the month in the given language', () => {
    expect(monthName('2026-09', 'en')).toBe('September')
  })
})
