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
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const LEGACY_SALT = 'test-legacy-salt'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

describe('POST /profiles/me/handle — the one rename, for v1 accounts', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, onboarding: Record<string, unknown> = {}) {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(onboarding),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  /**
   * Marks a profile as having come back from v1.
   *
   * Written directly rather than driven through a real restore: what is under
   * test here is the claim's own rules, and `legacyRestore.test.ts` already
   * proves that a returning account ends up with this field. Staging a whole
   * `legacyProfiles` fixture to obtain one boolean would test that file twice
   * and this one less clearly.
   */
  async function asReturningV1User(user: SignedUpUser, v1Handle: string) {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      { _id: user.userId },
      {
        $set: {
          handle: v1Handle,
          restoredFromV1: {
            at: new Date(),
            tokensCredited: 0,
            frozenStreak: 0,
            conversationsImported: 0,
          },
        },
      },
    )
  }

  function claim(user: SignedUpUser, newHandle: string) {
    return app.inject({
      method: 'POST',
      url: '/profiles/me/handle',
      headers: { cookie: user.cookie },
      payload: { handle: newHandle },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_claim_handle_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_claim_handle_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: LEGACY_SALT,
    })

    // Without this the uniques do not exist, and the races these tests are
    // about stop being races.
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
      email: emailSender,
    })
    await app.ready()

    // Same first-transaction warm-up as the other route suites.
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

  it('refuses an account that never came from v1', async () => {
    const user = await newUser('never-v1@example.com')
    const response = await claim(user, 'brandnewname')
    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('lets a returning v1 account trade the generated name for one of its own', async () => {
    const user = await newUser('v1-renamer@example.com')
    await asReturningV1User(user, 'langx_6430')

    const response = await claim(user, 'sofia')
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toMatchObject({ handle: 'sofia', previousHandle: 'langx_6430' })
  })

  it('keeps the old name working, and keeps it out of everybody else’s reach', async () => {
    const user = await newUser('v1-old-links@example.com')
    await asReturningV1User(user, 'langx_003c')
    expect((await claim(user, 'mirayb')).statusCode).toBe(200)

    // The v1 link somebody shared years ago.
    const shared = await app.inject({ method: 'GET', url: '/public/profiles/langx_003c' })
    expect(shared.statusCode, shared.body).toBe(200)
    expect(shared.json()).toMatchObject({ handle: 'mirayb' })

    // And a signed-in lookup by the old name, which is what a deep link does.
    const viewer = await newUser('v1-old-links-viewer@example.com')
    const lookup = await app.inject({
      method: 'GET',
      url: '/profiles/langx_003c',
      headers: { cookie: viewer.cookie },
    })
    expect(lookup.statusCode, lookup.body).toBe(200)
    expect(lookup.json()).toMatchObject({ handle: 'mirayb' })

    // Nobody may be handed it — not through the availability check…
    const availability = await app.inject({
      method: 'GET',
      url: '/handles/langx_003c/availability',
      headers: { cookie: viewer.cookie },
    })
    expect(availability.json()).toMatchObject({ available: false })

    // …and not through onboarding, which is the path that actually writes.
    const newcomer = await signUpAndSignIn(app, emailSender, {
      email: 'squatter@example.com',
      password: PASSWORD,
      name: 'T',
    })
    const squat = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: newcomer.cookie },
      payload: onboardingBody({ handle: 'langx_003c' }),
    })
    expect(squat.statusCode).toBe(409)
    expect(squat.json()).toMatchObject({ code: 'HANDLE_TAKEN' })
  })

  it('answers the activity map and the summary at the old name too', async () => {
    // The profile route resolved `previousHandle` from the start; these two
    // read the same person by the same key and used not to, so a deep link
    // carrying a v1 name opened a profile with its numbers missing.
    const user = await newUser('v1-old-activity@example.com')
    await asReturningV1User(user, 'langx_0114')
    expect((await claim(user, 'deniz')).statusCode).toBe(200)

    const viewer = await newUser('v1-old-activity-viewer@example.com')
    const range = 'from=2026-01-01&to=2026-01-31'

    for (const url of [`/profiles/langx_0114/activity?${range}`, '/profiles/langx_0114/summary']) {
      const response = await app.inject({ method: 'GET', url, headers: { cookie: viewer.cookie } })
      expect(response.statusCode, `${url} — ${response.body}`).toBe(200)
    }
  })

  it('still attributes an invite link that carries the old name', async () => {
    // Every failure in `attachReferral` is silent, so this one cost the
    // referrer their tokens without anybody being told. Their links are years
    // old by construction — they are the accounts that came back from v1.
    const referrer = await newUser('v1-old-invite@example.com')
    await asReturningV1User(referrer, 'langx_0125')
    expect((await claim(referrer, 'yusuf')).statusCode).toBe(200)

    const invitee = await signUpAndSignIn(app, emailSender, {
      email: 'v1-old-invite-guest@example.com',
      password: PASSWORD,
      name: 'T',
    })
    const onboarded = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: invitee.cookie },
      payload: onboardingBody({ referredByHandle: 'langx_0125', referredBySource: 'link' }),
    })
    expect(onboarded.statusCode, onboarded.body).toBe(201)

    const row = await handle.db
      .collection(COLLECTIONS.referrals)
      .findOne({ _id: invitee.userId as never })
    expect(row).toMatchObject({ referrerId: referrer.userId })
  })

  it('allows exactly one claim', async () => {
    const user = await newUser('v1-twice@example.com')
    await asReturningV1User(user, 'langx_00a5')

    expect((await claim(user, 'firstchoice')).statusCode).toBe(200)

    const second = await claim(user, 'secondthoughts')
    expect(second.statusCode).toBe(409)
    expect(second.json()).toMatchObject({ code: 'HANDLE_ALREADY_CLAIMED' })

    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: user.userId })
    expect(profile?.handle).toBe('firstchoice')
  })

  it('refuses a name somebody else holds', async () => {
    await newUser('v1-taken-owner@example.com', { handle: 'alreadymine' })
    const user = await newUser('v1-taken-claimer@example.com')
    await asReturningV1User(user, 'langx_00d2')

    const response = await claim(user, 'alreadymine')
    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'HANDLE_TAKEN' })
  })

  it('refuses a reserved word and a name reserved for another v1 account', async () => {
    const user = await newUser('v1-reserved@example.com')
    await asReturningV1User(user, 'langx_00e4')

    const reservedWord = await claim(user, 'admin')
    expect(reservedWord.statusCode).toBe(400)
    expect(reservedWord.json()).toMatchObject({ code: 'VALIDATION_FAILED' })

    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'someoneelse',
      legacyEmailHash: hashLegacyEmail('a-different-v1-user@example.com', LEGACY_SALT),
      legacyUserId: 'appwrite-legacy-id-claim-1',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    const reservedForOther = await claim(user, 'someoneelse')
    expect(reservedForOther.statusCode).toBe(409)
    expect(reservedForOther.json()).toMatchObject({ code: 'HANDLE_RESERVED' })
  })

  it('lets a v1 account take back the handle reserved for it, floor and all', async () => {
    const email = 'v1-takes-own-reservation@example.com'
    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'ada',
      legacyEmailHash: hashLegacyEmail(email, LEGACY_SALT),
      legacyUserId: 'appwrite-legacy-id-claim-2',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })

    // Onboarded under a made-up name rather than the reservation — the case
    // this route exists for, and the reason the floor cannot be a schema rule.
    const user = await newUser(email, { handle: 'somethingelse' })
    await asReturningV1User(user, 'langx_00ec')

    const response = await claim(user, 'ada')
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toMatchObject({ handle: 'ada' })

    const reservation = await handle.db
      .collection(COLLECTIONS.handleReservations)
      .findOne({ handle: 'ada' })
    expect(reservation?.claimedBy).toBe(user.userId)
  })

  it('refuses the name the account already has, rather than spending the claim on it', async () => {
    const user = await newUser('v1-no-op@example.com')
    await asReturningV1User(user, 'langx_00f3')

    const response = await claim(user, 'langx_00f3')
    expect(response.statusCode).toBe(400)

    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: user.userId })
    expect(profile?.previousHandle).toBeUndefined()
  })

  it('refuses an unauthenticated claim', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/profiles/me/handle',
      payload: { handle: 'anything' },
    })
    expect(response.statusCode).toBe(401)
  })
})
