import { describe, expect, it } from 'vitest'
import { meetingClock } from './meetingClock'

/** A Wednesday, 21:30 UTC, so the zone shifts are visible in the output. */
const at = new Date('2026-09-09T21:30:00.000Z')

describe('meetingClock', () => {
  it('writes the same instant differently in two zones', () => {
    const toronto = meetingClock(at, 'America/Toronto', 'en')
    const istanbul = meetingClock(at, 'Europe/Istanbul', 'en')
    expect(toronto).toContain('5:30')
    expect(istanbul).toContain('12:30')
    expect(toronto).not.toBe(istanbul)
  })

  /**
   * The zone is what the two readers disagree about, so a card with no zone
   * has to still say something — the device's guess, not an empty string.
   */
  it('falls back to the device zone when the profile has none', () => {
    expect(meetingClock(at, undefined, 'en')).not.toBe('')
  })

  it('writes the weekday and month in the reader’s language', () => {
    expect(meetingClock(at, 'UTC', 'tr')).not.toBe(meetingClock(at, 'UTC', 'en'))
  })
})
