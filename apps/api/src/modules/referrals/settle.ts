import { TOKEN_RULES, isPaidTier } from '@langx/shared'
import type { PaidPlanTier, PlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { isEmailVerified } from '../profiles/emailVerified'
import type { Profile } from '../profiles/profiles'
import { awardTokens, type TokenLedgerEntry } from '../tokens/ledger'
import { markInviteeSubscribed, readReferral, type Referral } from './referrals'

/**
 * The kinds that count as the invitee having *earned* something, as opposed to
 * having been given something.
 *
 * A signup bonus is not proof of a person. These are: each one is somebody
 * writing to somebody else, and each one is the thing this app exists for.
 */
const EARNING_KINDS = ['message', 'correction', 'pronunciation'] as const

/**
 * Pays a referrer whatever they are now owed for one invitee, and nothing they
 * are not.
 *
 * Called from every path that could have changed the answer — the invitee's
 * award sites, and the billing funnel — rather than computed on a schedule. A
 * nightly sweep would need a partial index over rows that never expire, and it
 * would land the reward hours after anything the referrer did, which for a
 * referral programme is most of the value gone.
 *
 * Idempotent by construction, twice over: `awardTokens` refuses a second row
 * for the same `{userId, kind, refId}`, and the latches below are written only
 * after the award they describe. Calling this on every message is safe and is
 * exactly what happens.
 *
 * **Award first, latch second.** A crash between the two under-records the
 * audit row and self-heals on the next call, because `awardTokens` answers
 * `duplicate` and the latch is rewritten. The reverse order marks a referral
 * paid that never was, which nothing can recover.
 */
export async function settleReferral(db: Db, inviteeId: string, at: Date): Promise<void> {
  const referral = await readReferral(db, inviteeId)
  if (!referral) return

  const activationDone = referral.activatedAt !== undefined
  const subscriptionDone = referral.subscriptionAward !== undefined
  if (activationDone && subscriptionDone) return
  // Nothing is payable until the invitee is activated — including the
  // subscription top-up. That ordering is the whole guard on the one path
  // where real money touches this economy.
  if (!activationDone && !(await isActivated(db, inviteeId))) return

  const referrer = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: referral.referrerId }, { projection: { tokenFrozenAt: 1, deletedAt: 1 } })
  // A deleted referrer ends the referral for both sides: the invitee's welcome
  // is "somebody brought you here", and that somebody is gone.
  if (!referrer || referrer.deletedAt) return
  /*
   * A referrer under review earns nothing, exactly as they earn nothing from
   * their own messages. The latch is still written, so the award is lost
   * rather than deferred — consistent with `awards.ts`, where a frozen user's
   * activity counters move while the payout does not, and the instrument for
   * putting it back afterwards is an `adjustment` row.
   */
  const frozen = Boolean(referrer.tokenFrozenAt)

  if (!activationDone) {
    const award = await awardTokens(db, {
      userId: referral.referrerId,
      kind: 'referral',
      amount: frozen ? 0 : TOKEN_RULES.referral.activation,
      refId: inviteeId,
      at,
    })
    /*
     * The invitee's welcome, in the same breath — what takes them from the
     * sign-up bonus to `inviteeTotal`. Not withheld when the *referrer* is
     * frozen: the activation was the invitee's own doing, and their standing
     * is judged by `awardTokens` on their own row. Same `refId` (themselves),
     * so the ledger's unique index caps it at once.
     */
    const welcome = await awardTokens(db, {
      userId: inviteeId,
      kind: 'referralWelcome',
      amount: TOKEN_RULES.referral.inviteeActivation,
      refId: inviteeId,
      at,
    })
    await latch(db, inviteeId, {
      activatedAt: at,
      activationAward: award.amount,
      inviteeAward: welcome.amount,
    })
  }

  if (referral.subscribedAt && !subscriptionDone) {
    const award = await awardTokens(db, {
      userId: referral.referrerId,
      kind: 'referralSubscription',
      amount: frozen ? 0 : TOKEN_RULES.referral.subscription,
      refId: inviteeId,
      at,
    })
    await latch(db, inviteeId, { subscriptionAward: award.amount })
  }
}

function latch(db: Db, inviteeId: string, fields: Partial<Referral>): Promise<unknown> {
  return db
    .collection<Referral>(COLLECTIONS.referrals)
    .updateOne({ _id: inviteeId }, { $set: fields })
}

/**
 * Whether the invitee is a real, active person rather than an account.
 *
 * Three conditions, and the first two are nearly implied by the third —
 * `POST /profiles` sits behind `requireVerifiedEmail`, so having a profile
 * already means a verified email and a finished onboarding. They are still
 * checked, because they cost one indexed read on a path that runs about once
 * per referred user, and because the rule stays true if some future route
 * creates a profile differently.
 *
 * The third is the one that does the work: at least one ledger row from
 * writing to somebody. Farming this costs a real conversation with a real
 * person per fake account, which is the price this whole economy is built to
 * charge.
 */
async function isActivated(db: Db, inviteeId: string): Promise<boolean> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: inviteeId }, { projection: { deletedAt: 1, guest: 1 } })
  if (!profile || profile.deletedAt || profile.guest) return false
  if (!(await isEmailVerified(db, inviteeId))) return false

  const earned = await db
    .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
    .countDocuments({ userId: inviteeId, kind: { $in: [...EARNING_KINDS] } }, { limit: 1 })
  return earned > 0
}

/**
 * The billing half: this person now pays, so their referrer may be owed the
 * top-up.
 *
 * Two steps rather than one because they answer different questions.
 * `markInviteeSubscribed` records the fact under a filter, so a webhook and
 * the client's refresh racing each other cannot stamp it twice.
 * `settleReferral` then pays whatever is due — which is **nothing** if the
 * invitee has not been activated yet. In that case the row simply carries
 * `subscribedAt` until their first real message, and both awards land in one
 * call. That ordering is what stops a stolen card on a throwaway account being
 * worth four thousand tokens for no human effort.
 */
export async function creditReferrerForSubscription(
  db: Db,
  inviteeId: string,
  tier: PlanTier,
  at: Date,
): Promise<void> {
  if (!isPaidTier(tier)) return
  await markInviteeSubscribed(db, inviteeId, tier as PaidPlanTier, at)
  await settleReferral(db, inviteeId, at)
}
