import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const LEGACY_SALT = 'test-legacy-salt'
const PASSWORD = 'correct horse battery staple'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: 'newuser',
    displayName: 'New User',
    birthYear: 1995,
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'B1', priority: 1 }],
    ...overrides,
  }
}

describe('Faz 2 — profiles, username claim, avatar upload', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, name = 'Test User'): Promise<SignedUpUser> {
    return signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_profiles_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_profiles_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: LEGACY_SALT,
    })

    // The real server calls this before serving traffic (index.ts) — without
    // it here, `profiles.handle`'s unique index doesn't exist and the whole
    // point of the handle-claim tests silently stops being tested.
    await ensureIndexes(handle.db)

    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    const storage = createStorageProvider(env)
    const translation = createTranslationProvider(env)
    const revenueCat = createRevenueCatClientFromEnv(env)
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage,
      translation,
      revenueCat,
    })
    await app.ready()

    // Same first-transaction warm-up as auth.test.ts — see its comment for why.
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

  it('rejects an unauthenticated onboarding attempt', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      payload: onboardingBody(),
    })
    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('creates a profile for a fresh (non-legacy) handle', async () => {
    const user = await newUser('fresh-handle@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'freshhandle' }),
    })

    expect(response.statusCode, response.body).toBe(201)
    expect(response.json()).toMatchObject({ _id: user.userId, handle: 'freshhandle' })
  })

  it('rejects a second profile for the same account', async () => {
    const user = await newUser('double-onboard@example.com')

    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'doubleonboard' }),
    })

    const second = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'doubleonboardtwo' }),
    })
    expect(second.statusCode).toBe(400)
  })

  it('rejects an underage birthYear even though the client already validated it', async () => {
    const user = await newUser('underage-attempt@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({
        handle: 'underageuser',
        birthYear: new Date().getUTCFullYear() - 10,
      }),
    })

    // Caught by the shared zod schema before the handler even runs.
    expect(response.statusCode).toBe(400)
  })

  it('rejects two profiles claiming the same fresh handle — the unique index is the real guard', async () => {
    const first = await newUser('handle-race-1@example.com')
    const second = await newUser('handle-race-2@example.com')

    const firstAttempt = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: first.cookie },
      payload: onboardingBody({ handle: 'contestedhandle' }),
    })
    expect(firstAttempt.statusCode, firstAttempt.body).toBe(201)

    const secondAttempt = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: second.cookie },
      payload: onboardingBody({ handle: 'contestedhandle' }),
    })
    expect(secondAttempt.statusCode).toBe(409)
    expect(secondAttempt.json()).toMatchObject({ code: 'HANDLE_TAKEN' })
  })

  it('claims a reserved handle when the verified email matches the legacy reservation', async () => {
    const email = 'returning-v1-user@example.com'
    const legacyEmailHash = hashLegacyEmail(email, LEGACY_SALT)
    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'returninguser',
      legacyEmailHash,
      legacyUserId: 'appwrite-legacy-id-1',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })

    const user = await newUser(email)

    // The onboarding UI's "your old handle is waiting" check.
    const reservationCheck = await app.inject({
      method: 'GET',
      url: '/handle-reservation',
      headers: { cookie: user.cookie },
    })
    expect(reservationCheck.json()).toMatchObject({ reservation: { handle: 'returninguser' } })

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'returninguser' }),
    })
    expect(response.statusCode, response.body).toBe(201)

    const reservation = await handle.db
      .collection(COLLECTIONS.handleReservations)
      .findOne({ handle: 'returninguser' })
    expect(reservation?.claimedBy).toBe(user.userId)
  })

  it('refuses a reserved handle when the verified email does NOT match — the core Faz 2 gate', async () => {
    const ownerEmail = 'rightful-owner@example.com'
    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'protectedhandle',
      legacyEmailHash: hashLegacyEmail(ownerEmail, LEGACY_SALT),
      legacyUserId: 'appwrite-legacy-id-2',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })

    const impostor = await newUser('wrong-email-attempt@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: impostor.cookie },
      payload: onboardingBody({ handle: 'protectedhandle' }),
    })
    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'HANDLE_RESERVED' })

    const reservation = await handle.db
      .collection(COLLECTIONS.handleReservations)
      .findOne({ handle: 'protectedhandle' })
    expect(reservation?.claimedBy).toBeUndefined()
  })

  it('treats an expired reservation as a free handle', async () => {
    const email = 'too-late-to-claim@example.com'
    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'expiredhandle',
      legacyEmailHash: hashLegacyEmail(email, LEGACY_SALT),
      legacyUserId: 'appwrite-legacy-id-3',
      expiresAt: new Date(Date.now() - 1000),
    })

    const user = await newUser(email)
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'expiredhandle' }),
    })
    expect(response.statusCode, response.body).toBe(201)
  })

  it('reports handle availability correctly', async () => {
    const user = await newUser('availability-checker@example.com')

    const available = await app.inject({
      method: 'GET',
      url: '/handles/somefreehandle/availability',
      headers: { cookie: user.cookie },
    })
    expect(available.json()).toEqual({ available: true })

    const taken = await app.inject({
      method: 'GET',
      url: '/handles/freshhandle/availability', // claimed by an earlier test
      headers: { cookie: user.cookie },
    })
    expect(taken.json()).toEqual({ available: false })
  })

  it('gets and updates the profile it just created', async () => {
    const user = await newUser('crud-flow@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'crudflow' }),
    })

    const got = await app.inject({
      method: 'GET',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
    })
    const gotBody = got.json<Record<string, unknown>>()
    expect(gotBody).toMatchObject({ handle: 'crudflow' })
    expect('bio' in gotBody).toBe(false) // never set, so never written at all

    const updated = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
      payload: { bio: 'Hello from the test suite' },
    })
    expect(updated.statusCode, updated.body).toBe(200)
    expect(updated.json()).toMatchObject({ bio: 'Hello from the test suite', handle: 'crudflow' })
  })

  it('rejects an update that makes a learning language also native', async () => {
    const user = await newUser('overlap-update@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'overlapupdate' }),
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
      payload: {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'en', level: 'B1', priority: 1 }],
      },
    })
    expect(response.statusCode).toBe(400)
  })

  it('avatar upload-url fails clearly when storage is not configured', async () => {
    const user = await newUser('avatar-unconfigured@example.com')

    const uploadUrl = await app.inject({
      method: 'POST',
      url: '/me/avatar/upload-url',
      headers: { cookie: user.cookie },
      payload: { contentType: 'image/png' },
    })
    expect(uploadUrl.statusCode).toBe(500)
  })

  describe('with storage configured', () => {
    // A presigned URL is pure local signing — @aws-sdk/s3-request-presigner
    // never makes a network call to produce one — so a syntactically valid
    // but fake endpoint exercises the real code path with no live bucket.
    let configuredApp: FastifyInstance

    beforeAll(async () => {
      const env = loadEnv({
        NODE_ENV: 'test',
        MONGODB_URI: replSet.getUri(),
        MONGODB_DB: 'langx_profiles_test',
        LOG_LEVEL: 'silent',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        BETTER_AUTH_URL: 'http://localhost:4000',
        LEGACY_EMAIL_HASH_SALT: LEGACY_SALT,
        STORAGE_ENDPOINT: 'https://fake-r2.example.com',
        STORAGE_BUCKET: 'langx-avatars-test',
        STORAGE_ACCESS_KEY_ID: 'fake-access-key-id',
        STORAGE_SECRET_ACCESS_KEY: 'fake-secret-access-key',
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
      })
      const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
      const storage = createStorageProvider(env)
      const translation = createTranslationProvider(env)
      const revenueCat = createRevenueCatClientFromEnv(env)
      configuredApp = await buildApp({
        env,
        client: handle.client,
        db: handle.db,
        auth,
        storage,
        translation,
        revenueCat,
      })
      await configuredApp.ready()
    })

    afterAll(async () => {
      await configuredApp?.close()
    })

    it('returns a presigned upload URL under the public base, and confirm accepts it', async () => {
      const user = await newUser('avatar-configured@example.com')
      await configuredApp.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: 'avatarconfigured' }),
      })

      const uploadUrl = await configuredApp.inject({
        method: 'POST',
        url: '/me/avatar/upload-url',
        headers: { cookie: user.cookie },
        payload: { contentType: 'image/png' },
      })
      expect(uploadUrl.statusCode, uploadUrl.body).toBe(200)
      const body = uploadUrl.json<{ uploadUrl: string; publicUrl: string }>()
      expect(body.publicUrl).toMatch(
        new RegExp(`^https://cdn\\.example\\.com/avatars/${user.userId}/.+\\.png$`),
      )
      expect(body.uploadUrl).toContain('fake-r2.example.com')

      const confirm = await configuredApp.inject({
        method: 'POST',
        url: '/me/avatar/confirm',
        headers: { cookie: user.cookie },
        payload: { avatarUrl: body.publicUrl },
      })
      expect(confirm.statusCode, confirm.body).toBe(200)
      expect(confirm.json()).toMatchObject({ avatarUrl: body.publicUrl })
    })

    it('rejects a confirm URL that does not point into our own bucket', async () => {
      const user = await newUser('avatar-foreign-url@example.com')
      await configuredApp.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: 'avatarforeign' }),
      })

      const confirm = await configuredApp.inject({
        method: 'POST',
        url: '/me/avatar/confirm',
        headers: { cookie: user.cookie },
        payload: { avatarUrl: 'https://evil.example.com/not-our-bucket.png' },
      })
      expect(confirm.statusCode).toBe(400)
      expect(confirm.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
    })
  })
})
