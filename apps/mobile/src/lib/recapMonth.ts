/**
 * Which month the Me tab offers a recap of, if any.
 *
 * Only in the first seven days of a month, and only of the month just ended:
 * a recap is news for a week and clutter after it. The device's own calendar
 * decides, because "the first week of October" is the reader's October.
 */
export function recapMonthFor(now: Date): string | null {
  if (now.getDate() > 7) return null
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
}

/** `2026-09` → "September" in the reader's language. */
export function monthName(month: string, locale: string): string {
  const [year, index] = month.split('-').map(Number)
  // Mid-month at noon UTC, so no time zone can push it into a neighbour.
  const date = new Date(Date.UTC(year ?? 1970, (index ?? 1) - 1, 15, 12))
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date)
}
