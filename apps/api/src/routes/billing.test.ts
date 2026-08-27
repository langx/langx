import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import type { RevenueCatClient, SubscriberEntitlement } from '../modules/billing/revenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const WEBHOOK_SECRET = 'test-webhook-shared-secret'

class FakeRevenueCatClient implements RevenueCatClient {
  next: SubscriberEntitlement | null = null
  /**
   * Stands in for "no secret key configured, or RevenueCat is down". The
   * webhook's EXPIRATION branch has a fallback for exactly this, and a fake
   * that can only succeed would never reach it.
   */
  unavailable = false

  getEntitlement(): Promise<SubscriberEntitlement | null> {
    if (this.unavailable) return Promise.reject(new Error('Billing is not configured'))
    return Promise.resolve(this.next)
  }
}

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthYear: 1995,
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

describe('Faz 7 — billing', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let fakeRevenueCat: FakeRevenueCatClient

  async function newUser(email: string): Promise<SignedUpUser> {
    const user = await signUpAndSignIn(app, emailSender, {
      email,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_billing_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_billing_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      REVENUECAT_WEBHOOK_AUTH_HEADER: WEBHOOK_SECRET,
    })

    await ensureIndexes(handle.db)

    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    const storage = createStorageProvider(env)
    const translation = createTranslationProvider(env)
    fakeRevenueCat = new FakeRevenueCatClient()
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage,
      translation,
      revenueCat: fakeRevenueCat,
    })
    await app.ready()

    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    emailSender.messages.length = 0
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  describe('POST /webhooks/revenuecat', () => {
    it('rejects a request with no auth header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        payload: { event: { id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: 'someone' } },
      })
      expect(response.statusCode).toBe(401)
    })

    it('rejects a request with the wrong auth header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: 'wrong-secret' },
        payload: { event: { id: 'e2', type: 'INITIAL_PURCHASE', app_user_id: 'someone' } },
      })
      expect(response.statusCode).toBe(401)
    })

    it('grants Pro to the matching profile with the correct secret', async () => {
      const user = await newUser('webhook-grant@example.com')

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-grant-1',
            type: 'INITIAL_PURCHASE',
            app_user_id: user.userId,
            store: 'app_store',
            expiration_at_ms: Date.now() + 1_000_000,
          },
        },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ processed: true })

      const profile = await app.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.json()).toMatchObject({ entitlement: { tier: 'pro' } })
    })

    /**
     * The event above carries no `entitlement_ids` — a payload from before the
     * field was read, or a product mapped to nothing we sell. Granting the
     * lowest paid tier is the deliberate choice: the user demonstrably bought
     * something, and free is the one answer that is never safe to guess.
     */
    it('falls back to Pro when the event names no entitlement', async () => {
      const user = await newUser('webhook-no-ids@example.com')

      await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-no-ids',
            type: 'INITIAL_PURCHASE',
            app_user_id: user.userId,
            entitlement_ids: null,
          },
        },
      })

      const profile = await app.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.json()).toMatchObject({ entitlement: { tier: 'pro' } })
    })

    /** Pro+ products grant `pro` too, so both ids arrive and precedence decides. */
    it('grants Pro+ when the event names both entitlements', async () => {
      const user = await newUser('webhook-proplus@example.com')

      await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-proplus',
            type: 'INITIAL_PURCHASE',
            app_user_id: user.userId,
            product_id: 'pro_plus_monthly',
            entitlement_ids: ['pro', 'pro_plus'],
            expiration_at_ms: Date.now() + 1_000_000,
          },
        },
      })

      const profile = await app.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.json()).toMatchObject({ entitlement: { tier: 'pro_plus' } })
    })

    /**
     * The bug this branch exists for: an EXPIRATION says something ended, never
     * what is left. Written naively it drops a subscriber whose Pro+ lapsed —
     * but whose Pro is still running — all the way to free.
     */
    it('lands on Pro, not free, when Pro+ expires over a still-active Pro', async () => {
      const user = await newUser('webhook-expire-partial@example.com')
      fakeRevenueCat.unavailable = false
      fakeRevenueCat.next = {
        tier: 'pro',
        expiresAt: new Date(Date.now() + 1_000_000),
        productId: 'monthly',
        store: 'app_store',
      }

      await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-expire-partial',
            type: 'EXPIRATION',
            app_user_id: user.userId,
            entitlement_ids: ['pro_plus'],
          },
        },
      })

      const profile = await app.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.json()).toMatchObject({ entitlement: { tier: 'pro' } })
    })

    /**
     * A real TRANSFER payload has **no `app_user_id`** — the recipient is in
     * `transferred_to`. When the schema required `app_user_id`, every real
     * TRANSFER answered 400 and RevenueCat retried it forever. It also names
     * no entitlement, so the handler reconciles against RevenueCat.
     */
    it('accepts a TRANSFER without app_user_id and reconciles the recipient', async () => {
      const user = await newUser('webhook-transfer@example.com')
      fakeRevenueCat.unavailable = false
      fakeRevenueCat.next = {
        tier: 'pro_plus',
        expiresAt: new Date(Date.now() + 1_000_000),
        productId: 'pro_plus_monthly',
        store: 'app_store',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-transfer',
            type: 'TRANSFER',
            store: 'APP_STORE',
            transferred_from: ['some-old-account'],
            transferred_to: [user.userId],
          },
        },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ processed: true })

      const profile = await app.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.json()).toMatchObject({ entitlement: { tier: 'pro_plus' } })
    })

    /** With RevenueCat unreachable, a transfer still grants — the safe direction. */
    it('falls back to Pro on a TRANSFER when RevenueCat cannot be reached', async () => {
      const user = await newUser('webhook-transfer-offline@example.com')
      fakeRevenueCat.unavailable = true

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-transfer-offline',
            type: 'TRANSFER',
            transferred_to: [user.userId],
          },
        },
      })
      fakeRevenueCat.unavailable = false
      expect(response.statusCode, response.body).toBe(200)

      const profile = await app.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.json()).toMatchObject({ entitlement: { tier: 'pro' } })
    })

    /** Nobody named at all: recorded for audit, acked, nothing granted. */
    it('acks an event that names no user instead of erroring into a retry loop', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: { id: 'evt-nobody', type: 'TRANSFER', transferred_to: [] },
        },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ processed: true })
    })

    it('revokes to free on expiry when RevenueCat cannot be reached', async () => {
      const user = await newUser('webhook-expire-offline@example.com')

      // Grant first, so the revocation has something to take away.
      await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-expire-offline-grant',
            type: 'INITIAL_PURCHASE',
            app_user_id: user.userId,
            entitlement_ids: ['pro'],
          },
        },
      })

      fakeRevenueCat.unavailable = true
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/revenuecat',
        headers: { authorization: WEBHOOK_SECRET },
        payload: {
          event: {
            id: 'evt-expire-offline',
            type: 'EXPIRATION',
            app_user_id: user.userId,
            entitlement_ids: ['pro'],
          },
        },
      })
      fakeRevenueCat.unavailable = false

      // Still a clean 2xx: a non-2xx would put RevenueCat into a retry loop
      // over something the fallback already handled correctly.
      expect(response.statusCode, response.body).toBe(200)

      const profile = await app.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.json()).toMatchObject({ entitlement: { tier: 'free' } })
    })
  })

  describe('POST /billing/refresh', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'POST', url: '/billing/refresh' })
      expect(response.statusCode).toBe(401)
    })

    it('reconciles to Pro when RevenueCat reports an active entitlement', async () => {
      const user = await newUser('refresh-active@example.com')
      fakeRevenueCat.unavailable = false
      fakeRevenueCat.next = {
        tier: 'pro',
        expiresAt: new Date(Date.now() + 1_000_000),
        productId: 'monthly',
        store: 'play_store',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/billing/refresh',
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ tier: 'pro', store: 'play_store' })
    })

    it('reconciles to Pro+ when RevenueCat reports the higher entitlement', async () => {
      const user = await newUser('refresh-proplus@example.com')
      fakeRevenueCat.unavailable = false
      fakeRevenueCat.next = {
        tier: 'pro_plus',
        expiresAt: new Date(Date.now() + 1_000_000),
        productId: 'pro_plus_yearly',
        store: 'play_store',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/billing/refresh',
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ tier: 'pro_plus' })
    })

    it('reconciles to free when RevenueCat reports no active entitlement', async () => {
      const user = await newUser('refresh-inactive@example.com')
      fakeRevenueCat.unavailable = false
      fakeRevenueCat.next = null

      const response = await app.inject({
        method: 'POST',
        url: '/billing/refresh',
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ tier: 'free' })
    })
  })
})
