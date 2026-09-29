import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { RevenueCatClient, SubscriberEntitlement } from './revenueCatClient'
import { creditReferrerForSubscription, isPaidPurchase } from '../referrals/settle'
import { grantWelcomePack } from './welcomePack'
import { welcomeIfBecamePro } from './proWelcome'

/**
 * The client-triggered fallback for a webhook that's late or never arrives
 * (network blip, RevenueCat outage) — see the plan's "Webhook gecikirse
 * client calls POST /billing/refresh and the server verifies against
 * RevenueCat's REST API." Reconciles straight from RevenueCat's own subscriber record,
 * never from anything the client asserts about its own purchase state.
 *
 * Also the answer to the one case webhooks cannot express: when one
 * subscription lapses while another (or a gift) is still running, the
 * `EXPIRATION` event says only that something ended. Asking RevenueCat what
 * the subscriber holds *now* is the only way to land on `pro` rather than
 * `free`, which is why `processRevenueCatWebhook` calls this path too.
 */
export async function refreshEntitlement(
  db: Db,
  client: RevenueCatClient,
  userId: string,
): Promise<Profile['entitlement']> {
  return applyEntitlement(db, userId, await client.getEntitlement(userId))
}

/**
 * The same refresh, for a *grant* webhook: writes only when RevenueCat holds
 * something. A grant event means a purchase or a promotional grant exists,
 * so a subscriber record that answers "nothing" is one that has not caught up
 * with its own webhook yet — and writing `free` off it would revoke access
 * on the strength of a race. `false` hands the decision back to the event.
 */
export async function refreshEntitlementIfHeld(
  db: Db,
  client: RevenueCatClient,
  userId: string,
): Promise<boolean> {
  const entitlement = await client.getEntitlement(userId)
  if (!entitlement) return false
  await applyEntitlement(db, userId, entitlement)
  return true
}

async function applyEntitlement(
  db: Db,
  userId: string,
  entitlement: SubscriberEntitlement | null,
): Promise<Profile['entitlement']> {
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
        ...(entitlement.periodType ? { periodType: entitlement.periodType } : {}),
      }
    : { tier: 'free', willRenew: false, updatedAt: now }
  if (entitlement?.expiresAt) next.expiresAt = entitlement.expiresAt

  /*
   * The pre-image, because the two things below are functions of an *event*
   * — the referral top-up and the Pro welcome — and this write is the only
   * edge in this file. `grantWelcomePack` below is a function of the tier and
   * is safely re-run on every refresh; paying or welcoming somebody again on
   * every refresh would not be.
   */
  const before = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: userId },
      { $set: { entitlement: next, updatedAt: now } },
      { returnDocument: 'before' },
    )

  /*
   * The transition, not the state: somebody who was not paying a moment ago
   * and is now — a first purchase, or a free week that has just turned into a
   * charged month. A trial and a promotional grant are not paying, so neither
   * edge pays the referrer (`isPaidPurchase`); the renewal after them does.
   *
   * It exists because a webhook that never arrives (a RevenueCat outage, a
   * misconfigured dashboard secret) would otherwise mean the top-up is never
   * paid. A lapse and re-subscribe reaches this edge a second time and pays
   * nothing, because `refId` is the invitee: the pair is capped whatever
   * calls this. Swallowed for the same reason `grantWelcomePack` is.
   */
  if (!isPaidPurchase(before?.entitlement) && isPaidPurchase(next)) {
    try {
      await creditReferrerForSubscription(db, userId, next, now)
    } catch {
      // Intentionally ignored; see above.
    }
  }

  /*
   * The same pre-image, for the other edge that is an event: not Pro a moment
   * ago, Pro now — a first purchase, a free week starting, a gift. It leaves
   * the app a "You're Pro now" to show. Swallowed for the reason the referral
   * top-up is: the entitlement is what matters and it is already written.
   */
  try {
    await welcomeIfBecamePro(db, userId, before?.entitlement, next, now)
  } catch {
    // Intentionally ignored; see above.
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
      await grantWelcomePack(db, userId, 'pro')
    } catch {
      // Intentionally ignored; see above.
    }
  }

  return next
}
