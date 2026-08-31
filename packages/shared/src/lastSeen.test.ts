import { describe, expect, it } from 'vitest'
import { lastSeen } from './lastSeen'

const NOW = new Date('2026-08-31T12:00:00Z')
const ago = (ms: number) => lastSeen(new Date(NOW.getTime() - ms), NOW)

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('lastSeen', () => {
  it('walks the whole ladder', () => {
    expect(ago(5 * SECOND)).toEqual({ unit: 'now', count: 0 })
    expect(ago(59 * SECOND)).toEqual({ unit: 'now', count: 0 })
    expect(ago(MINUTE)).toEqual({ unit: 'minute', count: 1 })
    expect(ago(59 * MINUTE)).toEqual({ unit: 'minute', count: 59 })
    expect(ago(HOUR)).toEqual({ unit: 'hour', count: 1 })
    expect(ago(23 * HOUR)).toEqual({ unit: 'hour', count: 23 })
    expect(ago(DAY)).toEqual({ unit: 'day', count: 1 })
    expect(ago(29 * DAY)).toEqual({ unit: 'day', count: 29 })
    expect(ago(30 * DAY)).toEqual({ unit: 'month', count: 1 })
    expect(ago(364 * DAY)).toEqual({ unit: 'month', count: 11 })
    expect(ago(365 * DAY)).toEqual({ unit: 'year', count: 1 })
    expect(ago(900 * DAY)).toEqual({ unit: 'year', count: 2 })
  })

  /**
   * Presence is stamped by the server and read against the device's clock, so
   * a phone a few minutes fast produces a future timestamp on every profile it
   * opens. "-3 minutes ago" is not an edge case, it is a Tuesday.
   */
  it('reads a future timestamp as now rather than a negative count', () => {
    expect(lastSeen(new Date(NOW.getTime() + 5 * MINUTE), NOW)).toEqual({ unit: 'now', count: 0 })
  })

  /** 360 days is twelve 30-day months; "12 months ago" must never be said. */
  it('never says twelve months', () => {
    for (let days = 330; days < 365; days++) {
      const { unit, count } = ago(days * DAY)
      expect(unit === 'month' ? count : 11).toBeLessThanOrEqual(11)
    }
  })
})
