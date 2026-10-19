import { PRO_GIFT_RULES, utcDayKey, type TokenSummary } from '@langx/shared'
import type { Db } from 'mongodb'
import { ERROR_CODES } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { holdsLifetime } from '../billing/proGifts'
import type { Profile } from '../profiles/profiles'
import {
  countActiveToday,
  countersOf,
  readActivity,
  readActivityWeek,
  scoreOf,
} from './dailyActivity'
import { countCorrectionsWritten } from './corrections'
import { countPostsByAuthor } from '../feed/feed'
import { readAggregates } from './ledger'
import { readLastPoolPayout } from './pool'
import { walletOf } from './wallet'
import { streakDay } from './streak'

/**
 * `tokenAggregates` is the only source of a total — `profiles` deliberately keeps
 * no token counter of its own, because a denormalized copy of a number that is
 * incremented from four different code paths is a drift generator.
 */
export async function getTokenSummary(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<TokenSummary> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const [tokens, activity, week, corrections, posts, activeToday, lastPayout] = await Promise.all([
    readAggregates(db, userId, at),
    readActivity(db, userId, at),
    // The subject's zone, not the reader's: the chart is a statement about
    // their week, so its day letters have to match the days they lived.
    readActivityWeek(db, userId, at, profile.timezone ?? 'UTC'),
    countCorrectionsWritten(db, userId),
    countPostsByAuthor(db, userId),
    countActiveToday(db, at),
    readLastPoolPayout(db, userId),
  ])
  const counters = countersOf(activity)

  return {
    streak: {
      current: profile.streak.current,
      longest: profile.streak.longest,
      lastQualifiedDay: profile.streak.lastQualifiedDay,
      qualifiedToday: profile.streak.lastQualifiedDay === streakDay(profile, at),
      proGiftRungs: proGiftRungsOwed(profile),
    },
    tokens,
    wallet: walletOf(profile, tokens.all),
    today: {
      day: utcDayKey(at),
      messages: counters.messages,
      corrections: counters.corrections,
      mutualConversations: counters.mutualConversations,
      distinctPartners: counters.distinctPartners,
      activityScore: scoreOf(activity),
    },
    pool: { activeToday, lastPayout },
    lifetime: { corrections, posts },
    week,
  }
}

/**
 * The streak milestones whose gift of Pro this profile would still be given,
 * read the way `queueStreakGifts` and `grantProGift` decide it: a rung already
 * on `proGiftStreaks` has had its gift, and a lifetime plan's gifts are
 * skipped, so it is owed none. Whatever the streak is now — the ladder shows
 * the rungs ahead of it as well as the one it is on.
 */
function proGiftRungsOwed(profile: Pick<Profile, 'entitlement' | 'proGiftStreaks'>): number[] {
  if (holdsLifetime(profile.entitlement)) return []
  const given = profile.proGiftStreaks ?? []
  return PRO_GIFT_RULES.streak.filter((rung) => !given.includes(rung.days)).map((rung) => rung.days)
}
