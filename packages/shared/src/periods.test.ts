import { describe, expect, it } from 'vitest'
import {
  aggregateId,
  isConsecutiveDay,
  localDayKey,
  monthKey,
  nextStreak,
  periodKeys,
  shiftDayKey,
  utcDayKey,
  weekKey,
  yearKey,
} from './periods'

describe('leaderboard period keys (UTC)', () => {
  it('formats week, month and year', () => {
    const d = new Date('2026-08-26T12:00:00Z') // a Wednesday
    expect(weekKey(d)).toBe('2026-W35')
    expect(monthKey(d)).toBe('2026-08')
    expect(yearKey(d)).toBe('2026')
    expect(utcDayKey(d)).toBe('2026-08-26')
  })

  it('pads single-digit weeks so keys sort lexicographically', () => {
    expect(weekKey(new Date('2026-01-08T00:00:00Z'))).toBe('2026-W02')
  })

  it('handles ISO week-year boundaries', () => {
    // 2027-01-01 is a Friday, so it belongs to ISO week 53 of 2026.
    expect(weekKey(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53')
    // 2026-01-01 is a Thursday — week 1 of 2026.
    expect(weekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01')
  })

  it('returns every bucket an award contributes to', () => {
    expect(periodKeys(new Date('2026-08-26T12:00:00Z'))).toEqual({
      all: 'all',
      year: '2026',
      month: '2026-08',
      week: '2026-W35',
    })
  })

  it('builds the aggregate _id', () => {
    expect(aggregateId('u1', 'week', '2026-W35')).toBe('u1:week:2026-W35')
  })
})

describe('streak days (user-local)', () => {
  it('uses the local calendar day, not UTC', () => {
    // 23:30 UTC is already the next day in Istanbul (+03).
    const instant = new Date('2026-08-26T23:30:00Z')
    expect(utcDayKey(instant)).toBe('2026-08-26')
    expect(localDayKey(instant, 'Europe/Istanbul')).toBe('2026-08-27')
    expect(localDayKey(instant, 'America/Los_Angeles')).toBe('2026-08-26')
  })

  it('falls back to UTC for an unusable timezone rather than throwing', () => {
    expect(localDayKey(new Date('2026-08-26T12:00:00Z'), 'Not/AZone')).toBe('2026-08-26')
  })

  it('shifts and compares day keys across month boundaries', () => {
    expect(shiftDayKey('2026-08-31', 1)).toBe('2026-09-01')
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(isConsecutiveDay('2026-12-31', '2027-01-01')).toBe(true)
    expect(isConsecutiveDay('2026-08-26', '2026-08-28')).toBe(false)
  })

  it('advances, holds and resets the streak', () => {
    expect(nextStreak(4, '2026-08-25', '2026-08-26')).toBe(5) // consecutive
    expect(nextStreak(4, '2026-08-26', '2026-08-26')).toBe(4) // same day, no-op
    expect(nextStreak(4, '2026-08-24', '2026-08-26')).toBe(1) // missed a day
    expect(nextStreak(0, null, '2026-08-26')).toBe(1) // first ever action
  })
})
