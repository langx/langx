import {
  APP_PLATFORM_AUTH_KEY,
  APP_VERSION_AUTH_KEY,
  PRESENCE_WRITE_MIN_GAP_MS,
} from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { PresenceThrottle, clientBuildOf } from './presence'

describe('clientBuildOf', () => {
  /**
   * The handshake as `socket.ts` sends it: the build travels in `auth`, next
   * to the cookie and the device id, because neither a browser nor React
   * Native can set a custom header on a WebSocket upgrade. Reading the headers
   * instead found nothing on every connection, and the dashboard's "Builds"
   * panel counted nobody for its first weeks.
   */
  it('recognises the build the app sends on the handshake', () => {
    expect(
      clientBuildOf({
        cookie: 'session_token=abc',
        deviceId: 'phone-1',
        inboxKinds: 'message,follow',
        [APP_VERSION_AUTH_KEY]: '2.9.0',
        [APP_PLATFORM_AUTH_KEY]: 'ios',
      }),
    ).toEqual({ appVersion: '2.9.0', appPlatform: 'ios' })
  })

  it('accepts a two-part version too', () => {
    expect(
      clientBuildOf({ [APP_VERSION_AUTH_KEY]: '2.8', [APP_PLATFORM_AUTH_KEY]: 'android' }),
    ).toEqual({ appVersion: '2.8', appPlatform: 'android' })
  })

  /** A build that says nothing predates the keys; it must leave the field alone. */
  it('is null when the handshake carries no build', () => {
    expect(clientBuildOf({ cookie: 'session_token=abc' })).toBeNull()
    expect(clientBuildOf(undefined)).toBeNull()
  })

  /** Whatever arrives here feeds a `$group`; an unbounded string is an unbounded chart. */
  it('is null for anything that is not a version of ours', () => {
    expect(
      clientBuildOf({ [APP_VERSION_AUTH_KEY]: '2.9.0-beta', [APP_PLATFORM_AUTH_KEY]: 'ios' }),
    ).toBeNull()
    expect(
      clientBuildOf({ [APP_VERSION_AUTH_KEY]: '2.9.0', [APP_PLATFORM_AUTH_KEY]: 'windows' }),
    ).toBeNull()
    expect(
      clientBuildOf({ [APP_VERSION_AUTH_KEY]: 290, [APP_PLATFORM_AUTH_KEY]: 'ios' }),
    ).toBeNull()
  })
})

describe('PresenceThrottle', () => {
  it('writes the first time it is asked', () => {
    expect(new PresenceThrottle(() => 0).shouldWrite()).toBe(true)
  })

  it('refuses a second write inside the gap', () => {
    let now = 0
    const throttle = new PresenceThrottle(() => now)
    expect(throttle.shouldWrite()).toBe(true)
    now = PRESENCE_WRITE_MIN_GAP_MS - 1
    expect(throttle.shouldWrite()).toBe(false)
  })

  it('writes again once the gap has passed', () => {
    let now = 0
    const throttle = new PresenceThrottle(() => now)
    throttle.shouldWrite()
    now = PRESENCE_WRITE_MIN_GAP_MS
    expect(throttle.shouldWrite()).toBe(true)
  })

  /**
   * A refused call must not restart the clock, or a client polling faster
   * than the gap would push the next real write out forever.
   */
  it('does not let a refused call postpone the next one', () => {
    let now = 0
    const throttle = new PresenceThrottle(() => now)
    throttle.shouldWrite()
    for (let t = 1; t < PRESENCE_WRITE_MIN_GAP_MS; t += 1000) {
      now = t
      throttle.shouldWrite()
    }
    now = PRESENCE_WRITE_MIN_GAP_MS
    expect(throttle.shouldWrite()).toBe(true)
  })

  /** The heartbeat must never land inside the gap by construction. */
  it('is looser than the heartbeat it throttles', async () => {
    const { PRESENCE_HEARTBEAT_MS } = await import('@langx/shared')
    expect(PRESENCE_WRITE_MIN_GAP_MS).toBeLessThan(PRESENCE_HEARTBEAT_MS)
  })
})
