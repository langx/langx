import { PRESENCE_WRITE_MIN_GAP_MS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { PresenceThrottle } from './presence'

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
