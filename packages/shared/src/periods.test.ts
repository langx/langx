import { describe, expect, it } from 'vitest'
import {
  aggregateId,
  isConsecutiveDay,
  localDayKey,
  localDayStart,
  monthKey,
  nextStreak,
  periodKeys,
  shiftDayKey,
  streakLapsed,
  streakSavable,
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

  it('finds the instant a local day begins, on either side of UTC', () => {
    expect(localDayStart('2026-09-05', 'America/Vancouver').toISOString()).toBe(
      '2026-09-05T07:00:00.000Z',
    )
    // Same zone in winter: the offset is a property of the instant, not the zone.
    expect(localDayStart('2026-01-15', 'America/Vancouver').toISOString()).toBe(
      '2026-01-15T08:00:00.000Z',
    )
    // East of UTC the day starts before UTC midnight of its own key, and a
    // half-hour zone lands on the half hour.
    expect(localDayStart('2026-09-05', 'Asia/Kolkata').toISOString()).toBe(
      '2026-09-04T18:30:00.000Z',
    )
  })

  it('reads the offset in force at the day’s start, not at UTC midnight', () => {
    // Auckland's clocks go back at 03:00 on 5 April 2026, so UTC midnight of
    // that key is already NZST (+12) while the day began in NZDT (+13). This
    // is the case a single pass gets an hour wrong.
    expect(localDayStart('2026-04-05', 'Pacific/Auckland').toISOString()).toBe(
      '2026-04-04T11:00:00.000Z',
    )
  })

  it('returns the transition itself where local midnight never happens', () => {
    // These zones spring forward *at* midnight, so the day's first clock
    // reading is 01:00 and no instant reads 00:00. The case a bare correction
    // pass gets wrong in one direction and a third pass gets wrong in the other.
    expect(localDayStart('2026-03-08', 'America/Havana').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    )
    expect(localDayStart('2026-09-06', 'America/Santiago').toISOString()).toBe(
      '2026-09-06T04:00:00.000Z',
    )
    expect(localDayStart('2026-03-29', 'Atlantic/Azores').toISOString()).toBe(
      '2026-03-29T01:00:00.000Z',
    )
  })

  it('lands inside the day, and one millisecond earlier does not', () => {
    for (const zone of ['Europe/Istanbul', 'America/Vancouver', 'Asia/Kathmandu', 'UTC']) {
      for (const day of ['2026-01-01', '2026-03-08', '2026-09-05', '2026-11-01']) {
        const start = localDayStart(day, zone)
        expect(localDayKey(start, zone)).toBe(day)
        expect(localDayKey(new Date(start.getTime() - 1), zone)).not.toBe(day)
      }
    }
  })

  it('falls back to UTC midnight for an unusable timezone, and rejects a bad key', () => {
    expect(localDayStart('2026-09-05', 'Not/AZone').toISOString()).toBe('2026-09-05T00:00:00.000Z')
    expect(() => localDayStart('the fifth', 'Europe/Istanbul')).toThrow(TypeError)
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

  it('is savable only while yesterday counted, or a freeze covers the gap', () => {
    const today = '2026-09-13'
    expect(streakSavable({ current: 3, lastQualifiedDay: '2026-09-12' }, 0, today)).toBe(true)
    expect(streakSavable({ current: 3, lastQualifiedDay: '2026-09-11' }, 0, today)).toBe(false)
    expect(streakSavable({ current: 3, lastQualifiedDay: '2026-09-11' }, 1, today)).toBe(true)
    expect(streakSavable({ current: 3, lastQualifiedDay: '2026-09-10' }, 2, today)).toBe(false)
    // Already counted today: nothing left to save.
    expect(streakSavable({ current: 3, lastQualifiedDay: today }, 0, today)).toBe(false)
    expect(streakSavable({ current: 0, lastQualifiedDay: '2026-09-12' }, 0, today)).toBe(false)
    expect(streakSavable({ current: 0, lastQualifiedDay: null }, 0, today)).toBe(false)
  })

  it('lapses one day after the last day a freeze could have bridged', () => {
    const today = '2026-09-13'
    expect(streakLapsed('2026-09-12', today)).toBe(false)
    expect(streakLapsed('2026-09-11', today)).toBe(false)
    expect(streakLapsed('2026-09-10', today)).toBe(true)
    expect(streakLapsed('2026-03-01', today)).toBe(true)
    expect(streakLapsed(null, today)).toBe(false)
  })
})
