import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { UserStats } from '../modules/analytics/stats'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const DB = 'langx_admin_stats_test'

describe('GET /admin/stats', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let adminCookie: string
  let memberCookie: string

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), DB)
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: DB,
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: 'test-legacy-salt',
    })

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

    const admin = await signUpAndSignIn(app, emailSender, {
      email: 'admin@example.com',
      password: PASSWORD,
      name: 'Ad Min',
    })
    adminCookie = admin.cookie

    const member = await signUpAndSignIn(app, emailSender, {
      email: 'member@example.com',
      password: PASSWORD,
      name: 'Mem Ber',
    })
    memberCookie = member.cookie

    /*
     * Better Auth mints the id, so there is no id to configure before the
     * sign-up that produces it. The guard reads the list per request, which is
     * what lets the test name an admin after it has one.
     */
    app.env.ADMIN_USER_IDS = [admin.userId]

    // The two populations that make the bare collection count a bad answer.
    await handle.db.collection(COLLECTIONS.user).insertMany([
      {
        _id: new ObjectId(),
        email: 'guest@example.com',
        isAnonymous: true,
        createdAt: new Date(),
      },
      {
        _id: new ObjectId(),
        email: 'from-v1@example.com',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        precreatedFromV1: { at: new Date(), legacyUserId: 'appwrite-id' },
      },
    ])
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('refuses a request with no session', async () => {
    const response = await app.inject({ method: 'GET', url: '/admin/stats' })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('refuses a signed-in user who is not an admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { cookie: memberCookie },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  /**
   * The assertion that carries the endpoint's reason for existing: `total`
   * counts rows, and the breakdown is what stops a guest session and a v1
   * address nobody has claimed from being read as people who showed up.
   */
  it('counts each population apart for an admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { cookie: adminCookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<UserStats>()
    const rows = await handle.db.collection(COLLECTIONS.user).countDocuments()

    expect(body.total).toBe(rows)
    expect(body.guests).toBe(1)
    expect(body.fromV1).toBe(1)
    // Nobody onboarded: every row here is a sign-up without a profile.
    expect(body.onboarded).toBe(0)
    // Everything but the 30-day-old v1 row was created by this test just now.
    expect(body.newLast24h).toBe(rows - 1)
    expect(body.newLast7d).toBe(rows - 1)
    expect(body.lastSignUpAt).toEqual(expect.any(String))
  })
})
