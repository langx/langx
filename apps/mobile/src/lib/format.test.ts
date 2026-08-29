import { describe, expect, it } from 'vitest'
import { relativeTime } from './format'

describe('relativeTime', () => {
  const now = new Date('2026-08-29T12:00:00Z')

  it('collapses anything under a minute to "now"', () => {
    expect(relativeTime('2026-08-29T11:59:31Z', now)).toBe('now')
  })

  it('steps through minutes, hours and days', () => {
    expect(relativeTime('2026-08-29T11:48:00Z', now)).toBe('12 min')
    expect(relativeTime('2026-08-29T09:00:00Z', now)).toBe('3 h')
    expect(relativeTime('2026-08-27T12:00:00Z', now)).toBe('2 d')
  })

  it('falls back to a date past a week, where the age matters less than the day', () => {
    expect(relativeTime('2026-08-01T12:00:00Z', now)).toMatch(/Aug/)
  })

  it('never reports a negative age for a clock that is slightly ahead', () => {
    expect(relativeTime('2026-08-29T12:00:30Z', now)).toBe('now')
  })

  it('returns an empty string for an unparseable date rather than "NaN min"', () => {
    expect(relativeTime('not a date', now)).toBe('')
  })
})
