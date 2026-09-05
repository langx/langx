import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { readActivityWeek } from './dailyActivity'
import { getBadgeSummary } from './badges'
import { countCorrectionsWritten } from './corrections'
import { readAggregates } from './ledger'

/**
 * What a profile shows about how somebody uses the app: the streak, how many
 * corrections they have written, how many tokens they have earned, and the
 * week's shape.
 *
 * A deliberately smaller thing than `getTokenSummary`, which is the owner's
 * view: no wallet, no quota, no per-day counters, nothing about what was
 * bought. Corrections and tokens are a record of teaching people, which is
 * the point of the product and the reason this is on by default — but it is a
 * measurement of a person, so `privacy.statsVisible` turns it off, and when it
 * is off the fields are not sent at all rather than hidden by the client.
 */
export interface PublicSummary {
  visible: boolean
  streak?: { current: number; longest: number }
  corrections?: number
  /** Badges earned, out of the catalogue in `@langx/shared`. */
  badges?: number
  tokens?: number
  week?: { day: string; messages: number; corrections: number }[]
}

export async function getPublicSummary(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<PublicSummary> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) return { visible: false }
  // Absent means on: the flag is newer than the profiles that predate it.
  if (profile.privacy?.statsVisible === false) return { visible: false }

  const [tokens, week, corrections, badges] = await Promise.all([
    readAggregates(db, userId, at),
    readActivityWeek(db, userId, at),
    countCorrectionsWritten(db, userId),
    getBadgeSummary(db, userId, at),
  ])

  return {
    visible: true,
    streak: { current: profile.streak.current, longest: profile.streak.longest },
    corrections,
    // A count, not the list: which badges is the owner's own page, but how
    // many is the same kind of fact as the corrections beside it.
    badges: badges.earnedCount,
    // The all-time total, which is what the owner's own profile shows too —
    // not the balance, which moves when they spend and is nobody else's
    // business.
    tokens: tokens.all,
    week,
  }
}
