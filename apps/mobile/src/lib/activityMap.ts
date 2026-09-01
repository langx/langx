import { shiftDayKey, streakFromDays } from '@langx/shared'

export type Intensity = 0 | 1 | 2 | 3 | 4

export interface ActivityCell {
  day: string
  /** 0 is an empty square; 1–4 shade a filled one. */
  intensity: Intensity
  /** `future` squares are drawn as gaps, `repairable` ones are tappable. */
  state: 'filled' | 'empty' | 'repairable' | 'future'
  /**
   * Filled by opening the app and nothing else.
   *
   * Its own flag rather than another `intensity` step, because intensity is a
   * count of work and this day has none — folding it into the same scale would
   * renumber every existing square to make room for a zero. Drawn fainter than
   * the lightest worked day, so a run of quiet days is honest about being one
   * without breaking the streak's line.
   *
   * Never set on somebody else's map: the public endpoint sends an intensity
   * and no source, for the same reason it hides which squares were bought.
   */
  checkedIn: boolean
}

/**
 * Seven rows by N columns, Monday at the top and ending on the week that holds
 * today — a calendar, not a timeline, which is the whole point of the shape: a
 * gap on the same row every week says something a flat run of squares cannot.
 *
 * Pure, so the two things that are easy to get wrong and invisible in a
 * screenshot — which square is today, and which ones can still be bought — are
 * testable without a renderer.
 */
export function activityGrid(input: {
  today: string
  weeks: number
  /** Day → qualifying actions. A bought day is present with zero. */
  days: Map<string, number>
  /** Days filled by a check-in alone. Own map only; see `ActivityCell`. */
  checkIns?: ReadonlySet<string>
  maxAgeDays: number
  /**
   * The streak the profile claims, used to fill days the collection cannot
   * account for.
   *
   * `streakDays` only started existing when this map shipped, so an older
   * account has a streak counter and no squares behind it — six months of
   * empty boxes under a "🔥 40", which reads as a bug because it is one. The
   * run ending at `lastQualifiedDay` is filled at the lowest shade: the days
   * are known to have happened, only how busy they were is not.
   */
  streak?: { current: number; lastQualifiedDay: string | null } | undefined
}): ActivityCell[][] {
  const { today, weeks, days, maxAgeDays } = input
  const checkIns = input.checkIns ?? new Set<string>()
  const streakDays = impliedStreakDays(input.streak)
  const oldestRepairable = shiftDayKey(today, -maxAgeDays)

  // Wind forward to the Sunday that closes today's week, so the last column is
  // a whole week and today sits on its own weekday row.
  const end = shiftDayKey(today, 6 - mondayIndex(today))
  const start = shiftDayKey(end, -(weeks * 7 - 1))

  const columns: ActivityCell[][] = []
  let day = start
  for (let column = 0; column < weeks; column++) {
    const cells: ActivityCell[] = []
    for (let row = 0; row < 7; row++) {
      const actions = days.get(day)
      const filled = actions !== undefined || streakDays.has(day)
      cells.push({
        day,
        intensity: filled ? intensityOf(actions ?? 0) : 0,
        checkedIn: filled && checkIns.has(day),
        state:
          day > today
            ? 'future'
            : filled
              ? 'filled'
              : // Today is earned rather than bought, so it is never repairable
                // even though it is empty and inside the window.
                day < today && day >= oldestRepairable
                ? 'repairable'
                : 'empty',
      })
      day = shiftDayKey(day, 1)
    }
    columns.push(cells)
  }
  return columns
}

export interface RepairEffect {
  streakBefore: number
  streakAfter: number
  balanceAfter: number
  /** False when the square fills but joins nothing — said plainly rather than implied. */
  changesStreak: boolean
  affordable: boolean
}

/**
 * What buying this square will actually do, worked out before it is bought.
 *
 * The honest case is the one worth having: a square in the middle of a fortnight
 * nobody was active in fills in and changes no streak at all, and the
 * confirmation says so rather than letting the price imply otherwise.
 */
export function repairEffect(input: {
  day: string
  today: string
  filled: Set<string>
  price: number
  balance: number
}): RepairEffect {
  const { day, today, filled, price, balance } = input
  const streakBefore = streakFromDays(filled, today)
  const streakAfter = streakFromDays(new Set([...filled, day]), today)

  return {
    streakBefore,
    streakAfter,
    balanceAfter: balance - price,
    changesStreak: streakAfter !== streakBefore,
    affordable: balance >= price,
  }
}

/** The gutter between squares, in both directions. */
export const ACTIVITY_CELL_GAP = 3
/** What the squares were before they could grow; nothing gets smaller than this. */
export const ACTIVITY_CELL_MIN = 13
/** A ceiling, so a desktop window gets a heatmap rather than a chessboard. */
export const ACTIVITY_CELL_MAX = 20

/**
 * The square size that makes `weeks` columns fill `width`.
 *
 * The grid was a fixed 13px square: 26 of them plus their gutters is 413px of
 * content inside a container that is 688px wide on the web build, so a third of
 * the card was dead space on every desktop screen — while a narrow phone
 * overflowed and scrolled correctly, which is why it never showed up on a
 * handset.
 *
 * Growing the *square* rather than the number of weeks is deliberate: the
 * window stays half a year on every device, so two people's maps still mean the
 * same thing. Widening it instead would show a desktop reader more history than
 * a phone reader and quietly make the two incomparable.
 *
 * Returns the floor for a width that has not been measured yet, so the first
 * frame draws the old size rather than collapsing to nothing.
 */
export function activityCellSize(width: number, weeks: number): number {
  if (!Number.isFinite(width) || width <= 0 || weeks <= 0) return ACTIVITY_CELL_MIN
  const fitted = Math.floor((width - (weeks - 1) * ACTIVITY_CELL_GAP) / weeks)
  return Math.min(ACTIVITY_CELL_MAX, Math.max(ACTIVITY_CELL_MIN, fitted))
}

/**
 * Monday-first weekday index for a `YYYY-MM-DD` key.
 *
 * Parsed as UTC, not as local time. `new Date('2026-08-30T00:00:00')` is
 * midnight *where the phone is*, and west of UTC that is the previous day —
 * which slid the whole grid by one weekday for anybody in the Americas, and
 * put "today" on the wrong row. A day key is a calendar day and carries no
 * zone; reading it in one is the bug.
 */
function mondayIndex(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}

/**
 * The days the current streak must have covered, walking back from the last
 * one that qualified. Empty when there is no streak, which is the common case
 * and the one where `days` is the whole truth.
 */
function impliedStreakDays(
  streak: { current: number; lastQualifiedDay: string | null } | undefined,
): Set<string> {
  const filled = new Set<string>()
  if (!streak?.lastQualifiedDay || streak.current <= 0) return filled
  for (let back = 0; back < streak.current; back++) {
    filled.add(shiftDayKey(streak.lastQualifiedDay, -back))
  }
  return filled
}

/**
 * Four buckets, matching the server's. Thresholds rather than a scale so one
 * very loud day cannot flatten a year of ordinary ones into the palest shade.
 */
function intensityOf(actions: number): Intensity {
  if (actions >= 30) return 4
  if (actions >= 10) return 3
  if (actions >= 3) return 2
  return 1
}
