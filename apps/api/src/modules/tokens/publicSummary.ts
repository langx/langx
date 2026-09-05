import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { readActivityWeek } from './dailyActivity'
import { getBadgeSummary } from './badges'
import { countCorrectionsWritten } from './corrections'
import { readAggregates } from './ledger'

/**
 * What a profile shows about how somebody uses the app: the streak, how many
 * corrections they have written, how many badges they hold, how many tokens
 * they have earned — and, if they allow it, the week's shape.
 *
 * A deliberately smaller thing than `getTokenSummary`, which is the owner's
 * view: no wallet, no quota, no per-day counters, nothing about what was
 * bought.
 *
 * The four numbers are always sent. They are a record of teaching people,
 * which is the point of the product, and they sit at the top of a profile the
 * way a follower count does — there used to be a "show my numbers" switch,
 * and it went because a profile with the counts missing read as a profile
 * with something to hide. The chart is different: not how much somebody has
 * done but which days they were around this week, which is a detail a person
 * may reasonably keep to themselves. `privacy.weekChartVisible` turns it off,
 * and when it is off `week` is not sent at all rather than hidden by the
 * client.
 */
export interface PublicSummary {
  streak: { current: number; longest: number }
  corrections: number
  /** Badges earned, out of the catalogue in `@langx/shared`. */
  badges: number
  tokens: number
  week?: { day: string; messages: number; corrections: number }[]
}

/** `null` when there is no such profile; the route has already checked. */
export async function getPublicSummary(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<PublicSummary | null> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) return null
  // Absent means on: the flag is newer than the profiles that predate it.
  const chart = profile.privacy?.weekChartVisible !== false

  // The week is read only when it will be sent: it is its own query, and a
  // switched-off chart should not cost the page a lookup that is thrown away.
  const [tokens, corrections, badges, week] = await Promise.all([
    readAggregates(db, userId, at),
    countCorrectionsWritten(db, userId),
    getBadgeSummary(db, userId, at),
    chart ? readActivityWeek(db, userId, at) : undefined,
  ])

  return {
    streak: { current: profile.streak.current, longest: profile.streak.longest },
    corrections,
    // A count, not the list: which badges is the owner's own page, but how
    // many is the same kind of fact as the corrections beside it.
    badges: badges.earnedCount,
    // The all-time total, which is what the owner's own profile shows too —
    // not the balance, which moves when they spend and is nobody else's
    // business.
    tokens: tokens.all,
    ...(week ? { week } : {}),
  }
}
