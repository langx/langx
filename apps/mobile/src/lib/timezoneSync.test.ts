import { TIMEZONE_UPDATE_COOLDOWN_MS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { timezoneToSync } from './timezoneSync'

const NOW = new Date('2026-09-27T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe('timezoneToSync', () => {
  it('fills in a profile that has no zone', () => {
    expect(
      timezoneToSync({
        deviceZone: 'Europe/Istanbul',
        profileZone: undefined,
        timezoneUpdatedAt: undefined,
        now: NOW,
      }),
    ).toBe('Europe/Istanbul')
  })

  it('writes nothing when the zones already agree', () => {
    expect(
      timezoneToSync({
        deviceZone: 'Europe/Istanbul',
        profileZone: 'Europe/Istanbul',
        timezoneUpdatedAt: ago(1e12),
        now: NOW,
      }),
    ).toBeNull()
  })

  it('waits out the cooldown before following a move', () => {
    const moved = { deviceZone: 'America/New_York', profileZone: 'Europe/Istanbul', now: NOW }
    expect(
      timezoneToSync({ ...moved, timezoneUpdatedAt: ago(TIMEZONE_UPDATE_COOLDOWN_MS - 60_000) }),
    ).toBeNull()
    expect(timezoneToSync({ ...moved, timezoneUpdatedAt: ago(TIMEZONE_UPDATE_COOLDOWN_MS) })).toBe(
      'America/New_York',
    )
  })

  it('does not treat a timestamp in the future as an elapsed cooldown', () => {
    expect(
      timezoneToSync({
        deviceZone: 'America/New_York',
        profileZone: 'Europe/Istanbul',
        timezoneUpdatedAt: ago(-60_000),
        now: NOW,
      }),
    ).toBeNull()
  })

  it('writes nothing for a device that reports no zone, or one it cannot use', () => {
    for (const deviceZone of [undefined, '', 'Not/AZone']) {
      expect(
        timezoneToSync({
          deviceZone,
          profileZone: undefined,
          timezoneUpdatedAt: undefined,
          now: NOW,
        }),
      ).toBeNull()
    }
  })
})
