import { ERROR_CODES, REFERRAL_LIST_LIMIT, TOKEN_RULES } from '@langx/shared'
import type { PaidPlanTier, ReferralInvitee, ReferralStatus } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

/**
 * One invitation, keyed by the person who accepted it.
 *
 * `_id` is the **invitee's** user id — not a field with a unique index on it —
 * because "a person has exactly one referrer, ever" is not an optimisation to
 * add later. It is the primary key: it needs no declaration in `indexes.ts`,
 * it cannot be dropped, and a second attach is an E11000 rather than a race
 * two readers both win. Same reasoning as `streakDays` (`<userId>:<day>`) and
 * `tokenAggregates`.
 */
export interface Referral {
  _id: string
  referrerId: string
  /**
   * The handle as it resolved at attach time, kept beside the id it points at.
   * Handles cannot be renamed today, so this is redundant today — and it is
   * what makes the row readable in a shell six months from now without a
   * second lookup, which is what an audit row is for.
   */
  referrerHandle: string
  /** Where the code came from: a marked invite URL, or typed in at onboarding. */
  source: 'link' | 'manual'
  createdAt: Date

  /**
   * When the invitee became a real user — see `settleReferral`. Set even when
   * the award paid nothing, which is why the amount is stored beside it rather
   * than implied by the timestamp: `awardTokens` writes no row for a zero
   * amount, so the ledger cannot represent a withheld payment on its own.
   */
  activatedAt?: Date
  activationAward?: number

  subscribedAt?: Date
  subscriptionAward?: number
  subscriptionTier?: PaidPlanTier
}

function referrals(db: Db) {
  return db.collection<Referral>(COLLECTIONS.referrals)
}

/**
 * Records who invited a new account, during onboarding, once.
 *
 * **Every failure is silent.** An unknown handle, a deleted referrer, naming
 * yourself, or a second attempt all write nothing and throw nothing — the
 * caller is `createProfile`, and the account is real and the profile is
 * written either way. Losing an attribution is recoverable; losing a sign-up
 * over a mistyped username is not, and it punishes the wrong person for the
 * wrong mistake.
 *
 * The two writes are ordered, and the order is the opposite of the obvious
 * one: **the `referrals` row first, then the pointer on the profile.** A
 * pointer with no row makes `settleReferral` do one wasted lookup per message.
 * A row with no pointer makes it do *none*, because `awardForSend` gates on
 * the pointer — and the award would never fire at all.
 */
export async function attachReferral(
  db: Db,
  inviteeId: string,
  handle: string,
  source: Referral['source'],
): Promise<Referral | null> {
  const bare = handle.startsWith('@') ? handle.slice(1) : handle
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const referrer = await profiles.findOne(
    { handle: bare.toLowerCase(), deletedAt: { $exists: false } },
    { projection: { handle: 1 } },
  )
  if (!referrer) return null
  // Cannot happen at onboarding — the invitee has no handle yet — but the
  // module is callable elsewhere and the rule deserves to be written down.
  if (referrer._id === inviteeId) return null

  const row: Referral = {
    _id: inviteeId,
    referrerId: referrer._id,
    referrerHandle: referrer.handle,
    source,
    createdAt: new Date(),
  }
  try {
    await referrals(db).insertOne(row)
  } catch {
    // Already attributed. First writer wins: the referrer whose link actually
    // caused the sign-up is the one who was used.
    return null
  }
  await profiles.updateOne({ _id: inviteeId }, { $set: { referredBy: referrer._id } })
  return row
}

/**
 * Marks that an invitee has started paying, then settles whatever is now due.
 *
 * Under a filter rather than a read, so a webhook redelivered beside the
 * client's own `POST /billing/refresh` cannot stamp it twice. Settling is left
 * to `settleReferral`, which will pay nothing at all if the activation has not
 * happened yet — the row simply carries `subscribedAt` until the invitee sends
 * their first real message, and then both awards land in one call.
 */
export async function markInviteeSubscribed(
  db: Db,
  inviteeId: string,
  tier: PaidPlanTier,
  at: Date,
): Promise<void> {
  await referrals(db).updateOne(
    { _id: inviteeId, subscribedAt: { $exists: false } },
    { $set: { subscribedAt: at, subscriptionTier: tier } },
  )
}

export async function readReferral(db: Db, inviteeId: string): Promise<Referral | null> {
  return referrals(db).findOne({ _id: inviteeId })
}

function statusOf(row: Referral): ReferralInvitee['status'] {
  if (row.subscriptionAward !== undefined) return 'subscribed'
  if (row.activatedAt) return 'activated'
  return 'pending'
}

/**
 * What the invite screen draws.
 *
 * The totals are counted over the whole group and the list is capped, so the
 * headline stays right for somebody past `REFERRAL_LIST_LIMIT` invitees while
 * the detail below it does not have to be paged.
 *
 * Nothing here carries an email, an activity detail or a ledger row: an
 * invitee is somebody who agreed to join, not somebody who agreed to be
 * reported on.
 */
export async function readReferralStatus(db: Db, userId: string): Promise<ReferralStatus> {
  const rows = await referrals(db)
    .find({ referrerId: userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(REFERRAL_LIST_LIMIT)
    .toArray()

  const [totals] = await referrals(db)
    .aggregate<{ invited: number; activated: number; subscribed: number; tokensEarned: number }>([
      { $match: { referrerId: userId } },
      {
        $group: {
          _id: null,
          invited: { $sum: 1 },
          activated: { $sum: { $cond: [{ $ifNull: ['$activatedAt', false] }, 1, 0] } },
          subscribed: { $sum: { $cond: [{ $ifNull: ['$subscribedAt', false] }, 1, 0] } },
          tokensEarned: {
            $sum: {
              $add: [{ $ifNull: ['$activationAward', 0] }, { $ifNull: ['$subscriptionAward', 0] }],
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ])
    .toArray()

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const invitees = rows.length
    ? await profiles
        .find(
          { _id: { $in: rows.map((row) => row._id) } },
          { projection: { handle: 1, displayName: 1, avatarUrl: 1 } },
        )
        .toArray()
    : []
  const byId = new Map(invitees.map((profile) => [profile._id, profile]))

  const mine = await referrals(db).findOne({ _id: userId })
  const referrer = mine
    ? await profiles.findOne(
        { _id: mine.referrerId },
        { projection: { handle: 1, displayName: 1 } },
      )
    : null

  return {
    totals: totals ?? { invited: 0, activated: 0, subscribed: 0, tokensEarned: 0 },
    invitees: rows.flatMap((row) => {
      const profile = byId.get(row._id)
      // A purged invitee leaves the row behind — it is what the ledger's refId
      // points at — but there is nothing left to draw, and a blank name in a
      // list of people reads as a bug rather than as an absence.
      if (!profile) return []
      return [
        {
          handle: profile.handle,
          displayName: profile.displayName,
          ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
          status: statusOf(row),
          invitedAt: row.createdAt.toISOString(),
          earned: (row.activationAward ?? 0) + (row.subscriptionAward ?? 0),
        },
      ]
    }),
    referredBy:
      mine && referrer ? { handle: referrer.handle, displayName: referrer.displayName } : null,
  }
}

/** Re-exported so callers do not have to reach into `@langx/shared` for the
 *  one number they are about to compare against. */
export const REFERRAL_RULES = TOKEN_RULES.referral
export { ERROR_CODES }
