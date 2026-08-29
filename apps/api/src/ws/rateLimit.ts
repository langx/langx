/**
 * Per-socket rate limiting for realtime events.
 *
 * REST is covered by `@fastify/rate-limit`, but a WebSocket bypasses it
 * entirely: once the handshake is done, `message:send` is just a frame, and
 * nothing counted them. The plan's own rule is that socket events pass through
 * the same guards as REST, and this was the guard they did not.
 *
 * A token bucket rather than a fixed window: a fixed window lets someone send
 * their whole allowance at the boundary and the same again a millisecond
 * later, which is exactly the burst this exists to stop. Refilling
 * continuously also means a normal fast typist never notices it.
 *
 * State is per socket and dies with the connection, which is the right
 * lifetime — reconnecting to get a fresh bucket costs a full handshake and
 * re-authentication, so it is not a cheaper way to spam than just waiting.
 */
export interface BucketConfig {
  /** Maximum burst. */
  capacity: number
  /** Sustained rate, per second. */
  refillPerSecond: number
}

/**
 * Deliberately different per event. Sending a message writes to three
 * collections and can award tokens; `typing` is ephemeral and fires on almost
 * every keystroke, so it needs a much larger allowance to stay invisible.
 */
export const EVENT_LIMITS: Record<string, BucketConfig> = {
  'message:send': { capacity: 20, refillPerSecond: 1 },
  'message:correct': { capacity: 20, refillPerSecond: 1 },
  // Tighter than text: each one is an upload we store and serve.
  'message:media': { capacity: 10, refillPerSecond: 0.5 },
  // Cheap and tappable: a reaction is one small write and people do change
  // their minds, but a held finger on an emoji must not become a write loop.
  'message:react': { capacity: 30, refillPerSecond: 2 },
  // Destructive, and never something anyone does in a burst.
  'message:delete': { capacity: 10, refillPerSecond: 0.5 },
  'conversation:read': { capacity: 30, refillPerSecond: 2 },
  typing: { capacity: 40, refillPerSecond: 10 },
  // One per 20s sustained, burst of 4. A 60s heartbeat passes with room; a
  // client looping on it is refused. `DEFAULT_LIMIT` would cover it, but the
  // note below is explicit that a new event gets a named entry.
  'presence:ping': { capacity: 4, refillPerSecond: 0.05 },
}

/** Applied to any event not named above, so a new one is never accidentally unlimited. */
export const DEFAULT_LIMIT: BucketConfig = { capacity: 20, refillPerSecond: 1 }

interface Bucket {
  tokens: number
  lastRefillMs: number
}

export class SocketRateLimiter {
  readonly #buckets = new Map<string, Bucket>()
  readonly #now: () => number

  constructor(now: () => number = Date.now) {
    this.#now = now
  }

  /** True when the event is allowed; false means it should be refused. */
  take(event: string): boolean {
    const config = EVENT_LIMITS[event] ?? DEFAULT_LIMIT
    const now = this.#now()
    const bucket = this.#buckets.get(event) ?? { tokens: config.capacity, lastRefillMs: now }

    const elapsedSeconds = (now - bucket.lastRefillMs) / 1000
    bucket.tokens = Math.min(
      config.capacity,
      bucket.tokens + elapsedSeconds * config.refillPerSecond,
    )
    bucket.lastRefillMs = now

    if (bucket.tokens < 1) {
      this.#buckets.set(event, bucket)
      return false
    }

    bucket.tokens -= 1
    this.#buckets.set(event, bucket)
    return true
  }

  /** Seconds until the next event of this kind would be allowed. For `retryAt`. */
  retryAfterSeconds(event: string): number {
    const config = EVENT_LIMITS[event] ?? DEFAULT_LIMIT
    const bucket = this.#buckets.get(event)
    if (!bucket || bucket.tokens >= 1) return 0
    return Math.ceil((1 - bucket.tokens) / config.refillPerSecond)
  }
}
