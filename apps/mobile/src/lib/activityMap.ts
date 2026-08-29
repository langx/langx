import { shiftDayKey, streakFromDays } from '@langx/shared'

export type Intensity = 0 | 1 | 2 | 3 | 4

export interface ActivityCell {
  day: string
  /** 0 is an empty square; 1–4 shade a filled one. */
  intensity: Intensity
  /** `future` squares are drawn as gaps, `repairable` ones are tappable. */
  state: 'filled' | 'empty' | 'repairable' | 'future'
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
  maxAgeDays: number
}): ActivityCell[][] {
  const { today, weeks, days, maxAgeDays } = input
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
      const filled = actions !== undefined
      cells.push({
        day,
        intensity: filled ? intensityOf(actions) : 0,
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

/** Monday-first weekday index for a `YYYY-MM-DD` key. */
function mondayIndex(day: string): number {
  return (new Date(`${day}T00:00:00`).getDay() + 6) % 7
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
