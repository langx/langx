import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { RevenueCatClient } from './revenueCatClient'
import { creditReferrerForSubscription } from '../referrals/settle'
import { grantWelcomePack } from './welcomePack'

/**
 * The client-triggered fallback for a webhook that's late or never arrives
 * (network blip, RevenueCat outage) — see the plan's "Webhook gecikirse
 * client calls POST /billing/refresh and the server verifies against
 * RevenueCat's REST API." Reconciles straight from RevenueCat's own subscriber record,
 * never from anything the client asserts about its own purchase state.
 *
 * Also the answer to the one case webhooks cannot express: when a Pro+
 * subscription lapses while a separate Pro one is still running, the
 * `EXPIRATION` event says only that something ended. Asking RevenueCat what
 * the subscriber holds *now* is the only way to land on `pro` rather than
 * `free`, which is why `processRevenueCatWebhook` calls this path too.
 */
export async function refreshEntitlement(
  db: Db,
  client: RevenueCatClient,
  userId: string,
): Promise<Profile['entitlement']> {
  const entitlement = await client.getEntitlement(userId)
  const now = new Date()

  const next: Profile['entitlement'] = entitlement
    ? {
        tier: entitlement.tier,
        // Was hardcoded `true`. With no webhook endpoint configured this is the
        // only path that writes an entitlement, so every subscriber who had
        // cancelled was still recorded as renewing.
        willRenew: entitlement.willRenew,
        store: entitlement.store,
        updatedAt: now,
      }
    : { tier: 'free', willRenew: false, updatedAt: now }
  if (entitlement?.expiresAt) next.expiresAt = entitlement.expiresAt

  /*
   * The pre-image, for one reason: a referral top-up is a function of an
   * *event*, and this is the only edge in this file that is one.
   * `grantWelcomePack` below is a function of the tier and is safely re-run on
   * every refresh; paying somebody again on every refresh would not be.
   */
  const before = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: userId },
      { $set: { entitlement: next, updatedAt: now } },
      { returnDocument: 'before' },
    )

  /*
   * The transition, not the state. A renewal's pre-image is already paid, so
   * it cannot fire here — which is the point, since this path cannot see the
   * event type at all. It exists because a webhook that never arrives (a
   * RevenueCat outage, a misconfigured dashboard secret) would otherwise mean
   * the top-up is never paid, and this fallback is documented above as being
   * for exactly that case.
   *
   * A lapse and re-subscribe reaches this edge a second time and pays nothing,
   * because `refId` is the invitee: the pair is capped whatever calls this.
   * Swallowed for the same reason `grantWelcomePack` is.
   */
  if (before?.entitlement.tier === 'free' && next.tier !== 'free') {
    try {
      await creditReferrerForSubscription(db, userId, next.tier, now)
    } catch {
      // Intentionally ignored; see above.
    }
  }

  /*
   * After the entitlement is written, not before: if the grant threw, a retry
   * has to find the tier already recorded, and a pack handed out against a
   * tier that failed to save would be a gift for a subscription nobody has.
   *
   * Failure is swallowed for the same reason the v1 loyalty grant's is — the
   * subscription is the thing the user paid for and it is already active;
   * losing a cosmetic to a transient write is not worth failing the refresh
   * that RevenueCat is waiting on. The next refresh picks it up, because the
   * latch is only written on success.
   */
  if (next.tier !== 'free') {
    try {
      await grantWelcomePack(db, userId, next.tier)
    } catch {
      // Intentionally ignored; see above.
    }
  }

  return next
}
