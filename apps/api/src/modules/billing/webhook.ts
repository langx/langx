import {
  ENTITLEMENT_CANCEL_EVENTS,
  ENTITLEMENT_GRANT_EVENTS,
  ENTITLEMENT_REVOKE_EVENTS,
  tierFromEntitlementIds,
  type RevenueCatEvent,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { creditReferrerForSubscription } from '../referrals/settle'
import type { Profile } from '../profiles/profiles'
import { refreshEntitlement, refreshEntitlementIfHeld } from './refresh'
import type { RevenueCatClient } from './revenueCatClient'
import { notifyBilling, type BillingNotifier } from './notify'

export interface SubscriptionRecord {
  eventId: string
  userId: string
  type: string
  store: string
  productId: string
  expiresAt: Date | null
  environment: string
  createdAt: Date
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000
}

const GRANT_SET = new Set<string>(ENTITLEMENT_GRANT_EVENTS)
const REVOKE_SET = new Set<string>(ENTITLEMENT_REVOKE_EVENTS)
const CANCEL_SET = new Set<string>(ENTITLEMENT_CANCEL_EVENTS)

export interface WebhookResult {
  /** `false` when this `event.id` was already recorded — RevenueCat retries on anything but a 2xx, so a duplicate must still ack cleanly, not reprocess. */
  processed: boolean
}

/**
 * `subscriptions.eventId`'s unique index (db/indexes.ts) is the idempotency
 * guard: insert first, and a duplicate-key error means this exact event was
 * already handled — return early without touching `profiles.entitlement` a
 * second time. Only after a clean insert does entitlement change.
 *
 * `client` is optional so every test that only exercises the recording and
 * idempotency halves can keep calling this with two arguments. Passing it
 * buys one thing, and only on `EXPIRATION`: see the comment on that branch.
 */
export async function processRevenueCatWebhook(
  db: Db,
  event: RevenueCatEvent,
  client?: RevenueCatClient,
  notify?: BillingNotifier,
): Promise<WebhookResult> {
  // TRANSFER events have no `app_user_id` at all — the recipient arrives in
  // `transferred_to`. Only the first id matters: RevenueCat lists the target
  // user's aliases, which are all the same person to us.
  const userId = event.app_user_id ?? event.transferred_to?.[0] ?? null

  const record: SubscriptionRecord = {
    eventId: event.id,
    userId: userId ?? 'unknown',
    type: event.type,
    store: event.store ?? 'unknown',
    productId: event.product_id ?? 'unknown',
    expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
    environment: event.environment ?? 'PRODUCTION',
    createdAt: new Date(),
  }

  try {
    await db.collection<SubscriptionRecord>(COLLECTIONS.subscriptions).insertOne(record)
  } catch (error) {
    if (isDuplicateKeyError(error)) return { processed: false }
    throw error
  }

  // Recorded for audit, but there is nobody to grant to or revoke from.
  // Still a 2xx: a payload we cannot act on will not act differently on the
  // fifth redelivery either.
  if (!userId) return { processed: true }

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const now = new Date()

  // Read before anything is written: the mail says which plan this was about,
  // and by the time an EXPIRATION has been applied the answer is "free".
  const previousTier = notify
    ? ((await profiles.findOne({ _id: userId }, { projection: { entitlement: 1 } }))?.entitlement
        ?.tier ?? 'free')
    : 'free'

  if (GRANT_SET.has(event.type)) {
    /*
     * A grant event says what just *arrived*, never what the subscriber now
     * holds, and the two differ. Pro+ products grant `pro` as well as
     * `pro_plus`, and the v1 loyalty gift hands the two out as separate
     * promotional grants — so a second `NON_RENEWING_PURCHASE` carrying only
     * `pro` follows the one that carried `pro_plus`. Written from the event
     * alone, that second one downgraded every Polyglot to Fluent (observed on
     * `hi@langx.io`, 4 September 2026: `pro_plus` at 04:58:40.710, `pro` at
     * 04:58:40.992). So the subscriber record is asked instead, which resolves
     * the overlap by `ENTITLEMENT_PRECEDENCE` — the same thing `EXPIRATION`
     * and `TRANSFER` already did, now for every grant. The event-derived
     * write below stays as the fallback for when RevenueCat cannot be asked.
     *
     * The `INITIAL_PURCHASE` referral credit is not lost on this path:
     * `refreshEntitlement` pays it on the free → paid transition itself.
     *
     * A record that holds *nothing* is not believed on a grant: the event
     * says something was just bought or given, so an empty answer is a record
     * that has not caught up with its own webhook, and the event decides.
     */
    if (client && (await reconciledIfHeld(db, client, userId))) return { processed: true }

    const tier = tierFromEntitlementIds(event.entitlement_ids)

    // Falls back to the *lowest paid* tier rather than to free. A grant event
    // whose `entitlement_ids` we cannot read still means the user bought
    // something; defaulting to free would revoke access on a malformed
    // payload, which is the one direction that is never safe to guess in.
    // This is also what makes `PRODUCT_CHANGE` — the upgrade/downgrade event —
    // land on the tier that was actually changed *to* when there is no client.
    const entitlement: Profile['entitlement'] = {
      tier: tier ?? 'pro',
      willRenew: true,
      store: record.store,
      updatedAt: now,
    }
    if (record.expiresAt) entitlement.expiresAt = record.expiresAt
    await profiles.updateOne({ _id: userId }, { $set: { entitlement, updatedAt: now } })

    /*
     * `INITIAL_PURCHASE` and nothing else, and this is the only place in the
     * system where that distinction exists — the client's `POST
     * /billing/refresh` fallback sees a tier, never an event.
     * `ENTITLEMENT_GRANT_EVENTS` also contains RENEWAL, PRODUCT_CHANGE,
     * UNCANCELLATION and four more; every one of them is a grant and none of
     * them is somebody starting to pay for the first time.
     *
     * Failure is swallowed for the reason `grantWelcomePack`'s is: the
     * subscription is what the user paid for and it is already recorded above,
     * and losing a referral top-up to a transient write is not worth failing
     * the webhook RevenueCat is waiting on. `settleReferral` is idempotent, so
     * the client's refresh picks it up.
     */
    if (event.type === 'INITIAL_PURCHASE') {
      try {
        await creditReferrerForSubscription(db, userId, entitlement.tier, now)
      } catch (error) {
        console.error('[referral] subscription credit failed', { userId, error })
      }
    }
  } else if (REVOKE_SET.has(event.type)) {
    // An EXPIRATION says something ended — never what is left. A subscriber
    // whose Pro+ lapses while a separate Pro subscription runs on must land on
    // `pro`, and no field on this event can tell us that. So ask RevenueCat
    // what they hold *now*; only if that is impossible (no secret key, or the
    // API is down) do we fall back to the event's own pessimistic reading.
    if (!client || !(await reconciled(db, client, userId))) {
      const entitlement: Profile['entitlement'] = {
        tier: 'free',
        willRenew: false,
        store: record.store,
        updatedAt: now,
      }
      await profiles.updateOne({ _id: userId }, { $set: { entitlement, updatedAt: now } })
    }
    /*
     * Said only when something was actually lost, which is why it is asked
     * after the write rather than derived from the event. An EXPIRATION on a
     * Pro+ subscription whose plain Pro runs on ends nothing from the
     * subscriber's point of view, and `reconciled` is what knows that.
     */
    if (notify && previousTier !== 'free') {
      const left = await profiles.findOne({ _id: userId }, { projection: { entitlement: 1 } })
      if ((left?.entitlement?.tier ?? 'free') === 'free') {
        await notifyBilling(db, notify, userId, 'planEnded', previousTier)
      }
    }
  } else if (CANCEL_SET.has(event.type)) {
    // Access continues until expiresAt — only the renewal intent changes.
    await profiles.updateOne(
      { _id: userId },
      { $set: { 'entitlement.willRenew': false, updatedAt: now } },
    )
  } else if (event.type === 'BILLING_ISSUE' && notify) {
    /*
     * The one event that changes no entitlement and still has to be said out
     * loud. The store will retry, and the subscription stays active while it
     * does — but the card that failed is a thing only its owner can fix, and
     * the first they would otherwise hear of it is the plan ending.
     */
    await notifyBilling(db, notify, userId, 'paymentFailed', previousTier)
  }
  // Anything else unrecognized: recorded above for audit, no entitlement change.

  return { processed: true }
}

/**
 * Writes the entitlement RevenueCat reports right now, returning `false` when
 * it could not be asked. Swallowing the error is deliberate: billing being
 * unreachable must not turn into a non-2xx, because RevenueCat would then
 * retry this event forever while the caller has a perfectly good fallback.
 */
async function reconciled(db: Db, client: RevenueCatClient, userId: string): Promise<boolean> {
  try {
    await refreshEntitlement(db, client, userId)
    return true
  } catch {
    return false
  }
}

/** `reconciled`, for a grant: also `false` when the record holds nothing yet. */
async function reconciledIfHeld(
  db: Db,
  client: RevenueCatClient,
  userId: string,
): Promise<boolean> {
  try {
    return await refreshEntitlementIfHeld(db, client, userId)
  } catch {
    return false
  }
}
