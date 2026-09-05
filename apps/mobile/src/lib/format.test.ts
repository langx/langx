import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { compactCount, relativeTime, relativeTimeCompact } from './format'

describe('relativeTime', () => {
  const now = new Date('2026-08-29T12:00:00Z')
  const en = { t: createTranslate('en'), locale: 'en', now } as const

  it('collapses anything under a minute to "now"', () => {
    expect(relativeTime('2026-08-29T11:59:31Z', en)).toBe('now')
  })

  it('steps through minutes, hours and days', () => {
    expect(relativeTime('2026-08-29T11:48:00Z', en)).toBe('12 min')
    expect(relativeTime('2026-08-29T09:00:00Z', en)).toBe('3 h')
    expect(relativeTime('2026-08-27T12:00:00Z', en)).toBe('2 d')
  })

  it('falls back to a date past a week, where the age matters less than the day', () => {
    expect(relativeTime('2026-08-01T12:00:00Z', en)).toMatch(/Aug/)
  })

  it('never reports a negative age for a clock that is slightly ahead', () => {
    expect(relativeTime('2026-08-29T12:00:30Z', en)).toBe('now')
  })

  it('returns an empty string for an unparseable date rather than "NaN min"', () => {
    expect(relativeTime('not a date', en)).toBe('')
  })

  it("formats the fallback date in the reader's locale", () => {
    const tr = { t: createTranslate('tr'), locale: 'tr', now } as const
    expect(relativeTime('2026-08-01T12:00:00Z', tr)).toMatch(/Ağu/)
  })
})

describe('relativeTimeCompact', () => {
  const now = new Date('2026-08-29T12:00:00Z')
  const en = { t: createTranslate('en'), locale: 'en', now } as const

  it('drops the space the roomier variant keeps', () => {
    expect(relativeTimeCompact('2026-08-29T11:48:00Z', en)).toBe('12m')
    expect(relativeTimeCompact('2026-08-29T09:00:00Z', en)).toBe('3h')
    expect(relativeTimeCompact('2026-08-27T12:00:00Z', en)).toBe('2d')
  })
})

describe('compactCount', () => {
  it('leaves anything under a thousand alone', () => {
    expect(compactCount(0, 'en')).toBe('0')
    expect(compactCount(845, 'en')).toBe('845')
    expect(compactCount(999, 'en')).toBe('999')
  })

  it('shortens from a thousand, with one decimal while it fits in one digit', () => {
    expect(compactCount(1000, 'en')).toBe('1k')
    expect(compactCount(1150, 'en')).toBe('1.1k')
    expect(compactCount(9999, 'en')).toBe('9.9k')
    expect(compactCount(19_400, 'en')).toBe('19k')
    expect(compactCount(250_000, 'en')).toBe('250k')
    expect(compactCount(2_340_000, 'en')).toBe('2.3M')
  })

  /** A balance that reads 2k when it is 1,950 is a promise the wallet cannot keep. */
  it('rounds down, never up', () => {
    expect(compactCount(1950, 'en')).toBe('1.9k')
    expect(compactCount(19_999, 'en')).toBe('19k')
  })

  it('uses the locale decimal separator', () => {
    expect(compactCount(1150, 'tr')).toBe('1,1k')
    expect(compactCount(1150, 'de')).toBe('1,1k')
  })
})
