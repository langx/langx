import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { claimOnce } from '../notifications/ledger'
import type { Profile } from '../profiles/profiles'
import { PLAN_ENDED_DELAY_MS, PLAN_ENDED_MAX_AGE_MS } from './planEnded'
import { notifyBilling, type BillingNotifier } from './notify'
import type { SubscriptionRecord } from './webhook'

/**
 * "Your payment did not go through — the store will retry, your plan stays
 * active", said only once it is still true half an hour later.
 *
 * The webhook used to send it the moment `BILLING_ISSUE` arrived, unless the
 * event's own period was already over. That test cannot see a web
 * (`RC_BILLING`) trial: its first charge is taken an hour before the trial
 * ends, and when it fails RevenueCat sends `BILLING_ISSUE`, `CANCELLATION`
 * and `EXPIRATION` within a tenth of a second, in no fixed order — with the
 * period still an hour from over. Four people between 21 and 27 November 2026
 * were told their plan stayed active in the same second it ended.
 *
 * So the letter waits like the plan-ended one does, and is sent only if the
 * account is still on a paid tier and no `RENEWAL` has arrived since — a
 * retry that worked, or an expiry that already happened, both make it wrong.
 * The rule that a period already over on arrival says nothing is kept: that
 * is the store giving up, and the plan-ended letter is the one to send.
 *
 * Transactional, like everything in `notify.ts`. Claimed per event, so a
 * second failure on a later renewal is a second letter.
 */
export async function runPaymentFailedPass(
  db: Db,
  senders: BillingNotifier,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const log = db.collection<SubscriptionRecord>(COLLECTIONS.subscriptions)
  const issues = await log
    .find(
      {
        type: 'BILLING_ISSUE',
        environment: 'PRODUCTION',
        createdAt: {
          $lte: new Date(now.getTime() - PLAN_ENDED_DELAY_MS),
          $gte: new Date(now.getTime() - PLAN_ENDED_MAX_AGE_MS),
        },
      },
      { projection: { eventId: 1, userId: 1, expiresAt: 1, createdAt: 1 } },
    )
    .toArray()

  let sent = 0
  for (const issue of issues) {
    if (issue.expiresAt && issue.expiresAt <= issue.createdAt) continue

    const profile = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne(
        { _id: issue.userId, deletedAt: { $exists: false } },
        { projection: { entitlement: 1 } },
      )
    const tier = profile?.entitlement?.tier ?? 'free'
    if (tier === 'free') continue

    const renewed = await log.findOne(
      { userId: issue.userId, type: 'RENEWAL', createdAt: { $gte: issue.createdAt } },
      { projection: { _id: 1 } },
    )
    if (renewed) continue

    if (!(await claimOnce(db, 'billing.paymentFailed', issue.userId, issue.eventId))) continue
    await notifyBilling(db, senders, issue.userId, 'paymentFailed', tier)
    sent += 1
  }

  return { sent }
}
