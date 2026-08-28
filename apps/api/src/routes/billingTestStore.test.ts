import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

/**
 * The local purchase harness, from the outside.
 *
 * `fakeRevenueCat.test.ts` covers the fake store on its own; this covers the
 * thing it was built for — that a purchase made through the API arrives in
 * `profiles.entitlement` by way of the real webhook handler, and that
 * `/billing/refresh` afterwards agrees with it. Nothing here is stubbed: the
 * client comes from `createRevenueCatClientFromEnv` exactly as it does at boot,
 * chosen only by the environment flag.
 */
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

describe('POST /billing/test-event (REVENUECAT_FAKE_STORE)', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

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

  /** Only the half the assertions read — the event id is echoed back too, and never checked here. */
  interface TestEventResponse {
    entitlement?: { tier: string; willRenew?: boolean; store?: string }
  }

  function testEvent(user: SignedUpUser, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/billing/test-event',
      headers: { cookie: user.cookie },
      payload,
    })
  }

  function refresh(user: SignedUpUser) {
    return app.inject({
      method: 'POST',
      url: '/billing/refresh',
      headers: { cookie: user.cookie },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_test_store')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_test_store',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      REVENUECAT_FAKE_STORE: 'true',
      // Set on purpose: the flag has to win over a real key, or a developer
      // with one left in their .env would fire simulated purchases at the live
      // dashboard. If precedence ever flips, every case below fails at once.
      REVENUECAT_SECRET_API_KEY: 'sk_would_be_a_real_key',
    })

    await ensureIndexes(handle.db)

    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
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

  it('requires a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/billing/test-event',
      payload: { action: 'purchase', packageId: '$rc_monthly' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('rejects a purchase with no package named', async () => {
    const user = await newUser('no-package@example.com')
    const response = await testEvent(user, { action: 'purchase' })
    expect(response.statusCode).toBe(400)
  })

  it('rejects a package identifier nothing sells', async () => {
    const user = await newUser('bad-package@example.com')
    const response = await testEvent(user, { action: 'purchase', packageId: 'not_a_package' })
    expect(response.statusCode).toBe(400)
  })

  it('writes the bought tier onto the profile', async () => {
    const user = await newUser('buys-pro@example.com')
    const response = await testEvent(user, { action: 'purchase', packageId: '$rc_monthly' })

    expect(response.statusCode, response.body).toBe(200)
    expect(response.json<TestEventResponse>().entitlement).toMatchObject({
      tier: 'pro',
      willRenew: true,
      store: 'fake_store',
    })
  })

  it('writes pro_plus for a Pro+ package, not the tier a bare grant would default to', async () => {
    const user = await newUser('buys-plus@example.com')
    const response = await testEvent(user, { action: 'purchase', packageId: 'pro_plus_yearly' })

    expect(response.json<TestEventResponse>().entitlement).toMatchObject({ tier: 'pro_plus' })
  })

  /**
   * The point of the harness. `/billing/refresh` reconciles from RevenueCat
   * rather than from what the client claims, so a purchase that did not reach
   * the fake store's own records would be erased here — the same way a
   * database-only grant is erased in production.
   */
  it('survives the reconcile the paywall runs after a purchase', async () => {
    const user = await newUser('refresh-after-buy@example.com')
    await testEvent(user, { action: 'purchase', packageId: 'pro_plus_monthly' })

    const response = await refresh(user)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toMatchObject({ tier: 'pro_plus' })
  })

  it('keeps access after a cancellation and only stops the renewal', async () => {
    const user = await newUser('cancels@example.com')
    await testEvent(user, { action: 'purchase', packageId: '$rc_monthly' })

    const response = await testEvent(user, { action: 'cancel' })
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json<TestEventResponse>().entitlement).toMatchObject({
      tier: 'pro',
      willRenew: false,
    })
  })

  it('drops to free on expiry', async () => {
    const user = await newUser('expires@example.com')
    await testEvent(user, { action: 'purchase', packageId: '$rc_monthly' })

    const response = await testEvent(user, { action: 'expire' })
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json<TestEventResponse>().entitlement).toMatchObject({ tier: 'free' })
    expect((await refresh(user)).json()).toMatchObject({ tier: 'free' })
  })

  it('refuses to cancel something that was never bought', async () => {
    const user = await newUser('nothing-to-cancel@example.com')
    const response = await testEvent(user, { action: 'cancel' })
    expect(response.statusCode).toBe(400)
  })

  /**
   * A purchase is one person's. The route reads the buyer from the session and
   * never from the body, so a user id smuggled in cannot move entitlement onto
   * somebody else's profile.
   */
  it('ignores an app_user_id in the body', async () => {
    const buyer = await newUser('smuggler@example.com')
    const victim = await newUser('bystander@example.com')

    await testEvent(buyer, {
      action: 'purchase',
      packageId: '$rc_monthly',
      app_user_id: victim.userId,
    })

    expect((await refresh(victim)).json()).toMatchObject({ tier: 'free' })
  })
})
