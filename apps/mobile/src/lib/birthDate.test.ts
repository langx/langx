import { describe, expect, it } from 'vitest'
import { formatDayKey, parseDayKey } from './birthDate'

describe('birth date keys', () => {
  it('round-trips a day without moving it', () => {
    for (const day of ['1995-06-15', '2000-02-29', '1900-01-01', '2008-12-31']) {
      expect(formatDayKey(parseDayKey(day) as Date)).toBe(day)
    }
  })

  /**
   * The reason both directions go through noon: at midnight, formatting in any
   * zone west of UTC lands on the day before.
   */
  it('sits far enough from midnight that no zone can shift it', () => {
    const parsed = parseDayKey('1995-06-15') as Date
    expect(parsed.getHours()).toBe(12)
  })

  it('refuses what is not a calendar day', () => {
    expect(parseDayKey('2001-02-30')).toBeNull()
    expect(parseDayKey('15/06/1995')).toBeNull()
    expect(parseDayKey('')).toBeNull()
  })
})
