import { LOCATION_REFRESH_MIN_GAP_MS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { shouldRefreshLocation } from './locationRefresh'

const NOW = new Date('2026-08-31T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe('shouldRefreshLocation', () => {
  it('does nothing for somebody who is not sharing', () => {
    expect(shouldRefreshLocation({ hasLocation: false, now: NOW })).toBe(false)
    expect(
      shouldRefreshLocation({ hasLocation: false, locationUpdatedAt: ago(1e12), now: NOW }),
    ).toBe(false)
  })

  it('waits out the gap', () => {
    expect(
      shouldRefreshLocation({
        hasLocation: true,
        locationUpdatedAt: ago(LOCATION_REFRESH_MIN_GAP_MS - 60_000),
        now: NOW,
      }),
    ).toBe(false)
    expect(
      shouldRefreshLocation({
        hasLocation: true,
        locationUpdatedAt: ago(LOCATION_REFRESH_MIN_GAP_MS),
        now: NOW,
      }),
    ).toBe(true)
  })

  /** A point written before the field existed has no timestamp to compare. */
  it('refreshes a point that has no timestamp', () => {
    expect(shouldRefreshLocation({ hasLocation: true, now: NOW })).toBe(true)
    expect(
      shouldRefreshLocation({ hasLocation: true, locationUpdatedAt: 'nonsense', now: NOW }),
    ).toBe(true)
  })

  /** A phone whose clock is fast is not a stale location. */
  it('does not refresh on a future timestamp', () => {
    expect(
      shouldRefreshLocation({ hasLocation: true, locationUpdatedAt: ago(-60_000), now: NOW }),
    ).toBe(false)
  })
})
