import { TOKEN_RULES, effectivePlanTier } from '@langx/shared'
import type { BillingPeriodType, StoredPlanTier } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import type { Conversation } from '../chat/conversations'
import { isEmailVerified } from '../profiles/emailVerified'
import type { Profile } from '../profiles/profiles'
import type { Device } from '../push/devices'
import { queueReferralGifts } from '../billing/proGiftRewards'
import {
  MUTUAL_REF_PREFIX,
  awardTokens,
  type AwardTokensInput,
  type TokenLedgerEntry,
} from '../tokens/ledger'
import { markInviteeSubscribed, readReferral, type Referral } from './referrals'

/**
 * Awards, and answers what the ledger now holds for that award — which is not
 * always what this call wrote.
 *
 * `awardTokens` answers a duplicate with `amount: 0`. That is the right answer
 * to "what did this call pay", and every other caller wants exactly it: the
 * number they hand back is what *this* message or session just earned. The
 * latches below are the one place it is the wrong answer, because they are not
 * a report on a call — they are the audit record of what the referral has paid
 * in total, read back by the invite screen as `earned`.
 *
 * And settling re-runs over an already-paid referral by ordinary means, not
 * exotic ones. `settleReferral` awards first and latches second on purpose, so
 * a crash between the two costs the audit row rather than marking a referral
 * paid that never was; and it runs on every message, so two of the invitee's
 * messages landing together both read `activatedAt` as absent before either
 * writes it. Either way the second pass found the award already on the ledger
 * and recorded that a referral worth 1,750 had paid nothing.
 *
 * Which is why this reads the row rather than reusing the amount the caller
 * asked for: the earlier award is the one that happened, and it may have been
 * made under a different freeze state or a different `TOKEN_RULES`.
 */
async function awardAndTotal(
  // `refId` required rather than optional: it is what the ledger's uniqueness
  // is keyed on, so without one there is no duplicate to answer and nothing
  // for this function to find. Every referral award has one.
  db: Db,
  input: AwardTokensInput & { refId: string },
): Promise<number> {
  const result = await awardTokens(db, input)
  if (result.awarded) return result.amount
  // Withheld, so there is no row to find and none should be looked for.
  if (result.reason === 'zero') return 0

  const row = await db
    .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
    .findOne(
      { userId: input.userId, kind: input.kind, refId: input.refId },
      { projection: { amount: 1 } },
    )
  return row?.amount ?? 0
}

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
 * **Award first, latch second.** A crash between the two costs the audit row
 * and is healed by the next call, which finds the award already on the ledger
 * and rewrites the latch from it — see `awardAndTotal`, which is what makes
 * that true rather than merely intended. The reverse order marks a referral
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
  if (!activationDone && !(await isActivated(db, inviteeId, referral.referrerId))) return

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

  /*
   * Why this referral pays less than it otherwise would, decided once, at
   * activation, and kept on the row — so an operator reading it later sees
   * the reason rather than a bare zero, and the subscription top-up below
   * reads the same answer instead of deciding it again.
   */
  let unpaid = referral.unpaidReason
  if (!activationDone) {
    unpaid =
      (await sharedOrigin(db, inviteeId, referral.referrerId)) ??
      ((await paidActivationsInMonth(db, referral.referrerId, at)) >=
      TOKEN_RULES.referral.maxActivationsPerMonth
        ? 'monthlyLimit'
        : undefined)
  }
  // A shared network or device withholds the whole referral: both sides, and
  // the top-up. The monthly limit is about the referrer's activations only.
  const shared = unpaid === 'sharedNetwork' || unpaid === 'sharedDevice'

  if (!activationDone) {
    const award = await awardAndTotal(db, {
      userId: referral.referrerId,
      kind: 'referral',
      amount: frozen || unpaid ? 0 : TOKEN_RULES.referral.activation,
      refId: inviteeId,
      at,
    })
    /*
     * The invitee's welcome, in the same breath — what takes them from the
     * sign-up bonus to `inviteeTotal`. Not withheld when the *referrer* is
     * frozen or past the monthly limit: the activation was the invitee's own
     * doing, and their standing is judged by `awardTokens` on their own row.
     * Same `refId` (themselves), so the ledger's unique index caps it at once.
     */
    const welcome = await awardAndTotal(db, {
      userId: inviteeId,
      kind: 'referralWelcome',
      amount: shared ? 0 : TOKEN_RULES.referral.inviteeActivation,
      refId: inviteeId,
      at,
    })
    /*
     * Every few activations in a year also earn the referrer a month of Pro
     * — before the latch, like the awards above, so a crash here is healed
     * by the next settle rather than lost behind a written `activatedAt`.
     * Not for a frozen referrer, for the reason their award is zero, and not
     * for an activation with an `unpaidReason`, which `queueReferralGifts`
     * leaves out of its count as well.
     */
    const gifts = !frozen && !unpaid
    if (gifts) await queueReferralGifts(db, referral.referrerId, inviteeId, at)
    await latch(db, inviteeId, {
      activatedAt: at,
      activationAward: award,
      inviteeAward: welcome,
      ...(unpaid ? { unpaidReason: unpaid } : {}),
    })
    // Once more now that this activation is on the record: two invitees
    // settling at the same moment each counted the other as not yet in.
    if (gifts) await queueReferralGifts(db, referral.referrerId, inviteeId, at)
  }

  if (referral.subscribedAt && !subscriptionDone) {
    const award = await awardAndTotal(db, {
      userId: referral.referrerId,
      kind: 'referralSubscription',
      amount: frozen || shared ? 0 : TOKEN_RULES.referral.subscription,
      refId: inviteeId,
      at,
    })
    await latch(db, inviteeId, { subscriptionAward: award })
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
 * The profile conditions are nearly implied by one another — `POST /profiles`
 * sits behind `requireVerifiedEmail`, so having a profile already means a
 * verified email and a finished onboarding. They are still checked, because
 * they cost one indexed read on a path that runs about once per referred
 * user, and because the rule stays true if some future route creates a
 * profile differently. A frozen invitee is not activated either: settling is
 * also started by the partner's reply (see `awardForSend`), so this can no
 * longer rely on a frozen sender's own send never reaching it.
 *
 * The condition that does the work: a two-way conversation — both sides have
 * written — with somebody other than the referrer. The signal is the
 * invitee's own reciprocity bonus (`mutual:<conversationId>`), which
 * `awardForSend` writes only for a live exchange: never for a conversation
 * with an official account, and never for history imported from v1. The
 * conversation it names says who the other side was.
 */
async function isActivated(db: Db, inviteeId: string, referrerId: string): Promise<boolean> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: inviteeId }, { projection: { deletedAt: 1, guest: 1, tokenFrozenAt: 1 } })
  if (!profile || profile.deletedAt || profile.guest || profile.tokenFrozenAt) return false
  if (!(await isEmailVerified(db, inviteeId))) return false

  // An anchored prefix, so the scan stays inside `user_kind_ref_unique`. One
  // row per conversation that went two-way, which for somebody new is few.
  const mutual = await db
    .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
    .find(
      { userId: inviteeId, kind: 'message', refId: { $regex: `^${MUTUAL_REF_PREFIX}` } },
      { projection: { refId: 1 } },
    )
    .toArray()
  const conversationIds = mutual.flatMap((row) => {
    const hex = row.refId?.slice(MUTUAL_REF_PREFIX.length)
    return hex && ObjectId.isValid(hex) ? [new ObjectId(hex)] : []
  })
  if (conversationIds.length === 0) return false

  const withSomebodyElse = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .countDocuments(
      { _id: { $in: conversationIds }, participants: { $ne: referrerId } },
      { limit: 1 },
    )
  return withSomebodyElse > 0
}

/**
 * What Better Auth writes when it has no client address to record: the empty
 * string in production, and loopback in development and test — where every
 * local session would otherwise appear to share one network.
 */
const UNKNOWN_IPS = new Set(['', '127.0.0.1', '::1'])

/**
 * Whether the invitee and the referrer have signed in from the same network
 * or registered the same installation — in which case the referral pays
 * neither of them.
 *
 * Network: any `session.ipAddress` in common. Better Auth stores an IPv6
 * address already reduced to its /64, so for IPv6 this compares a network
 * prefix rather than one device's address. Sessions expire, so this sees the
 * recent past only. `session.userId` is an ObjectId, hence `authId`; both
 * reads ride `session_userId_idx`.
 *
 * Installation: any `devices.deviceId` in common, through the `user` index.
 * Rows from builds that predate `deviceId` carry none and match nothing.
 */
async function sharedOrigin(
  db: Db,
  inviteeId: string,
  referrerId: string,
): Promise<'sharedNetwork' | 'sharedDevice' | null> {
  const sessions = db.collection<{ userId: ObjectId; ipAddress?: string | null }>(
    COLLECTIONS.session,
  )
  const ips = (await sessions.distinct('ipAddress', { userId: authId(inviteeId) })).filter(
    (ip): ip is string => typeof ip === 'string' && !UNKNOWN_IPS.has(ip),
  )
  if (
    ips.length > 0 &&
    (await sessions.countDocuments(
      { userId: authId(referrerId), ipAddress: { $in: ips } },
      { limit: 1 },
    )) > 0
  ) {
    return 'sharedNetwork'
  }

  const devices = db.collection<Device>(COLLECTIONS.devices)
  const deviceIds = (await devices.distinct('deviceId', { userId: inviteeId })).filter(
    (id): id is string => typeof id === 'string' && id !== '',
  )
  if (
    deviceIds.length > 0 &&
    (await devices.countDocuments(
      { userId: referrerId, deviceId: { $in: deviceIds } },
      { limit: 1 },
    )) > 0
  ) {
    return 'sharedDevice'
  }
  return null
}

/**
 * How many activations this referrer has been paid for in the calendar month
 * (UTC) that `at` falls in — the count `maxActivationsPerMonth` limits.
 *
 * Calendar rather than rolling 30 days to match `queueReferralGifts`, which
 * counts a calendar year in UTC: the two then agree on what a period is, and
 * an operator can check either with a date range. Rows with an `unpaidReason`
 * are left out, since they were not paid. Two invitees of one referrer
 * settling at the same instant can both read a count just under the limit;
 * that overshoot needs the coincidence, and is not worth a lock on the
 * message path.
 */
async function paidActivationsInMonth(db: Db, referrerId: string, at: Date): Promise<number> {
  const year = at.getUTCFullYear()
  const month = at.getUTCMonth()
  return db.collection<Referral>(COLLECTIONS.referrals).countDocuments({
    referrerId,
    activatedAt: {
      $gte: new Date(Date.UTC(year, month, 1)),
      $lt: new Date(Date.UTC(year, month + 1, 1)),
    },
    unpaidReason: { $exists: false },
  })
}

/**
 * The stores somebody actually pays in, as RevenueCat spells them — in lower
 * case on the subscriber record and upper case on a webhook, so compared
 * lower-cased. `fake_store` is the local harness (refused in production), and
 * is here so the harness can rehearse the payout. `promotional` and `gift` are
 * absent on purpose: nobody paid for them.
 */
const PAYING_STORES = new Set([
  'app_store',
  'mac_app_store',
  'play_store',
  'amazon',
  'stripe',
  'rc_billing',
  'fake_store',
])

export interface HeldEntitlement {
  tier: StoredPlanTier
  store?: string | null | undefined
  periodType?: BillingPeriodType | null | undefined
  expiresAt?: Date | null | undefined
}

/**
 * Whether an entitlement is money changing hands: a paid tier, bought in a
 * real store, past its free week.
 *
 * The referral top-up used to be paid on any free → paid edge and on every
 * `INITIAL_PURCHASE`, and both of those include a trial somebody cancels on
 * day six and a promotional grant nobody paid for. Four thousand tokens for
 * starting a free week is the cheapest farm in the economy. `periodType` is
 * what separates them, and only a positive `normal` counts — absence means
 * "not known", which is not the same as "paying".
 */
export function isPaidPurchase(entitlement: HeldEntitlement | null | undefined): boolean {
  if (!entitlement) return false
  if (effectivePlanTier(entitlement.tier, entitlement.expiresAt) === 'free') return false
  if (!PAYING_STORES.has((entitlement.store ?? '').toLowerCase())) return false
  return entitlement.periodType === 'normal'
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
 * `subscribedAt` until they are activated, and both awards land in one
 * call. That ordering is what stops a stolen card on a throwaway account being
 * worth four thousand tokens for no human effort.
 *
 * Called from both billing paths — the webhook and `/billing/refresh` — with
 * whatever entitlement they just wrote, and a no-op unless `isPaidPurchase`.
 * Safe to call twice: the mark is filtered and the settle latched, which is
 * how a trial turning into a paid month (a `RENEWAL`, or a refresh that sees
 * `trial` become `normal`) is caught by whichever path gets there first.
 */
export async function creditReferrerForSubscription(
  db: Db,
  inviteeId: string,
  entitlement: HeldEntitlement,
  at: Date,
): Promise<void> {
  if (!isPaidPurchase(entitlement)) return
  await markInviteeSubscribed(db, inviteeId, 'pro', at)
  await settleReferral(db, inviteeId, at)
}
