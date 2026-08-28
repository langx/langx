import { describe, expect, it } from 'vitest'
import { formatAccountAge } from './accountAge'

const NOW = new Date('2026-08-28T12:00:00Z')

/** `days` before {@link NOW}, to the minute. */
function ago(days: number, hours = 0): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000)
}

describe('formatAccountAge', () => {
  it('calls anything under a day old "today"', () => {
    expect(formatAccountAge(NOW, NOW)).toBe('today')
    expect(formatAccountAge(ago(0, 23), NOW)).toBe('today')
  })

  it('says "today" for a future date rather than counting backwards', () => {
    // A device whose clock is ahead sends a createdAt in our future. The
    // label must degrade to the truthful end of the range, not to "-1 days".
    expect(formatAccountAge(new Date(NOW.getTime() + 60_000), NOW)).toBe('today')
  })

  it('counts days, singular at one', () => {
    expect(formatAccountAge(ago(1), NOW)).toBe('1 day ago')
    expect(formatAccountAge(ago(5), NOW)).toBe('5 days ago')
    expect(formatAccountAge(ago(29), NOW)).toBe('29 days ago')
  })

  it('widens to months at 30 days', () => {
    expect(formatAccountAge(ago(30), NOW)).toBe('1 month ago')
    expect(formatAccountAge(ago(95), NOW)).toBe('3 months ago')
  })

  it('never says "12 months" — the year step owns that boundary', () => {
    expect(formatAccountAge(ago(360), NOW)).toBe('11 months ago')
    expect(formatAccountAge(ago(364), NOW)).toBe('11 months ago')
    expect(formatAccountAge(ago(365), NOW)).toBe('1 year ago')
  })

  it('widens to years, singular at one', () => {
    expect(formatAccountAge(ago(365), NOW)).toBe('1 year ago')
    expect(formatAccountAge(ago(900), NOW)).toBe('2 years ago')
  })
})
