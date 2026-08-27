import { utcDayKey, type XpSummary } from '@langx/shared'
import type { Db } from 'mongodb'
import { ERROR_CODES } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from '../profiles/profiles'
import { countersOf, readActivity, scoreOf } from './dailyActivity'
import { readAggregates } from './ledger'
import { streakDay } from './streak'

/**
 * `xpAggregates` is the only source of a total — `profiles` deliberately keeps
 * no XP counter of its own, because a denormalized copy of a number that is
 * incremented from four different code paths is a drift generator.
 */
export async function getXpSummary(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<XpSummary> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const [xp, activity] = await Promise.all([
    readAggregates(db, userId, at),
    readActivity(db, userId, at),
  ])
  const counters = countersOf(activity)

  return {
    streak: {
      current: profile.streak.current,
      longest: profile.streak.longest,
      lastQualifiedDay: profile.streak.lastQualifiedDay,
      qualifiedToday: profile.streak.lastQualifiedDay === streakDay(profile, at),
    },
    xp,
    today: {
      day: utcDayKey(at),
      messages: counters.messages,
      corrections: counters.corrections,
      mutualConversations: counters.mutualConversations,
      distinctPartners: counters.distinctPartners,
      activityScore: scoreOf(activity),
    },
  }
}
