import { localDayKey, nextStreak, streakMilestoneBonus } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { awardXp } from './ledger'

export interface StreakResult {
  current: number
  longest: number
  lastQualifiedDay: string
  /** True only for the action that actually credited today. */
  advanced: boolean
  /** XP paid for crossing a milestone with this action; 0 otherwise. */
  milestoneXp: number
}

/**
 * The streak's day is the **user's local day**, deliberately unlike every
 * other bucket in the gamification system (see periods.ts). "Today" has to
 * feel like today or the mechanic loses its meaning; leaderboards, ledger rows
 * and XP caps stay on UTC so they remain globally comparable.
 *
 * An unset timezone falls back to UTC — `localDayKey` also swallows an
 * unparseable zone rather than throwing, because a bad string in a profile
 * must never be able to break streak accounting.
 */
export function streakDay(profile: Pick<Profile, 'timezone'>, at: Date): string {
  return localDayKey(at, profile.timezone ?? 'UTC')
}

/**
 * Credits today's streak for a qualifying action (a message or a correction —
 * opening the app is not one).
 *
 * Concurrency: the filter excludes a profile already credited for `today`, so
 * of N simultaneous first-messages-of-the-day exactly one update applies and
 * the rest come back `null`. MongoDB re-evaluates the predicate against the
 * fresh document when a write conflicts, which is the same guarantee
 * `consumeQuota` leans on — no transaction needed. `current` is computed from
 * the read copy, which is safe precisely because the only value another writer
 * could have installed is `today`, and that case is what the filter rejects.
 */
export async function recordQualifyingAction(
  db: Db,
  profile: Profile,
  at: Date,
): Promise<StreakResult> {
  const today = streakDay(profile, at)
  const held: StreakResult = {
    current: profile.streak.current,
    longest: profile.streak.longest,
    lastQualifiedDay: today,
    advanced: false,
    milestoneXp: 0,
  }
  if (profile.streak.lastQualifiedDay === today) return held

  const current = nextStreak(profile.streak.current, profile.streak.lastQualifiedDay, today)
  const longest = Math.max(profile.streak.longest, current)

  const updated = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    { _id: profile._id, 'streak.lastQualifiedDay': { $ne: today } },
    {
      $set: {
        'streak.current': current,
        'streak.longest': longest,
        'streak.lastQualifiedDay': today,
        updatedAt: at,
      },
    },
    { returnDocument: 'after' },
  )
  if (!updated) return held // another action for the same day won the race

  // `refId` is the day, so a milestone can only ever be paid once per user per
  // day even if the streak is manually replayed or recomputed.
  const bonus = streakMilestoneBonus(current)
  const award = await awardXp(db, {
    userId: profile._id,
    kind: 'streak',
    amount: bonus,
    refId: today,
    at,
  })

  return {
    current: updated.streak.current,
    longest: updated.streak.longest,
    lastQualifiedDay: today,
    advanced: true,
    milestoneXp: award.amount,
  }
}
