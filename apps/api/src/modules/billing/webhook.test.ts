import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { EmailMessage, EmailSender } from '../../email/sender'
import { translator } from '../../i18n'
import type { Profile } from '../profiles/profiles'
import type { BillingNotifier } from './notify'
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

  /**
   * A subscriber with a verified address, since that is the only kind
   * `notifyBilling` writes to — and a real ObjectId, since `emailFor` looks
   * the address up in Better Auth's collection, where a string matches
   * nothing. The `mailbox` is what the assertions read.
   */
  async function subscriber(tier: Profile['entitlement']['tier']) {
    const _id = new ObjectId()
    const userId = _id.toHexString()
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id, email: `${userId}@example.com`, emailVerified: true })
    await insertProfile({
      ...minimalProfile(userId),
      entitlement: { tier, willRenew: true, updatedAt: new Date() },
    })

    const mailbox: EmailMessage[] = []
    const email: EmailSender = {
      deliverable: true,
      send: (message) => {
        mailbox.push(message)
        return Promise.resolve()
      },
    }
    const notify: BillingNotifier = {
      email,
      push: { send: () => Promise.resolve({ invalidTokens: [] }) },
      logger: { error: vi.fn() },
    }
    return { userId, mailbox, notify }
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

  describe('what the webhook says out loud', () => {
    it('BILLING_ISSUE inside the period says the card failed', async () => {
      const { userId, mailbox, notify } = await subscriber('pro')

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-issue-live',
          type: 'BILLING_ISSUE',
          app_user_id: userId,
          environment: 'PRODUCTION',
          expiration_at_ms: Date.now() + 60_000,
        },
        undefined,
        notify,
      )

      // In their own language, like every letter this app sends — the profile
      // above is a Turkish speaker, so the English subject is the wrong one.
      expect(mailbox).toHaveLength(1)
      expect(mailbox[0]?.subject).toBe(translator('tr')('email.billing.paymentFailedTitle'))
    })

    /**
     * The 12 September 2026 pair, twenty-four milliseconds apart. A store that
     * has given up sends both, and the letter about a retry that is no longer
     * coming would arrive in the same minute as the one about the expiry.
     */
    it('BILLING_ISSUE on a period already over says nothing', async () => {
      const { userId, mailbox, notify } = await subscriber('pro_plus')

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-issue-expired',
          type: 'BILLING_ISSUE',
          app_user_id: userId,
          environment: 'PRODUCTION',
          expiration_at_ms: Date.now() - 29_000,
        },
        undefined,
        notify,
      )

      expect(mailbox).toHaveLength(0)
    })

    /**
     * The expiry is applied at once — access is not a thing to be generous
     * with on a guess — but the letter waits for `runPlanEndedPass`, because
     * the renewal that undoes it can be seven minutes behind it.
     */
    it('EXPIRATION records the fall and leaves the telling to the pass', async () => {
      const { userId, mailbox, notify } = await subscriber('pro_plus')

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-expire-quiet',
          type: 'EXPIRATION',
          app_user_id: userId,
          environment: 'PRODUCTION',
        },
        undefined,
        notify,
      )

      const profile = await getProfile(userId)
      expect(profile?.entitlement.tier).toBe('free')
      expect(profile?.churnedFrom).toMatchObject({ tier: 'pro_plus' })
      expect(mailbox).toHaveLength(0)
    })

    /**
     * A sandbox purchase moves the entitlement and nothing else. Learned the
     * hard way: a sandbox renewal that ran late mailed and pushed a payment
     * failure about a card that has never been charged.
     */
    it('a SANDBOX expiry moves the tier but says nothing and records no churn', async () => {
      const { userId, mailbox, notify } = await subscriber('pro_plus')

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-expire-sandbox',
          type: 'EXPIRATION',
          app_user_id: userId,
          environment: 'SANDBOX',
        },
        undefined,
        notify,
      )

      const profile = await getProfile(userId)
      expect(profile?.entitlement.tier).toBe('free')
      expect(profile?.churnedFrom).toBeUndefined()
      expect(mailbox).toHaveLength(0)
    })

    it('a SANDBOX billing issue says nothing either', async () => {
      const { userId, mailbox, notify } = await subscriber('pro')

      await processRevenueCatWebhook(
        handle.db,
        {
          id: 'evt-issue-sandbox',
          type: 'BILLING_ISSUE',
          app_user_id: userId,
          environment: 'SANDBOX',
          expiration_at_ms: Date.now() + 60_000,
        },
        undefined,
        notify,
      )

      expect(mailbox).toHaveLength(0)
    })
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
          periodType: null,
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
      // Absence, not `null`: a promotional grant is in no period, and the
      // cell is written only when RevenueCat says which one.
      expect(profile?.entitlement.periodType).toBeUndefined()
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
