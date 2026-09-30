/**
 * Which month the Me tab offers a recap of, if any.
 *
 * Only in the first seven days of a month, and only of the month just ended:
 * a recap is news for a week and clutter after it. The device's own calendar
 * decides, because "the first week of October" is the reader's October.
 */
export function recapMonthFor(now: Date): string | null {
  if (now.getDate() > 7) return null
  return previousMonth(now)
}

/** The month before `now`'s, as `YYYY-MM`, on the device's calendar. */
export function previousMonth(now: Date): string {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The month a recap screen shows: the one in its link, or — for `/recap` with
 * no `?month=`, which is what a reload or a typed address gives on the web —
 * the last finished one, as the API does. Without the fallback the query never
 * starts and the screen waits on it forever.
 */
export function recapMonthParam(param: unknown, now: Date): string {
  return typeof param === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)
    ? param
    : previousMonth(now)
}

/** `2026-09` → "September" in the reader's language. */
export function monthName(month: string, locale: string): string {
  const [year, index] = month.split('-').map(Number)
  // Mid-month at noon UTC, so no time zone can push it into a neighbour.
  const date = new Date(Date.UTC(year ?? 1970, (index ?? 1) - 1, 15, 12))
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date)
}
