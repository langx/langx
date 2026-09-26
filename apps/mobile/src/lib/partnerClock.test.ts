import { afterEach, describe, expect, it, vi } from 'vitest'
import { msUntilNextMinute, subscribeToMinute, theirLocalTime } from './partnerClock'

/** 21:30 UTC: 17:30 in Toronto, 00:30 the next day in Istanbul. */
const at = new Date('2026-09-09T21:30:00.000Z')

describe('theirLocalTime', () => {
  it('writes their time when their clock differs from mine', () => {
    // `\s`: newer ICU puts a narrow no-break space before the AM.
    expect(theirLocalTime(at, 'Europe/Istanbul', 'America/Toronto', 'en')).toMatch(/^12:30\sAM$/)
    // In the reader's own convention, which for Turkish is a 24-hour clock.
    expect(theirLocalTime(at, 'Europe/Istanbul', 'America/Toronto', 'tr')).toMatch(/^0?0:30$/)
  })

  it('says nothing when their zone is withheld', () => {
    expect(theirLocalTime(at, undefined, 'America/Toronto', 'en')).toBeNull()
  })

  it('says nothing when both of us are in the same zone', () => {
    expect(theirLocalTime(at, 'Europe/Istanbul', 'Europe/Istanbul', 'en')).toBeNull()
  })

  /** Different names, same clock right now — the comparison is of what is drawn. */
  it('says nothing when two zones agree at this moment', () => {
    const winter = new Date('2026-01-15T12:00:00.000Z')
    expect(theirLocalTime(winter, 'Europe/London', 'Africa/Abidjan', 'en')).toBeNull()
  })

  /** A reader with no zone on file is compared against the device, not against nothing. */
  it('falls back to the device zone for the reader', () => {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(theirLocalTime(at, device, undefined, 'en')).toBeNull()
  })

  it('says nothing, rather than throwing, for a zone the runtime does not know', () => {
    expect(theirLocalTime(at, 'Mars/Olympus_Mons', 'Europe/Istanbul', 'en')).toBeNull()
    expect(theirLocalTime(at, 'Europe/Istanbul', 'Mars/Olympus_Mons', 'en')).toBeNull()
  })
})

describe('msUntilNextMinute', () => {
  it('waits until the next whole minute', () => {
    expect(msUntilNextMinute(Date.parse('2026-09-09T21:30:40.000Z'))).toBe(20_000)
    expect(msUntilNextMinute(Date.parse('2026-09-09T21:30:59.999Z'))).toBe(1)
  })

  it('waits a full minute when already on one', () => {
    expect(msUntilNextMinute(Date.parse('2026-09-09T21:30:00.000Z'))).toBe(60_000)
  })
})

describe('subscribeToMinute', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks on each minute boundary and stops once unsubscribed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T21:30:40.000Z'))
    const onTick = vi.fn()
    const unsubscribe = subscribeToMinute(onTick)

    vi.advanceTimersByTime(19_999)
    expect(onTick).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onTick).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(onTick).toHaveBeenCalledTimes(2)

    unsubscribe()
    vi.advanceTimersByTime(5 * 60_000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })
})
