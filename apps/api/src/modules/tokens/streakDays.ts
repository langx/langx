// Re-exported so callers here keep one import; the walk itself lives in shared,
// because the client has to predict the same number before a repair is bought.
// `streakHeadDay` travels with it: they share the rule about where an
// unfinished today starts from, and splitting them across two imports is how
// one of them ends up being reimplemented.
export { streakFromDays, streakHeadDay } from '@langx/shared'
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
  /**
   * How the square came to be filled. `purchase` is the only one that cost
   * anything; `checkIn` is the only one that took nothing but showing up.
   *
   * Written once, on insert, so it says how the day *began*. A day that opened
   * as a `checkIn` and later saw a real message keeps the source and gains
   * `actions` — which is the pair the map reads, not the source alone.
   */
  source: 'activity' | 'purchase' | 'checkIn'
  /**
   * When the first qualifying action of the day happened. Absent on days
   * recorded before this field existed, and on a bought day — which has no
   * check-in by definition, and must not be given a fabricated one.
   */
  firstAt?: Date
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
  at: Date,
  source: StreakDay['source'] = 'activity',
): Promise<void> {
  await db.collection<StreakDay>(COLLECTIONS.streakDays).updateOne(
    { _id: streakDayId(userId, day) },
    {
      $inc: { actions: 1 },
      /**
       * `firstAt` under `$setOnInsert` is what makes it the *check-in* time:
       * only the first qualifying action of the day writes it, and every later
       * one leaves it alone. `$set` would turn it into "most recent action",
       * which is a different fact and not the one worth showing.
       *
       * Days recorded before this field existed simply have none, and the
       * history screen says the time is unknown rather than inventing one.
       */
      $setOnInsert: { userId, day, source, firstAt: at },
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

/**
 * Fills today's square for somebody who only opened the app.
 *
 * `actions` stays at zero and nothing is incremented: a check-in is not a
 * qualifying action, and counting it as one would make the map's shading — a
 * count of real work — say something it does not mean. What it does is put the
 * day in the set, which is what `streakFromDays` walks and what a repair later
 * recomputes a streak length from.
 *
 * `$setOnInsert` throughout, so arriving after a real message of the same day
 * changes nothing at all.
 */
export async function recordCheckInDay(
  db: Db,
  userId: string,
  day: string,
  at: Date,
): Promise<void> {
  await db
    .collection<StreakDay>(COLLECTIONS.streakDays)
    .updateOne(
      { _id: streakDayId(userId, day) },
      { $setOnInsert: { userId, day, source: 'checkIn', firstAt: at, actions: 0 } },
      { upsert: true },
    )
}

/** How many repairs this user has bought in the calendar month `day` falls in. */
export async function repairsInMonth(db: Db, userId: string, day: string): Promise<number> {
  const month = day.slice(0, 7)
  return db.collection<StreakDay>(COLLECTIONS.streakDays).countDocuments({
    _id: { $gte: streakDayId(userId, `${month}-01`), $lte: streakDayId(userId, `${month}-31￿`) },
    source: 'purchase',
  })
}

/*
 * Moved to `@langx/shared` so the app can ask the same question the server
 * answers — the store row for a repair has to know which day is still
 * reachable, and a second copy of that rule in the client is how the two
 * would come to disagree. Re-exported here because this is where every
 * server-side caller already looks for it.
 */
export { isRepairable } from '@langx/shared'
