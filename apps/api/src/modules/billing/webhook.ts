import {
  ENTITLEMENT_CANCEL_EVENTS,
  ENTITLEMENT_GRANT_EVENTS,
  ENTITLEMENT_REVOKE_EVENTS,
  type RevenueCatEvent,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

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
 */
export async function processRevenueCatWebhook(
  db: Db,
  event: RevenueCatEvent,
): Promise<WebhookResult> {
  const record: SubscriptionRecord = {
    eventId: event.id,
    userId: event.app_user_id,
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

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const now = new Date()

  if (GRANT_SET.has(event.type)) {
    const entitlement: Profile['entitlement'] = {
      tier: 'pro',
      willRenew: true,
      store: record.store,
      updatedAt: now,
    }
    if (record.expiresAt) entitlement.expiresAt = record.expiresAt
    await profiles.updateOne({ _id: event.app_user_id }, { $set: { entitlement, updatedAt: now } })
  } else if (REVOKE_SET.has(event.type)) {
    const entitlement: Profile['entitlement'] = {
      tier: 'free',
      willRenew: false,
      store: record.store,
      updatedAt: now,
    }
    await profiles.updateOne({ _id: event.app_user_id }, { $set: { entitlement, updatedAt: now } })
  } else if (CANCEL_SET.has(event.type)) {
    // Access continues until expiresAt — only the renewal intent changes.
    await profiles.updateOne(
      { _id: event.app_user_id },
      { $set: { 'entitlement.willRenew': false, updatedAt: now } },
    )
  }
  // BILLING_ISSUE and anything unrecognized: recorded above for audit, no entitlement change.

  return { processed: true }
}
