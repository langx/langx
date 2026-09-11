/*
 * Tokyo, because the whole point of this helper is the hours where the local
 * day and the UTC day disagree — nine of them every morning there. A test run
 * in UTC, which is what CI is, cannot tell the two spellings apart at all.
 */
process.env.TZ = 'Asia/Tokyo'

import { describe, expect, it } from 'vitest'
import { deviceDayKey } from './deviceDay'

describe('deviceDayKey', () => {
  it('reads the local calendar, not the UTC one', () => {
    // 07:00 on the 12th in Tokyo, and still the 11th in UTC.
    const morning = new Date('2026-09-11T22:00:00Z')

    expect(deviceDayKey(morning)).toBe('2026-09-12')
    expect(morning.toISOString().slice(0, 10)).toBe('2026-09-11')
  })

  it('pads a single-digit month and day', () => {
    expect(deviceDayKey(new Date('2026-01-05T03:00:00Z'))).toBe('2026-01-05')
  })

  it('rolls over at local midnight', () => {
    // 23:59 and 00:00 on either side of the same local midnight.
    expect(deviceDayKey(new Date('2026-09-11T14:59:00Z'))).toBe('2026-09-11')
    expect(deviceDayKey(new Date('2026-09-11T15:00:00Z'))).toBe('2026-09-12')
  })
})
