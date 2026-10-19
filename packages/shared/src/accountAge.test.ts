import { describe, expect, it } from 'vitest'
import { FIRST_WEEK_DAYS, accountAge, inFirstWeek } from './accountAge'

const NOW = new Date('2026-08-28T12:00:00Z')

/** `days` before {@link NOW}, to the minute. */
function ago(days: number, hours = 0): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000)
}

describe('accountAge', () => {
  it('calls anything under a day old "today"', () => {
    expect(accountAge(NOW, NOW)).toEqual({ unit: 'today', count: 0 })
    expect(accountAge(ago(0, 23), NOW)).toEqual({ unit: 'today', count: 0 })
  })

  it('says "today" for a future date rather than counting backwards', () => {
    // A device whose clock is ahead sends a createdAt in our future. The
    // label must degrade to the truthful end of the range, not to "-1 days".
    expect(accountAge(new Date(NOW.getTime() + 60_000), NOW)).toEqual({ unit: 'today', count: 0 })
  })

  it('counts days, singular at one', () => {
    expect(accountAge(ago(1), NOW)).toEqual({ unit: 'day', count: 1 })
    expect(accountAge(ago(5), NOW)).toEqual({ unit: 'day', count: 5 })
    expect(accountAge(ago(29), NOW)).toEqual({ unit: 'day', count: 29 })
  })

  it('widens to months at 30 days', () => {
    expect(accountAge(ago(30), NOW)).toEqual({ unit: 'month', count: 1 })
    expect(accountAge(ago(95), NOW)).toEqual({ unit: 'month', count: 3 })
  })

  it('never says "12 months" — the year step owns that boundary', () => {
    expect(accountAge(ago(360), NOW)).toEqual({ unit: 'month', count: 11 })
    expect(accountAge(ago(364), NOW)).toEqual({ unit: 'month', count: 11 })
    expect(accountAge(ago(365), NOW)).toEqual({ unit: 'year', count: 1 })
  })

  it('widens to years, singular at one', () => {
    expect(accountAge(ago(365), NOW)).toEqual({ unit: 'year', count: 1 })
    expect(accountAge(ago(900), NOW)).toEqual({ unit: 'year', count: 2 })
  })
})

describe('inFirstWeek', () => {
  it('holds for the whole first week and ends on its last minute', () => {
    expect(inFirstWeek(NOW, NOW)).toBe(true)
    expect(inFirstWeek(ago(FIRST_WEEK_DAYS - 1, 23), NOW)).toBe(true)
    expect(inFirstWeek(ago(FIRST_WEEK_DAYS), NOW)).toBe(false)
    expect(inFirstWeek(ago(400), NOW)).toBe(false)
  })

  it('reads a future date as new, as accountAge does', () => {
    expect(inFirstWeek(new Date(NOW.getTime() + 60_000), NOW)).toBe(true)
  })

  it('does not call an unparseable date new', () => {
    expect(inFirstWeek(new Date('not a date'), NOW)).toBe(false)
  })
})
