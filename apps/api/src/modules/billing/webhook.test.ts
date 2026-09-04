import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { RevenueCatClient } from './revenueCatClient'
import { processRevenueCatWebhook } from './webhook'

function minimalProfile(id: string): Profile {
  const now = new Date()
  return {
    _id: id,
    handle: id,
    displayName: id,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
}

describe('processRevenueCatWebhook', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_webhook_test')
    // eventId's unique index is the idempotency guard this whole suite exercises.
    await handle.db
      .collection(COLLECTIONS.subscriptions)
      .createIndex({ eventId: 1 }, { unique: true })
  }, 60_000)

  afterAll(async () => {
    await handle?.close()
    await server?.stop()
  })

  async function insertProfile(profile: Profile) {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(profile)
  }

  async function getProfile(id: string) {
    return handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
  }

  it('INITIAL_PURCHASE grants Pro with the event expiration', async () => {
    await insertProfile(minimalProfile('purchase-user'))
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    const result = await processRevenueCatWebhook(handle.db, {
      id: 'evt-1',
      type: 'INITIAL_PURCHASE',
      app_user_id: 'purchase-user',
      product_id: 'pro_monthly',
      store: 'app_store',
      expiration_at_ms: expiresAt,
    })

    expect(result.processed).toBe(true)
    const profile = await getProfile('purchase-user')
    expect(profile?.entitlement).toMatchObject({ tier: 'pro', willRenew: true, store: 'app_store' })
    expect(profile?.entitlement.expiresAt?.getTime()).toBe(expiresAt)
  })

  it('replaying the same eventId is idempotent — acked but not reprocessed', async () => {
    await insertProfile(minimalProfile('replay-user'))
    const event = {
      id: 'evt-replay',
      type: 'INITIAL_PURCHASE',
      app_user_id: 'replay-user',
      expiration_at_ms: Date.now() + 1000,
    }

    const first = await processRevenueCatWebhook(handle.db, event)
    expect(first.processed).toBe(true)

    const second = await processRevenueCatWebhook(handle.db, event)
    expect(second.processed).toBe(false)

    const count = await handle.db
      .collection(COLLECTIONS.subscriptions)
      .countDocuments({ eventId: 'evt-replay' })
    expect(count).toBe(1)
  })

  it('EXPIRATION revokes Pro immediately', async () => {
    await insertProfile({
      ...minimalProfile('expiring-user'),
      entitlement: { tier: 'pro', updatedAt: new Date() },
    })

    await processRevenueCatWebhook(handle.db, {
      id: 'evt-expire',
      type: 'EXPIRATION',
      app_user_id: 'expiring-user',
    })

    const profile = await getProfile('expiring-user')
    expect(profile?.entitlement).toMatchObject({ tier: 'free', willRenew: false })
  })

  it('CANCELLATION keeps access until expiry — only willRenew flips', async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await insertProfile({
      ...minimalProfile('cancelling-user'),
      entitlement: { tier: 'pro', expiresAt, willRenew: true, updatedAt: new Date() },
    })

    await processRevenueCatWebhook(handle.db, {
      id: 'evt-cancel',
      type: 'CANCELLATION',
      app_user_id: 'cancelling-user',
    })

    const profile = await getProfile('cancelling-user')
    expect(profile?.entitlement.tier).toBe('pro') // still entitled
    expect(profile?.entitlement.willRenew).toBe(false)
    expect(profile?.entitlement.expiresAt?.getTime()).toBe(expiresAt.getTime()) // untouched
  })

  it('BILLING_ISSUE is recorded for audit but does not change entitlement', async () => {
    const expiresAt = new Date(Date.now() + 1000)
    await insertProfile({
      ...minimalProfile('billing-issue-user'),
      entitlement: { tier: 'pro', expiresAt, willRenew: true, updatedAt: new Date() },
    })

    const result = await processRevenueCatWebhook(handle.db, {
      id: 'evt-billing-issue',
      type: 'BILLING_ISSUE',
      app_user_id: 'billing-issue-user',
    })

    expect(result.processed).toBe(true)
    const profile = await getProfile('billing-issue-user')
    expect(profile?.entitlement).toMatchObject({ tier: 'pro', willRenew: true })
    const recorded = await handle.db
      .collection(COLLECTIONS.subscriptions)
      .findOne({ eventId: 'evt-billing-issue' })
    expect(recorded).toMatchObject({ type: 'BILLING_ISSUE', userId: 'billing-issue-user' })
  })

  /**
   * The v1 loyalty gift, as RevenueCat actually delivers it: two promotional
   * grants, two `NON_RENEWING_PURCHASE` events, the second carrying only
   * `pro`. Written from the events alone the second one downgraded the
   * account — `hi@langx.io` sat on Fluent for three minutes on 4 September
   * 2026 until a paywall visit happened to refresh it. With a client the
   * handler asks RevenueCat instead, and RevenueCat holds both.
   */
  describe('a grant event with a client reconciles against the subscriber record', () => {
    const lifetimePlus: RevenueCatClient = {
      getEntitlement: () =>
        Promise.resolve({
          tier: 'pro_plus',
          expiresAt: null,
          productId: 'rc_promo_pro_plus_lifetime',
          store: 'promotional',
          willRenew: false,
        }),
      grantLifetimeEntitlement: () => Promise.resolve(),
    }

    it('keeps Pro+ when the trailing pro-only grant event arrives', async () => {
      await insertProfile(minimalProfile('gift-user'))

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-gift-plus',
          type: 'NON_RENEWING_PURCHASE',
          app_user_id: 'gift-user',
          product_id: 'rc_promo_pro_plus_lifetime',
          store: 'PROMOTIONAL',
          entitlement_ids: ['pro_plus'],
        },
        lifetimePlus,
      )
      expect((await getProfile('gift-user'))?.entitlement.tier).toBe('pro_plus')

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-gift-pro',
          type: 'NON_RENEWING_PURCHASE',
          app_user_id: 'gift-user',
          product_id: 'rc_promo_pro_lifetime',
          store: 'PROMOTIONAL',
          entitlement_ids: ['pro'],
        },
        lifetimePlus,
      )

      const profile = await getProfile('gift-user')
      expect(profile?.entitlement).toMatchObject({
        tier: 'pro_plus',
        willRenew: false,
        store: 'promotional',
      })
      expect(profile?.entitlement.expiresAt).toBeUndefined()
    })

    it('does not depend on entitlement_ids being present', async () => {
      await insertProfile(minimalProfile('gift-user-bare'))

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-gift-bare',
          type: 'NON_RENEWING_PURCHASE',
          app_user_id: 'gift-user-bare',
          product_id: 'rc_promo_pro_lifetime',
          store: 'PROMOTIONAL',
        },
        lifetimePlus,
      )

      expect((await getProfile('gift-user-bare'))?.entitlement.tier).toBe('pro_plus')
    })

    it('falls back to the event when RevenueCat cannot be asked', async () => {
      await insertProfile({
        ...minimalProfile('gift-user-offline'),
        entitlement: { tier: 'pro_plus', willRenew: false, updatedAt: new Date() },
      })
      const down: RevenueCatClient = {
        getEntitlement: () => Promise.reject(new Error('RevenueCat is down')),
        grantLifetimeEntitlement: () => Promise.resolve(),
      }

      const result = await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-gift-offline',
          type: 'NON_RENEWING_PURCHASE',
          app_user_id: 'gift-user-offline',
          product_id: 'rc_promo_pro_lifetime',
          store: 'PROMOTIONAL',
          entitlement_ids: ['pro'],
        },
        down,
      )

      // Still a 2xx — RevenueCat would retry forever otherwise — and the
      // event-derived answer, which is the best available without the record.
      expect(result.processed).toBe(true)
      expect((await getProfile('gift-user-offline'))?.entitlement.tier).toBe('pro')
    })
  })
})
