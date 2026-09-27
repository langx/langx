import { describe, expect, it } from 'vitest'
import { localTimeOn } from './periods'
import { nextMorningIn, scheduleMessageSchema } from './scheduledMessages'

describe('nextMorningIn', () => {
  it("is today's nine o'clock when it has not come yet", () => {
    // 05:00 in Istanbul (UTC+3, no DST).
    const now = new Date('2026-09-27T02:00:00Z')
    expect(nextMorningIn('Europe/Istanbul', now)?.toISOString()).toBe('2026-09-27T06:00:00.000Z')
  })

  it("is tomorrow's once today's has passed, and at exactly nine", () => {
    const nine = new Date('2026-09-27T06:00:00Z')
    expect(nextMorningIn('Europe/Istanbul', nine)?.toISOString()).toBe('2026-09-28T06:00:00.000Z')
  })

  it("uses the partner's calendar day, not UTC's", () => {
    // 23:30 UTC on the 27th is already 08:30 on the 28th in Tokyo.
    const now = new Date('2026-09-27T23:30:00Z')
    expect(nextMorningIn('Asia/Tokyo', now)?.toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })

  it('lands on nine on the day the clocks spring forward', () => {
    // New York moves to EDT at 02:00 on 8 March 2026: 09:00 is 13:00 UTC,
    // while the day began at 05:00 UTC — so "day start plus nine hours" is an
    // hour late.
    const now = new Date('2026-03-08T03:00:00Z')
    expect(nextMorningIn('America/New_York', now)?.toISOString()).toBe('2026-03-08T13:00:00.000Z')
  })

  it('lands on nine on the day the clocks fall back', () => {
    // New York returns to EST at 02:00 on 1 November 2026.
    const now = new Date('2026-11-01T04:00:00Z')
    expect(nextMorningIn('America/New_York', now)?.toISOString()).toBe('2026-11-01T14:00:00.000Z')
  })

  it('crosses a southern-hemisphere change the night before', () => {
    // Auckland goes from NZDT (+13) to NZST (+12) at 03:00 on 5 April 2026.
    const now = new Date('2026-04-04T12:00:00Z') // 01:00 NZDT on the 5th
    expect(nextMorningIn('Pacific/Auckland', now)?.toISOString()).toBe('2026-04-04T21:00:00.000Z')
  })

  it('handles a half-hour zone', () => {
    const now = new Date('2026-09-27T12:00:00Z') // 17:30 in Kolkata
    expect(nextMorningIn('Asia/Kolkata', now)?.toISOString()).toBe('2026-09-28T03:30:00.000Z')
  })

  it('refuses a zone it cannot read rather than guessing UTC', () => {
    expect(nextMorningIn('Mars/Olympus_Mons', new Date())).toBeNull()
  })
})

describe('localTimeOn', () => {
  it('reads the offset in force at that hour', () => {
    expect(localTimeOn('2026-07-01', 9, 'Europe/London').toISOString()).toBe(
      '2026-07-01T08:00:00.000Z',
    )
    expect(localTimeOn('2026-01-01', 9, 'Europe/London').toISOString()).toBe(
      '2026-01-01T09:00:00.000Z',
    )
  })
})

describe('scheduleMessageSchema', () => {
  const base = { body: 'Good morning!', clientId: 'c1' }

  it('takes a time or a mode', () => {
    expect(
      scheduleMessageSchema.safeParse({ ...base, sendAt: '2026-09-28T06:00:00Z' }).success,
    ).toBe(true)
    expect(scheduleMessageSchema.safeParse({ ...base, mode: 'theirMorning' }).success).toBe(true)
  })

  it('refuses both, and neither', () => {
    expect(
      scheduleMessageSchema.safeParse({
        ...base,
        sendAt: '2026-09-28T06:00:00Z',
        mode: 'theirMorning',
      }).success,
    ).toBe(false)
    expect(scheduleMessageSchema.safeParse(base).success).toBe(false)
  })
})
