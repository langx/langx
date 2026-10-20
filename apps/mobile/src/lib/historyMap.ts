import { activityGrid } from './activityMap'
import { newestRepairDay } from './storeOffers'

/**
 * What one square of the redesign's history map says (`V-StreakHistory`).
 *
 * The same four words the history list uses for a day — checked in, opened
 * the app, filled in with tokens, missed — so a square and its row can never
 * disagree. `none` is a day nothing is known about (before the account's first
 * day on record), `future` one that has not happened.
 */
export type HistoryMapState = 'done' | 'opened' | 'bought' | 'missed' | 'none' | 'future'

export interface HistoryMapCell {
  day: string
  state: HistoryMapState
  today: boolean
}

export interface HistoryMap {
  /** Seven rows by `weeks` columns, Monday at the top, oldest week first. */
  columns: HistoryMapCell[][]
  /**
   * The day whose month names each column, or null for a column that carries
   * no label. A column is labelled where a month begins, and the first column
   * with its own month unless the next one begins too close to leave it room.
   */
  monthOf: (string | null)[]
  /** How many squares are in each of the four legend states. */
  counts: Record<'done' | 'opened' | 'bought' | 'missed', number>
  /** The squares up to and including today: what the counts are out of. */
  elapsed: number
}

interface HistoryDay {
  day: string
  actions: number
  source: 'activity' | 'purchase' | 'checkIn'
}

/**
 * The map's squares, from `/me/activity` as the legacy map and the history
 * list read it.
 *
 * Days are the streak's own: `today` is the server's day in the profile's
 * time zone, and every key in `days` was written on that same local day. No
 * square is placed by the phone's clock or by UTC, so the map, the list under
 * it and the streak's number all agree on which day a square is. (The token
 * ledger's UTC day is a different thing, and the wallet history's to draw.)
 *
 * The calendar frame — which column holds today, Monday at the top — is
 * `activityGrid`'s, so the two maps cannot drift on it. Only the reading of a
 * square differs: the legacy map shades by how busy a day was; this one says
 * what kind of day it was, as the board does.
 */
export function historyMap(input: {
  today: string
  weeks: number
  days: readonly HistoryDay[]
  streak?: { current: number; lastQualifiedDay: string | null } | undefined
}): HistoryMap {
  const { today, weeks } = input
  const byDay = new Map(input.days.map((entry) => [entry.day, entry]))
  // `activityGrid` already fills the days the current streak must have
  // covered when an older account has no rows behind them; a square it calls
  // filled with no row of its own is one of those.
  const frame = activityGrid({
    today,
    weeks,
    days: new Map(input.days.map((entry) => [entry.day, entry.actions])),
    maxAgeDays: 0,
    streak: input.streak,
  })

  // An account made last week has not *missed* the weeks before it existed —
  // the same floor the history list stops at.
  let oldest: string | null = null
  for (const cell of frame.flat()) {
    if (cell.state === 'filled' && (oldest === null || cell.day < oldest)) oldest = cell.day
  }
  for (const entry of input.days) {
    if (oldest === null || entry.day < oldest) oldest = entry.day
  }

  const counts = { done: 0, opened: 0, bought: 0, missed: 0 }
  let elapsed = 0
  const columns = frame.map((column) =>
    column.map((cell): HistoryMapCell => {
      const state = stateOf(cell, byDay.get(cell.day), today, oldest)
      if (state !== 'future') elapsed++
      if (state !== 'future' && state !== 'none') counts[state]++
      return { day: cell.day, state, today: cell.day === today }
    }),
  )

  return { columns, monthOf: monthLabels(columns), counts, elapsed }
}

function stateOf(
  cell: { day: string; state: string },
  entry: HistoryDay | undefined,
  today: string,
  oldest: string | null,
): HistoryMapState {
  if (cell.state === 'future') return 'future'
  if (entry) {
    // `actions`, not `source`, decides between a day of work and an opened
    // app, for the reason `streakHistory` gives: a day that began as a
    // check-in and later saw a message keeps `source: 'checkIn'`.
    if (entry.source === 'purchase') return 'bought'
    return entry.actions > 0 ? 'done' : 'opened'
  }
  if (cell.state === 'filled') return 'done'
  // Today is still being earned: an empty today is not a miss yet.
  if (cell.day === today || oldest === null || cell.day < oldest) return 'none'
  return 'missed'
}

/**
 * The missed day the page's "Buy a day back" card offers, with the repairs
 * left for it — or null when there is no day the repair endpoint would take.
 *
 * The store's own choice of day (`newestRepairDay`), so the two never offer
 * different ones, narrowed twice:
 *
 * - Only a day the map above calls missed. The store does not know when the
 *   account began, and a day before it is not a miss to buy back.
 * - Only while the *day's* month has a repair left. The server counts the cap
 *   in the month of the day being repaired, while `usedThisMonth` is today's
 *   month: early in a month the newest missed day can sit in the last one,
 *   whose two repairs may already be spent, and a card offering it would end
 *   in a refusal. The bought days in `days` say how many — the range the
 *   page asks for reaches well past the start of that month.
 */
export function historyRepairOffer(input: {
  map: HistoryMap
  today: string
  days: readonly HistoryDay[]
  usedThisMonth: number
  /**
   * The server's count per `YYYY-MM`, when it sends one. Passed to the store's
   * own choice so the two still offer the same day once today's month is
   * spent and last month's is not.
   */
  usedByMonth?: Readonly<Record<string, number>> | undefined
  perMonth: number
}): { day: string; left: number } | null {
  const { map, today, days, usedThisMonth, usedByMonth, perMonth } = input
  const day = newestRepairDay({
    today,
    filled: new Set(days.map((entry) => entry.day)),
    usedThisMonth,
    usedByMonth,
  })
  if (!day) return null
  const missed = map.columns.some((column) =>
    column.some((cell) => cell.day === day && cell.state === 'missed'),
  )
  if (!missed) return null
  const month = day.slice(0, 7)
  // Today's month is the server's own count; an earlier one is read off the rows.
  const used = usedByMonth
    ? (usedByMonth[month] ?? 0)
    : month === today.slice(0, 7)
      ? usedThisMonth
      : days.filter((entry) => entry.source === 'purchase' && entry.day.startsWith(month)).length
  const left = perMonth - used
  return left > 0 ? { day, left } : null
}

/**
 * A month's short name over the column it begins in. The first column takes
 * its own month too — the map should say where it starts — unless the next
 * month begins in the very next column, where the two names would collide.
 */
function monthLabels(columns: HistoryMapCell[][]): (string | null)[] {
  const starts = columns.map((column) => column.find((cell) => cell.day.endsWith('-01'))?.day)
  return columns.map((column, index) => {
    const start = starts[index]
    if (start) return start
    if (index !== 0) return null
    const soon = Boolean(starts[1])
    return soon ? null : (column[0]?.day ?? null)
  })
}
