import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { RevenueCatClient } from './revenueCatClient'

/**
 * The client-triggered fallback for a webhook that's late or never arrives
 * (network blip, RevenueCat outage) — see the plan's "Webhook gecikirse
 * client calls POST /billing/refresh and the server verifies against
 * RevenueCat's REST API." Reconciles straight from RevenueCat's own subscriber record,
 * never from anything the client asserts about its own purchase state.
 */
export async function refreshEntitlement(
  db: Db,
  client: RevenueCatClient,
  userId: string,
): Promise<Profile['entitlement']> {
  const entitlement = await client.getProEntitlement(userId)
  const now = new Date()

  const next: Profile['entitlement'] = entitlement?.isActive
    ? { tier: 'pro', willRenew: true, store: entitlement.store, updatedAt: now }
    : { tier: 'free', willRenew: false, updatedAt: now }
  if (entitlement?.expiresAt) next.expiresAt = entitlement.expiresAt

  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $set: { entitlement: next, updatedAt: now } })

  return next
}
