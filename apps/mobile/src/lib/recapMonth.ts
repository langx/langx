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

/**
 * Which year the Me tab offers "Your Year" of, if any: the year so far from
 * the 20th of December, when people look back, and the year just ended in the
 * first week of January — the month's own week, so the two rows come and go
 * together.
 */
export function recapYearFor(now: Date): string | null {
  if (now.getMonth() === 11 && now.getDate() >= 20) return String(now.getFullYear())
  if (now.getMonth() === 0 && now.getDate() <= 7) return String(now.getFullYear() - 1)
  return null
}

/** The `?year=` of a recap link, when it is one; otherwise the screen is a month's. */
export function recapYearParam(param: unknown): string | null {
  return typeof param === 'string' && /^\d{4}$/.test(param) ? param : null
}

/** `2026-09` → "September" in the reader's language. */
export function monthName(month: string, locale: string): string {
  const [year, index] = month.split('-').map(Number)
  // Mid-month at noon UTC, so no time zone can push it into a neighbour.
  const date = new Date(Date.UTC(year ?? 1970, (index ?? 1) - 1, 15, 12))
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date)
}
