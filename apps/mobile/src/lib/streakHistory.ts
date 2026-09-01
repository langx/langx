import { shiftDayKey } from '@langx/shared'

/**
 * What happened on one day, as the history reads it.
 *
 * `checkedIn` means real work happened; `openedOnly` means the app was opened
 * and nothing else. Both hold the streak, and the history is the one place that
 * says which — the map can only make the square fainter.
 */
export type StreakDayKind = 'checkedIn' | 'openedOnly' | 'bought' | 'missed'

export interface StreakHistoryRow {
  day: string
  kind: StreakDayKind
  /** Qualifying actions that day. Zero on a bought day, by construction. */
  actions: number
  /** When the first one happened. Absent on a bought day and on old records. */
  firstAt?: string
}

interface HistoryDay {
  day: string
  actions: number
  source: 'activity' | 'purchase' | 'checkIn'
  firstAt?: string
}

/**
 * One row per day, newest first, including the days nothing happened.
 *
 * The activity map answers "how consistent, roughly" in a shape you take in at
 * a glance. This answers what the squares cannot: which day that was, when the
 * check-in happened, and which of them were bought. The missed days are the
 * point — a list of only the good days is a trophy cabinet, not a history.
 *
 * It stops at the oldest day on record rather than filling the whole window.
 * An account made yesterday has not *missed* the fifty-nine days before it
 * existed, and saying it did would be both wrong and discouraging.
 */
export function streakHistory(input: {
  today: string
  from: string
  days: readonly HistoryDay[]
}): StreakHistoryRow[] {
  const byDay = new Map(input.days.map((entry) => [entry.day, entry]))
  const oldest = input.days.reduce<string | null>(
    (found, entry) => (found === null || entry.day < found ? entry.day : found),
    null,
  )
  if (oldest === null) return []

  const floor = oldest < input.from ? input.from : oldest
  const rows: StreakHistoryRow[] = []
  for (let day = input.today; day >= floor; day = shiftDayKey(day, -1)) {
    const entry = byDay.get(day)
    if (!entry) {
      rows.push({ day, kind: 'missed', actions: 0 })
      continue
    }
    rows.push({
      day,
      /*
       * `actions`, not `source`, decides between the two. A day that opened as
       * a check-in and later saw a real message keeps `source: 'checkIn'` —
       * the field says how the day *began* — so reading the source alone would
       * report a day of work as an empty one.
       */
      kind: entry.source === 'purchase' ? 'bought' : entry.actions > 0 ? 'checkedIn' : 'openedOnly',
      actions: entry.actions,
      ...(entry.firstAt ? { firstAt: entry.firstAt } : {}),
    })
  }
  return rows
}
