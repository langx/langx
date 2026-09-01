import {
  isConsecutiveDay,
  localDayKey,
  nextStreak,
  streakMilestoneBonus,
  shiftDayKey,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { awardTokens } from './ledger'
import { recordCheckInDay, recordStreakDay } from './streakDays'
import { consumeStreakFreeze } from './wallet'

export interface StreakResult {
  current: number
  longest: number
  lastQualifiedDay: string
  /** True only for the action that actually credited today. */
  advanced: boolean
  /**
   * token paid for crossing a milestone with this action; 0 otherwise.
   *
   * Always 0 for a check-in. Opening the app holds the streak; it does not buy
   * the bonus for holding it. See `recordCheckIn`.
   */
  milestoneXp: number
  /** True when a banked freeze was spent to bridge a single missed day. */
  freezeUsed: boolean
}

/**
 * The streak's day is the **user's local day**, deliberately unlike every
 * other bucket in the gamification system (see periods.ts). "Today" has to
 * feel like today or the mechanic loses its meaning; leaderboards, ledger rows
 * and token caps stay on UTC so they remain globally comparable.
 *
 * An unset timezone falls back to UTC — `localDayKey` also swallows an
 * unparseable zone rather than throwing, because a bad string in a profile
 * must never be able to break streak accounting.
 */
export function streakDay(profile: Pick<Profile, 'timezone'>, at: Date): string {
  return localDayKey(at, profile.timezone ?? 'UTC')
}

/**
 * Credits today's streak for a **meaningful action** — a message, a correction
 * or a recorded pronunciation answer.
 *
 * This is the only entry point that can pay a milestone. See `recordCheckIn`
 * for the other half of the rule.
 */
export async function recordQualifyingAction(
  db: Db,
  profile: Profile,
  at: Date,
): Promise<StreakResult> {
  return advance(db, profile, at, true)
}

/**
 * Credits today's streak for opening the app.
 *
 * The streak used to require a meaningful action every single day, and the
 * cost of that rule was not the people it motivated — it was the ones who had
 * a day with nothing to say and lost two hundred days for it. Showing up is a
 * habit worth keeping alive, and a streak that punishes a quiet day teaches
 * people to stop looking rather than to come back.
 *
 * **It holds the streak; it does not pay for holding it.** No milestone bonus,
 * ever. The milestone is what makes a long streak worth token, and 365 days of
 * opening an app is not worth five thousand of anything — that is a leaderboard
 * anybody could climb without ever teaching a stranger a word, which is the
 * behaviour the whole economy exists to reward. So the number on screen keeps
 * going up, and the token behind it is still earned. A milestone crossed by a
 * check-in is paid later the same day, by the first real action, or not at all.
 *
 * It **does** spend a banked freeze to bridge a missed day. That looks like a
 * silent purchase and is the opposite: a freeze exists to stop a gap ending a
 * streak, the gap is yesterday's and not today's, and refusing to spend it here
 * would mean a check-in quietly resetting a streak the user had already paid to
 * protect — with no later action able to undo it, because the day is claimed.
 */
export async function recordCheckIn(db: Db, profile: Profile, at: Date): Promise<StreakResult> {
  return advance(db, profile, at, false)
}

/**
 * Concurrency: the filter excludes a profile already credited for `today`, so
 * of N simultaneous first-actions-of-the-day exactly one update applies and
 * the rest come back `null`. MongoDB re-evaluates the predicate against the
 * fresh document when a write conflicts, which is the same guarantee
 * `consumeQuota` leans on — no transaction needed. `current` is computed from
 * the read copy, which is safe precisely because the only value another writer
 * could have installed is `today`, and that case is what the filter rejects.
 *
 * The milestone has a **second** claim of its own, on `lastActionDay`, because
 * the two facts came apart the day check-ins arrived: the streak can already be
 * credited for today while no real work has happened yet. One conditional write
 * each, rather than one write and a flag.
 */
async function advance(
  db: Db,
  profile: Profile,
  at: Date,
  qualifying: boolean,
): Promise<StreakResult> {
  const today = streakDay(profile, at)
  /**
   * Before the early return, deliberately. The square's *shading* is a count of
   * qualifying actions, so stopping here on the day's second message would
   * leave every day looking equally busy — and the set of filled days is what
   * a repair later has to recompute a streak length from.
   *
   * A check-in fills the square without shading it: it is not work, and the
   * count is a count of work.
   */
  if (qualifying) await recordStreakDay(db, profile._id, today, at)
  else await recordCheckInDay(db, profile._id, today, at)

  let current = profile.streak.current
  let longest = profile.streak.longest
  let advanced = false
  let freezeUsed = false

  if (profile.streak.lastQualifiedDay !== today) {
    // A freeze bridges *exactly one* missed day. Wider gaps are not for sale —
    // letting a stockpile paper over a week away would empty the streak of the
    // meaning that makes people come back.
    const last = profile.streak.lastQualifiedDay
    const missedExactlyOne = last !== null && isConsecutiveDay(shiftDayKey(last, 1), today)
    freezeUsed =
      missedExactlyOne && (profile.streakFreezes ?? 0) > 0
        ? await consumeStreakFreeze(db, profile._id)
        : false

    const next = freezeUsed
      ? profile.streak.current + 1
      : nextStreak(profile.streak.current, last, today)
    const nextLongest = Math.max(profile.streak.longest, next)

    const updated = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
      { _id: profile._id, 'streak.lastQualifiedDay': { $ne: today } },
      {
        $set: {
          'streak.current': next,
          'streak.longest': nextLongest,
          'streak.lastQualifiedDay': today,
          updatedAt: at,
        },
      },
      { returnDocument: 'after' },
    )
    if (updated) {
      current = updated.streak.current
      longest = updated.streak.longest
      advanced = true
    } else {
      // Another action for the same day won the race. If this call had already
      // spent a freeze, hand it back — it bridged nothing.
      if (freezeUsed) {
        await db
          .collection<Profile>(COLLECTIONS.profiles)
          .updateOne({ _id: profile._id }, { $inc: { streakFreezes: 1 } })
        freezeUsed = false
      }
    }
  }

  if (!qualifying) {
    return { current, longest, lastQualifiedDay: today, advanced, milestoneXp: 0, freezeUsed }
  }

  /*
   * The milestone, claimed separately.
   *
   * `lastActionDay` is absent on every profile written before check-ins
   * existed, and `$ne` matches a missing field — so the first real action of
   * the day claims it, exactly as it should. A milestone that was already paid
   * today under the old single-field rule is caught by the ledger anyway:
   * `refId` is the day, so it can only ever be paid once per user per day, even
   * if the streak is replayed or recomputed.
   */
  let milestoneXp = 0
  if (profile.streak.lastActionDay !== today) {
    const claimed = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOneAndUpdate(
        { _id: profile._id, 'streak.lastActionDay': { $ne: today } },
        { $set: { 'streak.lastActionDay': today, updatedAt: at } },
        { returnDocument: 'after' },
      )
    if (claimed) {
      // Read from the fresh document, not from `current`: a check-in earlier
      // today may have advanced the streak, and the bonus is owed for where
      // the streak *is*, not for what this call moved it by.
      const award = await awardTokens(db, {
        userId: profile._id,
        kind: 'streak',
        amount: streakMilestoneBonus(claimed.streak.current),
        refId: today,
        at,
      })
      milestoneXp = award.amount
      current = claimed.streak.current
      longest = claimed.streak.longest
    }
  }

  return { current, longest, lastQualifiedDay: today, advanced, milestoneXp, freezeUsed }
}
