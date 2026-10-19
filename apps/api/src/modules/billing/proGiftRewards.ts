import {
  PRO_GIFT_RULES,
  referralGiftSlots,
  referralWeekSlotsPerYear,
  streakGiftsOwed,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { Referral } from '../referrals/referrals'
import { isDuplicateOf, proGiftKey, queueProGift, type ProGift } from './proGifts'

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
 * lifetime; the marker only saves the daily attempt a write once every rung
 * is paid. Row first, marker second: a crash between them re-queues a key
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
        ...(rung.weeks ? { weeks: rung.weeks } : {}),
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
        // Nor one that earned a week instead (`giveAWeek`): it has had its
        // gift, and counting it here as well would pay it twice the day the
        // switch goes back off.
        proReward: { $ne: 'week' },
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

/**
 * "Give a week, get a week": the referrer's week for one invitee's
 * activation, if this year still has room for it.
 *
 * The year's weeks are numbered slots — `referralWeek:<referrer>:<year>:<n>`
 * for n up to `referralWeekSlotsPerYear()` — so the cap is the key space and
 * two activations settling at the same moment cannot both take the last
 * week: one wins the slot's `_id`, the other moves to the next slot or finds
 * none. The slot does not say which activation took it; the row's `invitee`
 * does, and `user_invitee_unique` refuses a second week for the same one,
 * which is what makes a settle that runs twice — before or after its latch —
 * the same week rather than the next slot.
 *
 * `capped` when the year is full. The cap is the referrer's alone: their
 * friend's week (`queueInvitedWeek`) is given either way.
 */
export async function queueReferralWeek(
  db: Db,
  referrerId: string,
  inviteeId: string,
  at: Date,
): Promise<'queued' | 'already' | 'capped'> {
  const gifts = db.collection<ProGift>(COLLECTIONS.proGifts)
  // The settle that already did this, read straight back. The index below is
  // what guarantees it; this only saves a walk through the slots.
  if (await gifts.findOne({ userId: referrerId, invitee: inviteeId }, { projection: { _id: 1 } })) {
    return 'already'
  }

  const year = at.getUTCFullYear()
  const slots = referralWeekSlotsPerYear()
  // A range on `_id` rather than a regex: the slots of one person's year
  // share a prefix, and the primary key answers the count by itself.
  const prefix = proGiftKey.referralWeek(referrerId, year, 0).slice(0, -1)
  const taken = await gifts.countDocuments({ _id: { $gt: prefix, $lt: `${prefix}\uffff` } })

  for (let slot = taken + 1; slot <= slots; slot++) {
    try {
      const { gift } = await queueProGift(
        db,
        {
          _id: proGiftKey.referralWeek(referrerId, year, slot),
          userId: referrerId,
          months: 0,
          weeks: PRO_GIFT_RULES.giveAWeek.referrerWeeks,
          source: 'referral',
          invitee: inviteeId,
        },
        at,
      )
      // Ours, or another activation's that got to this slot first.
      if (gift.invitee === inviteeId) return 'queued'
    } catch (error) {
      if (isDuplicateOf(error, 'invitee')) return 'already'
      throw error
    }
  }
  return 'capped'
}

/**
 * The invitee's own week, once in their life — the other half of "give a
 * week, get a week", granted at the same activation moment as the referrer's.
 */
export async function queueInvitedWeek(db: Db, inviteeId: string, at: Date): Promise<void> {
  try {
    await queueProGift(
      db,
      {
        _id: proGiftKey.invitedWeek(inviteeId),
        userId: inviteeId,
        months: 0,
        weeks: PRO_GIFT_RULES.giveAWeek.inviteeWeeks,
        source: 'referral',
        invitee: inviteeId,
      },
      at,
    )
  } catch (error) {
    // Only reachable if a row for this activation exists under another key,
    // which no code writes; it is still the same week, not a new one.
    if (!isDuplicateOf(error, 'invitee')) throw error
  }
}
