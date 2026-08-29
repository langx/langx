import { localDayKey, shiftDayKey, TOKEN_RULES } from '@langx/shared'

// Re-exported so callers here keep one import; the walk itself lives in shared,
// because the client has to predict the same number before a repair is bought.
export { streakFromDays } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * One document per user per **local** day they were active.
 *
 * Nothing recorded which days a user showed up. `profile.streak` keeps a
 * number and a `lastQualifiedDay`, which is all the streak itself needs and
 * nothing a calendar can be drawn from — and it is also why a repaired day
 * could not previously be turned back into a streak length. This is that
 * missing set.
 *
 * `_id` is `<userId>:<day>`, the same shape `dailyActivity` uses. It gives the
 * uniqueness that makes a day physically impossible to fill twice, and a
 * prefix range that reads a user's calendar off the `_id` index — so no second
 * index is needed for either.
 */
export interface StreakDay {
  _id: string
  userId: string
  /** `YYYY-MM-DD` in the user's own timezone, like the streak and unlike everything else. */
  day: string
  /** How the square came to be filled. `purchase` is the only one that cost anything. */
  source: 'activity' | 'purchase'
  /** Qualifying actions that day — the map's shading, not its fill. */
  actions: number
}

export function streakDayId(userId: string, day: string): string {
  return `${userId}:${day}`
}

/**
 * Counts a qualifying action against today's square.
 *
 * Called on every message, not only the first of the day: the count is what
 * shades the square, so an early return on "already qualified" would leave
 * every day looking equally busy. Upsert rather than read-then-write for the
 * same reason `recordActivity` is one — two messages landing together must
 * both count.
 */
export async function recordStreakDay(
  db: Db,
  userId: string,
  day: string,
  source: StreakDay['source'] = 'activity',
): Promise<void> {
  await db.collection<StreakDay>(COLLECTIONS.streakDays).updateOne(
    { _id: streakDayId(userId, day) },
    {
      $inc: { actions: 1 },
      $setOnInsert: { userId, day, source },
    },
    { upsert: true },
  )
}

/**
 * The days a user was active, within an inclusive range.
 *
 * A prefix range over `_id` rather than a `{userId, day}` query, so it rides
 * the primary index. `\\uffff` closes the range above every day key that could
 * follow the prefix.
 */
export async function listStreakDays(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<StreakDay[]> {
  return db
    .collection<StreakDay>(COLLECTIONS.streakDays)
    .find({ _id: { $gte: streakDayId(userId, from), $lte: streakDayId(userId, `${to}￿`) } })
    .toArray()
}

/** How many repairs this user has bought in the calendar month `day` falls in. */
export async function repairsInMonth(db: Db, userId: string, day: string): Promise<number> {
  const month = day.slice(0, 7)
  return db.collection<StreakDay>(COLLECTIONS.streakDays).countDocuments({
    _id: { $gte: streakDayId(userId, `${month}-01`), $lte: streakDayId(userId, `${month}-31￿`) },
    source: 'purchase',
  })
}

/** Whether a day is inside the window a repair may still reach. */
export function isRepairable(day: string, today: string, timeZone: string, now: Date): boolean {
  // Today is earned, not bought, and tomorrow has not happened.
  if (day >= today) return false
  const oldest = shiftDayKey(localDayKey(now, timeZone), -TOKEN_RULES.sinks.dayRepairMaxAgeDays)
  return day >= oldest
}
