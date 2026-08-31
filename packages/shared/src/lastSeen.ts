/**
 * How long ago someone was last active, worded for a profile or a chat header.
 *
 * A sibling of `accountAge`, and split from it for the same reason it exists at
 * all: this decides *which unit is honest*, and the client turns that into
 * words, because the plural rule belongs to the reader's language and three of
 * the eight the app ships in do not split on `!== 1`.
 *
 * The ladder is finer at the bottom than `accountAge`'s. An account made this
 * morning and one made yesterday are the same kind of new, so "today" is enough
 * there; but "seen 4 minutes ago" and "seen 20 hours ago" are the difference
 * between someone who will reply and someone who will not, which is the whole
 * question a reader is asking.
 */

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

/** Matches `accountAge`, so the two never disagree about how long a month is. */
const DAYS_IN_MONTH = 30
const DAYS_IN_YEAR = 365

export type LastSeenUnit = 'now' | 'minute' | 'hour' | 'day' | 'month' | 'year'

export interface LastSeen {
  unit: LastSeenUnit
  /** Meaningless when `unit` is `now`; zero there rather than absent. */
  count: number
}

/**
 * The unit and count for a last-active timestamp.
 *
 * A future timestamp reads as `now` rather than as a negative count. That is
 * not a hypothetical: presence is stamped by the server and read against the
 * device's clock, so a phone a few minutes fast produces one on every profile
 * it opens.
 */
export function lastSeen(at: Date, now: Date = new Date()): LastSeen {
  const elapsed = Math.max(0, now.getTime() - at.getTime())

  if (elapsed < MS_PER_MINUTE) return { unit: 'now', count: 0 }
  if (elapsed < MS_PER_HOUR) {
    return { unit: 'minute', count: Math.floor(elapsed / MS_PER_MINUTE) }
  }
  if (elapsed < MS_PER_DAY) return { unit: 'hour', count: Math.floor(elapsed / MS_PER_HOUR) }

  const days = Math.floor(elapsed / MS_PER_DAY)
  if (days < DAYS_IN_MONTH) return { unit: 'day', count: days }
  if (days < DAYS_IN_YEAR) {
    // Held at 11 for the same reason as `accountAge`: 360 days is twelve whole
    // 30-day months but not yet a year, and "12 months ago" followed five days
    // later by "1 year ago" reads as a bug.
    return { unit: 'month', count: Math.min(Math.floor(days / DAYS_IN_MONTH), 11) }
  }
  return { unit: 'year', count: Math.floor(days / DAYS_IN_YEAR) }
}
