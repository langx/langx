/**
 * How long an account has existed, worded for a profile screen.
 *
 * This is a trust signal, not a statistic: an account made this morning and
 * one made three years ago should not look the same to the person deciding
 * whether to answer a message. That is also why the unit widens — "1,094 days
 * ago" is precise and tells a reader nothing.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Below this many days the label counts days; above it, months. */
const DAYS_IN_MONTH = 30
const DAYS_IN_YEAR = 365

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

/**
 * Whole days elapsed, floored. Negative when the input is in the future —
 * which happens with nothing more exotic than a phone whose clock is a few
 * minutes fast, so callers must not assume this is positive.
 */
function daysSince(createdAt: Date, now: Date): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / MS_PER_DAY)
}

/**
 * "today", "5 days ago", "3 months ago", "2 years ago" — the phrase only,
 * without a verb, so each surface supplies its own ("Registered …", "Joined
 * …") instead of this deciding for all of them.
 *
 * The month and year steps divide by fixed 30- and 365-day lengths rather
 * than doing calendar arithmetic. The unit is already an approximation at
 * that range, and calendar months would buy an exactness the label discards
 * while adding leap-year and month-length edges to get wrong.
 */
export function formatAccountAge(createdAt: Date, now: Date = new Date()): string {
  const days = daysSince(createdAt, now)

  // Includes future dates: a clock a few minutes fast must not render
  // "-1 days ago", and "today" is the honest reading of an account that is
  // at most hours old.
  if (days < 1) return 'today'
  if (days < DAYS_IN_MONTH) return plural(days, 'day')

  if (days < DAYS_IN_YEAR) {
    // 360 days is 12 whole 30-day months but not yet a year, and "12 months
    // ago" next to a "1 year ago" that arrives five days later reads as a
    // bug. Hold at 11 until the year step takes over.
    return plural(Math.min(Math.floor(days / DAYS_IN_MONTH), 11), 'month')
  }
  return plural(Math.floor(days / DAYS_IN_YEAR), 'year')
}
