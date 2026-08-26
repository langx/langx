/**
 * Two different notions of "a day" live here, and the asymmetry is deliberate.
 *
 * - **Leaderboard periods are UTC.** A global table has to be comparable; every
 *   user must be racing against the same clock.
 * - **Streaks are the user's local day.** "Today" has to feel like today, or the
 *   streak mechanic loses its meaning.
 *
 * Keep them separate. Using a local day for aggregates would let someone farm a
 * period twice by flying east.
 */

export const PERIOD_TYPES = ['all', 'year', 'month', 'week'] as const
export type PeriodType = (typeof PERIOD_TYPES)[number]

/** `_id` of an xpAggregates document. */
export function aggregateId(userId: string, periodType: PeriodType, periodKey: string): string {
  return `${userId}:${periodType}:${periodKey}`
}

/** ISO-8601 week-numbering year and week for a UTC instant. */
function isoWeek(date: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // Shift to the Thursday of this ISO week; its calendar year is the ISO year.
  const dayOfWeek = t.getUTCDay() || 7 // Mon=1 … Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - dayOfWeek)
  const year = t.getUTCFullYear()
  const yearStart = Date.UTC(year, 0, 1)
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return { year, week }
}

export function weekKey(date: Date): string {
  const { year, week } = isoWeek(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function yearKey(date: Date): string {
  return String(date.getUTCFullYear())
}

/** UTC day bucket for ledger rows: `YYYY-MM-DD`. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Every period key an award at `date` contributes to. */
export function periodKeys(date: Date): Record<PeriodType, string> {
  return {
    all: 'all',
    year: yearKey(date),
    month: monthKey(date),
    week: weekKey(date),
  }
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>()

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = dayFormatters.get(timeZone)
  if (!fmt) {
    // en-CA renders as YYYY-MM-DD, which sorts lexicographically.
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dayFormatters.set(timeZone, fmt)
  }
  return fmt
}

/**
 * The user's local calendar day, `YYYY-MM-DD`. Falls back to UTC for an
 * unknown/invalid IANA zone rather than throwing — a bad timezone string must
 * not be able to break streak accounting.
 */
export function localDayKey(date: Date, timeZone: string): string {
  try {
    return dayFormatter(timeZone).format(date)
  } catch {
    return utcDayKey(date)
  }
}

/** Shift a `YYYY-MM-DD` key by whole days. */
export function shiftDayKey(dayKey: string, days: number): string {
  const ms = Date.parse(`${dayKey}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new TypeError(`Invalid day key: ${dayKey}`)
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10)
}

/** True when `current` is exactly the day after `previous`. */
export function isConsecutiveDay(previous: string, current: string): boolean {
  return shiftDayKey(previous, 1) === current
}

/**
 * Next streak value given the last qualifying day and the day of the action
 * that just happened. Same day is a no-op; a gap resets to 1.
 */
export function nextStreak(
  current: number,
  lastQualifiedDay: string | null,
  today: string,
): number {
  if (lastQualifiedDay === today) return current
  if (lastQualifiedDay !== null && isConsecutiveDay(lastQualifiedDay, today)) return current + 1
  return 1
}
