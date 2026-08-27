import { describe, expect, it } from 'vitest'
import { EVENT_LIMITS, SocketRateLimiter } from './rateLimit'

describe('socket rate limiting', () => {
  /** A controllable clock, so the refill can be tested without waiting for it. */
  function limiterAt(startMs = 0) {
    let now = startMs
    const limiter = new SocketRateLimiter(() => now)
    return { limiter, advance: (ms: number) => (now += ms) }
  }

  it('allows a burst up to capacity and then refuses', () => {
    const { limiter } = limiterAt()
    const capacity = EVENT_LIMITS['message:send']!.capacity

    for (let i = 0; i < capacity; i++) {
      expect(limiter.take('message:send'), `event ${i + 1} of ${capacity}`).toBe(true)
    }
    expect(limiter.take('message:send')).toBe(false)
  })

  it('refills continuously rather than in a fixed window', () => {
    // The bug a fixed window has: spend the whole allowance, and a millisecond
    // later spend it all again at the boundary. A token bucket cannot.
    const { limiter, advance } = limiterAt()
    const capacity = EVENT_LIMITS['message:send']!.capacity
    for (let i = 0; i < capacity; i++) limiter.take('message:send')
    expect(limiter.take('message:send')).toBe(false)

    advance(1000) // one second at 1/second
    expect(limiter.take('message:send')).toBe(true)
    expect(limiter.take('message:send')).toBe(false)

    advance(5000)
    for (let i = 0; i < 5; i++) expect(limiter.take('message:send')).toBe(true)
    expect(limiter.take('message:send')).toBe(false)
  })

  it('never refills past capacity however long the socket idles', () => {
    const { limiter, advance } = limiterAt()
    const capacity = EVENT_LIMITS['message:send']!.capacity
    advance(60 * 60 * 1000)

    for (let i = 0; i < capacity; i++) expect(limiter.take('message:send')).toBe(true)
    expect(limiter.take('message:send')).toBe(false)
  })

  it('keeps a separate budget per event', () => {
    // Exhausting sends must not stop the client marking a thread read.
    const { limiter } = limiterAt()
    for (let i = 0; i < EVENT_LIMITS['message:send']!.capacity; i++) limiter.take('message:send')
    expect(limiter.take('message:send')).toBe(false)
    expect(limiter.take('conversation:read')).toBe(true)
  })

  it('gives typing a much larger allowance than sending', () => {
    // It fires on almost every keystroke; a send-sized budget would make the
    // indicator flicker off mid-sentence for a normal typist.
    expect(EVENT_LIMITS['typing']!.refillPerSecond).toBeGreaterThan(
      EVENT_LIMITS['message:send']!.refillPerSecond,
    )
  })

  it('rate-limits an event it has never heard of, rather than letting it through', () => {
    const { limiter } = limiterAt()
    let allowed = 0
    for (let i = 0; i < 100; i++) if (limiter.take('some:future:event')) allowed++
    expect(allowed).toBeLessThan(100)
  })

  it('reports how long until the next event is allowed', () => {
    const { limiter } = limiterAt()
    expect(limiter.retryAfterSeconds('message:send')).toBe(0)
    for (let i = 0; i < EVENT_LIMITS['message:send']!.capacity; i++) limiter.take('message:send')
    limiter.take('message:send')
    expect(limiter.retryAfterSeconds('message:send')).toBeGreaterThan(0)
  })
})
