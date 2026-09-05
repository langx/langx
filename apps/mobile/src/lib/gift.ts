/**
 * The hourly gift, the client's half: what the card says, and what counts as
 * a shake.
 *
 * Pure, so `vitest.config.ts` reaches it. The server decides whether a gift
 * opens and what it holds; this only turns `nextAt` into words and a stream
 * of accelerometer samples into a single "yes, that was a shake".
 */

export type GiftState = { ready: true } | { ready: false; remainingMs: number; minutes: number }

/**
 * `nextAt` from the wallet → what the card shows. Minutes round *up* and never
 * read zero: "next one in 0 min" beside a card that will not open is a lie.
 */
export function giftState(nextAt: string | null | undefined, now: Date = new Date()): GiftState {
  if (!nextAt) return { ready: true }
  const remainingMs = new Date(nextAt).getTime() - now.getTime()
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return { ready: true }
  return { ready: false, remainingMs, minutes: Math.max(1, Math.ceil(remainingMs / 60_000)) }
}

/** Milliseconds until the next whole minute of the countdown ticks over. */
export function giftTickDelay(remainingMs: number): number {
  const intoMinute = remainingMs % 60_000
  return intoMinute === 0 ? 60_000 : intoMinute
}

export interface AccelSample {
  x: number
  y: number
  z: number
}

/**
 * The size of a sample beyond gravity, in g. A phone lying still reads about
 * 1; a brisk shake peaks past 3, so 1.8 beyond gravity is a clear one.
 */
export function accelerationBeyondGravity(sample: AccelSample): number {
  return Math.abs(Math.hypot(sample.x, sample.y, sample.z) - 1)
}

/**
 * Was that a shake? `hits` samples in the window beyond `threshold` g — two,
 * not one, so a single knock against a table does not open anything.
 */
export function isShake(
  samples: readonly AccelSample[],
  threshold: number = 1.8,
  hits: number = 2,
): boolean {
  let count = 0
  for (const sample of samples) {
    if (accelerationBeyondGravity(sample) > threshold) count++
    if (count >= hits) return true
  }
  return false
}

export interface ShakeGateOptions {
  threshold?: number
  hits?: number
  /** Samples kept; at ten a second, eight is most of a second of motion. */
  windowSize?: number
  /** Quiet time after a shake before another can fire. */
  debounceMs?: number
}

/**
 * Feed samples in, get `true` out at most once per `debounceMs`. Keeps its
 * own window so the hook that owns the sensor stays a dozen lines.
 */
export function createShakeGate(
  options: ShakeGateOptions = {},
): (sample: AccelSample, nowMs: number) => boolean {
  const threshold = options.threshold ?? 1.8
  const hits = options.hits ?? 2
  const windowSize = options.windowSize ?? 8
  const debounceMs = options.debounceMs ?? 1200
  const window: AccelSample[] = []
  let firedAt = -Infinity
  return (sample, nowMs) => {
    // Motion during the quiet time is dropped, not banked: a shake that goes
    // on past the moment it fired must not fire again the instant it ends.
    if (nowMs - firedAt < debounceMs) return false
    window.push(sample)
    if (window.length > windowSize) window.shift()
    if (!isShake(window, threshold, hits)) return false
    firedAt = nowMs
    window.length = 0
    return true
  }
}
