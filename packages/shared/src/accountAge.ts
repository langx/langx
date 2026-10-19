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

/**
 * Whole days elapsed, floored. Negative when the input is in the future —
 * which happens with nothing more exotic than a phone whose clock is a few
 * minutes fast, so callers must not assume this is positive.
 */
function daysSince(createdAt: Date, now: Date): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / MS_PER_DAY)
}

/** The unit the age is expressed in, once it has been widened. */
export type AccountAgeUnit = 'today' | 'day' | 'month' | 'year'

export interface AccountAge {
  unit: AccountAgeUnit
  /** Meaningless when `unit` is `today`; zero there rather than absent. */
  count: number
}

/**
 * How old an account is, as a unit and a count rather than a phrase.
 *
 * It used to return "5 days ago" directly, which was fine while there was one
 * language. It cannot be: the plural rule belongs to the reader's language and
 * three of the ones the app ships in do not split on `!== 1`. So this decides
 * *which* unit is honest — the interesting half, and the half worth testing —
 * and the client turns that into words.
 *
 * The month and year steps divide by fixed 30- and 365-day lengths rather
 * than doing calendar arithmetic. The unit is already an approximation at
 * that range, and calendar months would buy an exactness the label discards
 * while adding leap-year and month-length edges to get wrong.
 */
export function accountAge(createdAt: Date, now: Date = new Date()): AccountAge {
  const days = daysSince(createdAt, now)

  // Includes future dates: a clock a few minutes fast must not render
  // "-1 days ago", and "today" is the honest reading of an account that is
  // at most hours old.
  if (days < 1) return { unit: 'today', count: 0 }
  if (days < DAYS_IN_MONTH) return { unit: 'day', count: days }

  if (days < DAYS_IN_YEAR) {
    // 360 days is 12 whole 30-day months but not yet a year, and "12 months
    // ago" next to a "1 year ago" that arrives five days later reads as a
    // bug. Hold at 11 until the year step takes over.
    return { unit: 'month', count: Math.min(Math.floor(days / DAYS_IN_MONTH), 11) }
  }
  return { unit: 'year', count: Math.floor(days / DAYS_IN_YEAR) }
}

/**
 * How long an account is new: the days the Me tab shows its first week's
 * checklist instead of the numbers it does not have yet, and the Chats tab
 * its "Correct a sentence" coach card.
 *
 * Seven, because the checklist is called the first week and says so. The
 * server decides it (`/me/tokens` sends `firstWeek` only inside it), so a
 * phone whose clock is a day out does not get a different Me from the API.
 */
export const FIRST_WEEK_DAYS = 7

/**
 * Whether an account made at `createdAt` is still in its first week at `now`.
 *
 * Elapsed time, not calendar days: "the first seven days" from the minute the
 * account was made, whatever timezone it lives in. A `createdAt` in the future
 * — a clock running ahead — counts as new, which is what an account made a
 * moment ago is.
 */
export function isInFirstWeek(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() < FIRST_WEEK_DAYS * MS_PER_DAY
}
