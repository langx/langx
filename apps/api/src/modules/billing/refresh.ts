import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { RevenueCatClient } from './revenueCatClient'
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

  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $set: { entitlement: next, updatedAt: now } })

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
