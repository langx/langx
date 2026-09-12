import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "How many users are there" does not have one answer, and the number that
 * looks like the answer is the wrong one.
 *
 * `user` holds three populations at once: people who signed up, guests the
 * anonymous plugin created for anyone who opened the app without an account,
 * and the v1 addresses `legacyPrecreate` wrote ahead of their owners coming
 * back. Counting the collection reports a migration table as growth, so each
 * population is counted apart from the others.
 *
 * `onboarded` is the one to quote: a profile exists only once somebody picked
 * their languages, so it counts people who arrived rather than rows.
 */
export interface UserStats {
  /** Every `user` document, guests and precreated v1 addresses included. */
  total: number
  /** Anonymous sessions. They expire — see `purgeStaleGuests`. */
  guests: number
  /**
   * Accounts whose origin is the v1 import. Claimed or not: the flag records
   * where the row came from and is never cleared, so this is not a backlog.
   */
  fromV1: number
  /** Real profiles: onboarded, not a guest, not deleted. */
  onboarded: number
  newLast24h: number
  newLast7d: number
  /** Null on an empty database, which is the only time there is no last one. */
  lastSignUpAt: string | null
}

export async function getUserStats(db: Db, now: Date = new Date()): Promise<UserStats> {
  const users = db.collection<{ createdAt: Date }>(COLLECTIONS.user)
  const since = (ms: number) => ({ createdAt: { $gte: new Date(now.getTime() - ms) } })

  const [total, guests, fromV1, onboarded, newLast24h, newLast7d, latest] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ isAnonymous: true }),
    users.countDocuments({ precreatedFromV1: { $exists: true } }),
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .countDocuments({ guest: { $ne: true }, deletedAt: { $exists: false } }),
    users.countDocuments(since(DAY_MS)),
    users.countDocuments(since(7 * DAY_MS)),
    users.findOne({}, { projection: { createdAt: 1 }, sort: { createdAt: -1 } }),
  ])

  return {
    total,
    guests,
    fromV1,
    onboarded,
    newLast24h,
    newLast7d,
    lastSignUpAt: latest?.createdAt.toISOString() ?? null,
  }
}
