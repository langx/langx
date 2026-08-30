import { isCalendarDate } from '@langx/shared'

/**
 * `YYYY-MM-DD` ⇄ `Date`, both ways through **local noon**.
 *
 * The stored value is a calendar day with no zone. Turning it into a `Date` at
 * midnight puts it on the previous day for anyone west of UTC once anything
 * formats it, and reading a picker's `Date` back with `toISOString` does the
 * same in reverse. Noon is far enough from both edges that no zone can move
 * the day, which is the only property either direction needs.
 */
export function parseDayKey(value: string): Date | null {
  if (!isCalendarDate(value)) return null
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day, 12)
}

export function formatDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
