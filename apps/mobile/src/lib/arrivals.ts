/**
 * Which thread rows arrived while the reader was watching.
 *
 * The new-message entrance plays for a message that came in live — sent from
 * this screen, or pushed over the socket while it was open — and never for
 * history: not a page loading, not a scroll back, not a thread reopened, not
 * the refetch that follows a reconnect. Freshness is therefore something the
 * client saw happen, noted at the moment it happened, and not anything read
 * off `createdAt`: a phone whose clock runs a minute behind would find every
 * message "new".
 *
 * Each arrival is taken once. The row that animates consumes it on mount, so
 * when the list virtualises that row away and brings it back, it is simply
 * there. An arrival nobody takes within `windowMs` — a message landing in a
 * thread scrolled far up, whose row never mounted — lapses.
 */
export interface Arrivals {
  /** A row with this key has just arrived. */
  note: (key: string, now: number) => void
  /** Whether a row mounting now with this key should play its entrance. Once. */
  take: (key: string, now: number) => boolean
}

export const ARRIVAL_WINDOW_MS = 2000

export function createArrivals(windowMs: number = ARRIVAL_WINDOW_MS): Arrivals {
  const noted = new Map<string, number>()
  return {
    note(key, now) {
      // Swept here rather than on a timer: the map only grows while things
      // arrive, so arriving is when it is worth tidying.
      for (const [old, at] of noted) if (now - at > windowMs) noted.delete(old)
      noted.set(key, now)
    },
    take(key, now) {
      const at = noted.get(key)
      if (at === undefined) return false
      noted.delete(key)
      return now - at <= windowMs
    },
  }
}
