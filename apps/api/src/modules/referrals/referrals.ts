import {
  ERROR_CODES,
  REFERRAL_LIST_LIMIT,
  TOKEN_RULES,
  handleSchema,
  referralSourceSchema,
} from '@langx/shared'
import type {
  PaidPlanTier,
  ReferralInvitee,
  StoredPaidPlanTier,
  ReferralSource,
  ReferralStatus,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
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
   * A snapshot on purpose: a handle may change (`changeHandle`), and what
   * this row is for is reading in a shell six months
   * from now — which link was actually used — not naming the referrer today.
   * Everything shown to a person re-reads the live profile; see `readReferralStatus`.
   */
  referrerHandle: string
  /** Where the code came from: a marked invite URL, or typed in at onboarding. */
  source: ReferralSource
  createdAt: Date

  /**
   * When the invitee became a real user — see `settleReferral`. Set even when
   * the award paid nothing, which is why the amount is stored beside it rather
   * than implied by the timestamp: `awardTokens` writes no row for a zero
   * amount, so the ledger cannot represent a withheld payment on its own.
   */
  activatedAt?: Date
  activationAward?: number
  /** What the invitee was paid at the same moment; 0 when withheld. */
  inviteeAward?: number
  /**
   * Why the activation paid less than the rules say, written with
   * `activatedAt` — for an operator reading the row, and for the later
   * subscription settle, which follows the same decision. Absent when the
   * referral paid normally (a frozen referrer's zero is not recorded here; the
   * profile's `tokenFrozenAt` already says that).
   *
   * - `monthlyLimit` — the referrer was past `maxActivationsPerMonth`. The
   *   invitee's welcome was paid; the referrer's award was not, and the
   *   activation does not count towards their referral gifts of Pro.
   * - `sharedNetwork` / `sharedDevice` — the two accounts share a sign-in
   *   address or an installation. Neither side is paid, top-up included.
   */
  unpaidReason?: ReferralUnpaidReason
  /**
   * Which gift of Pro this activation earns, decided once, when it is first
   * settled while `flags.giveAWeek` is on, and kept like `unpaidReason`.
   * Absent is the month for every three (`PRO_GIFT_RULES.referral`); `week`
   * is "give a week, get a week". Written before the gifts it decides, so a
   * settle that crashes and runs again after the flag has moved still follows
   * the rule it started under, and `queueReferralGifts` leaves a `week`
   * activation out of its count of three.
   */
  proReward?: 'week'

  subscribedAt?: Date
  subscriptionAward?: number
  /** May still be the retired `pro_plus` on rows from before the merge. */
  subscriptionTier?: StoredPaidPlanTier
}

export type ReferralUnpaidReason = 'monthlyLimit' | 'sharedNetwork' | 'sharedDevice'

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
  const bare = (handle.startsWith('@') ? handle.slice(1) : handle).toLowerCase()
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const referrer = await profiles.findOne(
    {
      // The old name resolves here too, for the same reason it resolves on the
      // profile route: an invite link is the longest-lived thing a handle ends
      // up inside — a QR on a sticker, a bio, a screenshot — and the accounts
      // that may rename are precisely the ones whose links are years old. The
      // failure would be silent (every failure here is), so the attribution
      // would just quietly stop arriving.
      $or: [{ handle: bare }, { previousHandle: bare }],
      deletedAt: { $exists: false },
    },
    { projection: { handle: 1 } },
  )
  if (!referrer) return null
  // Reachable at onboarding: the profile is written before this runs, so a
  // handle the invitee has just taken — typed into the form, or carried from
  // sign-up by `rememberSignUpReferrer` while it was still free — resolves to
  // them.
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
 * The invite an account was created with, kept on the Better Auth `user`
 * document until onboarding can use it.
 *
 * The device flag `pendingReferrer` is the primary carrier, and it is lost
 * whenever onboarding runs in a different browser from the one that opened the
 * invite: the verification link opened in a phone mail app's own browser, or
 * an invite opened inside Instagram and the sign-up finished in Safari. The
 * account is the one thing both browsers share, so the sign-up body carries
 * the handle and it is written here.
 *
 * On `user` rather than a collection of ours, beside `terms` and for the same
 * reasons: it is captured before any profile exists, and it goes when the
 * account goes without the purge having to know about it. A field, never an
 * index — nothing queries by it.
 *
 * Nothing is resolved or attributed here. This is only a note; the attribution
 * still happens once, in `createProfile`, through `attachReferral`, so a
 * stored handle meets exactly the checks a typed one does.
 */
export interface SignUpReferrer {
  handle: string
  source: ReferralSource
  at: Date
}

/**
 * Writes the sign-up's invite onto the new account, if the body carried one
 * that parses. Silent otherwise, for the reason every referral failure is: the
 * sign-up must never fail over an invite code.
 */
export async function rememberSignUpReferrer(db: Db, userId: string, body: unknown): Promise<void> {
  if (typeof body !== 'object' || body === null) return
  const fields = body as { referredByHandle?: unknown; referredBySource?: unknown }
  const handle = handleSchema.safeParse(fields.referredByHandle)
  if (!handle.success) return
  const source = referralSourceSchema.safeParse(fields.referredBySource)
  const signUpReferrer: SignUpReferrer = {
    handle: handle.data,
    // Defaulted the way `onboardingProfileSchema` defaults it: "typed by hand"
    // is the claim that asserts less.
    source: source.success ? source.data : 'manual',
    at: new Date(),
  }
  await db
    .collection(COLLECTIONS.user)
    .updateOne({ _id: authId(userId) }, { $set: { signUpReferrer } })
}

export async function readSignUpReferrer(
  db: Db,
  userId: string,
): Promise<Pick<SignUpReferrer, 'handle' | 'source'> | null> {
  const row = await db
    .collection<{ signUpReferrer?: SignUpReferrer }>(COLLECTIONS.user)
    .findOne({ _id: authId(userId) }, { projection: { signUpReferrer: 1 } })
  const stored = row?.signUpReferrer
  return stored ? { handle: stored.handle, source: stored.source } : null
}

/**
 * Marks that an invitee has started paying, then settles whatever is now due.
 *
 * Under a filter rather than a read, so a webhook redelivered beside the
 * client's own `POST /billing/refresh` cannot stamp it twice. Settling is left
 * to `settleReferral`, which will pay nothing at all if the activation has not
 * happened yet — the row simply carries `subscribedAt` until the invitee is
 * activated, and then both awards land in one call.
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
          // Same reason as everywhere else an avatar is drawn: without the id
          // this row falls back to initials while the same person has a face
          // on every other screen.
          _id: profile._id,
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
