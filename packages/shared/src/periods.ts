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

/** `_id` of an tokenAggregates document. */
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

/**
 * The hour on the user's own clock, 0-23.
 *
 * Every scheduled notification fires on a local hour rather than a UTC one:
 * 20:00 UTC is 5am in Tokyo, which is not a nudge, it is an alarm clock. Falls
 * back to UTC for an unknown zone, like `localDayKey` and for the same reason.
 */
export function localHour(date: Date, timeZone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(date),
    )
  } catch {
    return date.getUTCHours()
  }
}

const startFormatters = new Map<string, Intl.DateTimeFormat>()

function startFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = startFormatters.get(timeZone)
  if (!fmt) {
    // `hourCycle: 'h23'` rather than `hour12: false`, which reads midnight as
    // hour 24 in some engines and would put the answer a day out.
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    startFormatters.set(timeZone, fmt)
  }
  return fmt
}

/** The zone's offset from UTC at `instant`, in milliseconds. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = startFormatter(timeZone).formatToParts(new Date(instant))
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  const wall = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  )
  return wall - instant
}

/**
 * The instant a `YYYY-MM-DD` local day begins — `localDayKey` read backwards,
 * for the times a window has to be cut on a timestamp rather than compared
 * against a key. `new Date(`${key}T00:00:00Z`)` is the *UTC* day's start,
 * which in Vancouver is seven hours early and in Istanbul three hours late.
 *
 * Intl only ever answers "what is the offset at this instant", never "which
 * instant reads this wall clock", so this guesses and corrects: UTC midnight
 * of the key less the offset there, then less the offset measured at that
 * guess. The first measurement can sit on the far side of a DST change —
 * Auckland's clocks go back at 03:00 on 5 April 2026, so UTC midnight of that
 * key is already NZST (+12) while the day itself began in NZDT (+13), and one
 * pass alone lands an hour late.
 *
 * The correction is then checked rather than repeated, because on the days a
 * zone springs forward *at* midnight — Cuba, Chile and the Azores each do —
 * no instant reads 00:00 at all, the two guesses straddle the jump, and which
 * one is real depends on the sign of the offset. Iterating again just
 * oscillates. Checked, the answer is exact for every zone tzdata currently
 * ships: the day begins at the transition, whose clock reads 01:00.
 *
 * Falls back to UTC midnight for an unusable zone, like `localDayKey` and for
 * the same reason; throws on a malformed key, like `shiftDayKey`.
 */
export function localDayStart(dayKey: string, timeZone: string): Date {
  const utcMidnight = Date.parse(`${dayKey}T00:00:00Z`)
  if (Number.isNaN(utcMidnight)) throw new TypeError(`Invalid day key: ${dayKey}`)
  try {
    const guess = utcMidnight - offsetAt(utcMidnight, timeZone)
    const corrected = utcMidnight - offsetAt(guess, timeZone)
    return new Date(localDayKey(new Date(corrected), timeZone) === dayKey ? corrected : guess)
  } catch {
    return new Date(utcMidnight)
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

/**
 * Whether a streak is still worth a nudge today: yesterday counted, or the
 * day before did and a banked freeze can bridge the one missed day — the
 * exact gap `recordQualifyingAction` is willing to spend a freeze on.
 *
 * Nothing decays `streak.current` on its own the moment a day is missed, so
 * "has a number in the field" is not the same as "has a streak". The evening
 * reminder used the former and nagged every person who ever sent one message,
 * every evening, for as long as the account existed.
 */
export function streakSavable(
  streak: { current: number; lastQualifiedDay: string | null },
  freezes: number,
  today: string,
): boolean {
  const last = streak.lastQualifiedDay
  if (last === null || streak.current < 1) return false
  if (last === shiftDayKey(today, -1)) return true
  return last === shiftDayKey(today, -2) && freezes > 0
}

/**
 * Whether a streak is beyond any rescue, freeze included: the last qualified
 * day is three or more days back. This is the line the decay pass resets at.
 *
 * Deliberately one day later than "not savable without a freeze". A freeze
 * bridges exactly one missed day, so `today - 2` is still alive for somebody
 * who paid for one; the pass must not be the thing that wastes it.
 */
export function streakLapsed(lastQualifiedDay: string | null, today: string): boolean {
  return lastQualifiedDay !== null && lastQualifiedDay < shiftDayKey(today, -2)
}
