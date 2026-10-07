import { PRO_GIFT_RULES, referralGiftSlots, streakGiftsOwed } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { Referral } from '../referrals/referrals'
import { proGiftKey, queueProGift } from './proGifts'

/**
 * The two gifts of Pro that are earned rather than given: a streak crossing a
 * milestone, and invitees becoming real users.
 *
 * Both only **write the row**. RevenueCat is asked by `runProGiftPass`, never
 * from here — these run inside a message send, and a send must not wait on a
 * billing API or fail because one is down.
 */

/**
 * Queues every streak milestone this streak has reached and not yet been
 * given, and marks each one on the profile.
 *
 * Called from the streak's daily milestone claim, so at most once a day per
 * person. The row's key (`streak:<days>:<user>`) is what makes it once in a
 * lifetime; the marker only saves the daily attempt a write once both rungs
 * are paid. Row first, marker second: a crash between them re-queues a key
 * that already exists, which is nothing.
 */
export async function queueStreakGifts(
  db: Db,
  profile: Pick<Profile, '_id' | 'streak' | 'proGiftStreaks'>,
  at: Date,
): Promise<number> {
  const owed = streakGiftsOwed(profile.streak.current, profile.proGiftStreaks ?? [])
  for (const rung of owed) {
    await queueProGift(
      db,
      {
        _id: proGiftKey.streak(rung.days, profile._id),
        userId: profile._id,
        months: rung.months,
        source: 'streak',
      },
      at,
    )
    await db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: profile._id }, { $addToSet: { proGiftStreaks: rung.days } })
  }
  return owed.length
}

/**
 * Queues the referral gifts a referrer has earned this calendar year.
 *
 * Counts the year's activations **including the invitee being settled now**
 * — `settleReferral` calls this before it writes `activatedAt` ("reward
 * before lock"), so a crash between the two leaves the latch unwritten and
 * the next settle queues again, onto a key that already exists. It calls
 * this once more after the latch, because two invitees activating in the
 * same moment would each count the other as not yet activated, and the third
 * activation of a slot would otherwise be earned by nobody.
 *
 * Every slot up to the one reached, not only the newest: a slot missed for any
 * reason is filled on the next activation. The keys make that free.
 */
export async function queueReferralGifts(
  db: Db,
  referrerId: string,
  inviteeId: string,
  at: Date,
): Promise<number> {
  const year = at.getUTCFullYear()
  const activations = await db.collection<Referral>(COLLECTIONS.referrals).countDocuments({
    referrerId,
    $or: [
      {
        activatedAt: {
          $gte: new Date(Date.UTC(year, 0, 1)),
          $lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
        // An activation the referrer was not paid for — past the monthly
        // limit, or a shared network or device — is not progress either.
        unpaidReason: { $exists: false },
      },
      { _id: inviteeId, activatedAt: { $exists: false } },
    ],
  })
  const slots = referralGiftSlots(activations)
  for (let slot = 1; slot <= slots; slot++) {
    await queueProGift(
      db,
      {
        _id: proGiftKey.referral(referrerId, year, slot),
        userId: referrerId,
        months: PRO_GIFT_RULES.referral.monthsPerGift,
        source: 'referral',
      },
      at,
    )
  }
  return slots
}
