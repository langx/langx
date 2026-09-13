import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { claimOnce } from '../notifications/ledger'
import type { Profile } from '../profiles/profiles'
import { notifyBilling, type BillingNotifier } from './notify'

/**
 * How long an account has to stay free before it is told its plan ended.
 *
 * Half an hour, which is one tick of the notification scheduler — the
 * shortest wait that is a wait at all. It exists because an expiry is not
 * always the end of anything: a store retrying a card sends EXPIRATION and
 * then, minutes later, the RENEWAL that undoes it. On 12 September 2026 the
 * gap was seven minutes, and the letter had already gone.
 */
export const PLAN_ENDED_DELAY_MS = 30 * 60 * 1000

/**
 * And the far end, for the same reason `verifyReminder` has one: `churnedFrom`
 * is never cleared, so without this the first run of this pass would write to
 * everybody who has ever cancelled. A day-old churn is still news; a
 * month-old one is a mail nobody asked for about a decision they already made.
 */
export const PLAN_ENDED_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * The letter the RevenueCat webhook deliberately does not send.
 *
 * Everything else about a plan ending is immediate and stays that way — the
 * entitlement drops to free the moment RevenueCat says so, because access is
 * not a thing to be generous with on a guess. Only the *telling* waits, and
 * only long enough for a late renewal to arrive and make the telling wrong.
 *
 * Transactional, like everything in `notify.ts`: no preference is consulted,
 * because "do not tell me my plan ended" is not a setting worth offering.
 * What is consulted is whether it actually ended — `entitlement.tier` is read
 * now, not when the event arrived, so a Pro+ that lapsed onto a running Pro,
 * an account that resubscribed, and a renewal that simply took its time all
 * fall out of this query rather than needing a rule each.
 *
 * Claimed in the ledger against `churnedFrom.at`, so a person hears this once
 * per fall however often the pass runs — and hears it again if they
 * resubscribe and churn a second time, which is a different date.
 */
export async function runPlanEndedPass(
  db: Db,
  senders: BillingNotifier,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const fallen = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        'entitlement.tier': 'free',
        'churnedFrom.at': {
          $lte: new Date(now.getTime() - PLAN_ENDED_DELAY_MS),
          $gte: new Date(now.getTime() - PLAN_ENDED_MAX_AGE_MS),
        },
        deletedAt: { $exists: false },
      },
      { projection: { churnedFrom: 1 } },
    )
    .toArray()

  let sent = 0
  for (const profile of fallen) {
    const churned = profile.churnedFrom
    if (!churned) continue
    // Claimed before the send, like every pass here: one nobody got beats one
    // that arrives every half hour until the day turns over.
    if (!(await claimOnce(db, 'billing.planEnded', profile._id, churned.at.toISOString()))) continue
    await notifyBilling(db, senders, profile._id, 'planEnded', churned.tier)
    sent += 1
  }

  return { sent }
}
