import { TOKEN_RULES } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app'
import { createAuth } from '../../auth'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { loadEnv } from '../../env'
import { authId } from '../../lib/authId'
import { createRevenueCatClientFromEnv } from '../billing/createRevenueCatClient'
import { createStorageProvider } from '../../storage/createStorageProvider'
import { CapturingEmailSender, setCookieValue } from '../../testSupport/authFlow'
import { createTranslationProvider } from '../../translation/createTranslationProvider'
import { hashLegacyEmail } from './legacyEmailHash'
import { insertPrecreatedUser } from './legacyPrecreate'
import type { LegacyProfile } from './legacyProfiles'

const SALT = 'test-legacy-salt'
const NEW_PASSWORD = 'a brand new horse staple'

describe('pre-created v1 users: reset password → sign in → restored', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  function stageLegacy(email: string, overrides: Partial<LegacyProfile> = {}) {
    const record: LegacyProfile = {
      _id: `appwrite-${email}`,
      handle: 'oldtimer',
      legacyEmailHash: hashLegacyEmail(email, SALT),
      displayName: 'Old Timer',
      birthDate: '1990-06-15',
      gender: 'other',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      photos: [],
      migratedAt: new Date(),
      legacyTokenBalance: 5000,
      ...overrides,
    }
    return handle.db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).insertOne(record)
  }

  const signIn = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/auth/sign-in/email', payload: { email, password } })

  async function resetPassword(email: string, newPassword: string): Promise<void> {
    const forgot = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      payload: { email, redirectTo: 'http://localhost:4000/reset' },
    })
    expect(forgot.statusCode, forgot.body).toBe(200)
    const tokenMatch = /\/reset-password\/([^/?]+)/.exec(emailSender.latestUrl())
    if (!tokenMatch?.[1]) throw new Error('no token in reset URL')
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { newPassword, token: decodeURIComponent(tokenMatch[1]) },
    })
    expect(reset.statusCode, reset.body).toBe(200)
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_precreate_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_precreate_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: SALT,
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

    // See auth.test.ts: a fresh single-node replica set's first transaction
    // through the adapter is flaky, so the first real request is a warm-up.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: NEW_PASSWORD, name: 'Warm' },
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

  it('opens a verified, passwordless row once; a second run leaves it alone', async () => {
    const email = 'Twice@Example.com'
    const first = await insertPrecreatedUser(handle.db, {
      email,
      name: 'Twice',
      legacyUserId: 'appwrite-twice',
    })
    const second = await insertPrecreatedUser(handle.db, {
      email,
      name: 'Twice again',
      legacyUserId: 'appwrite-twice',
    })
    expect(first.outcome).toBe('inserted')
    expect(second).toEqual({ outcome: 'exists', userId: first.userId })

    const stored = await handle.db
      .collection(COLLECTIONS.user)
      .findOne({ _id: authId(first.userId) })
    expect(stored).toMatchObject({ email: 'twice@example.com', emailVerified: true, name: 'Twice' })
    expect(stored?.terms).toBeUndefined()
    const accounts = await handle.db
      .collection(COLLECTIONS.account)
      .countDocuments({ userId: { $in: [authId(first.userId), first.userId] } })
    expect(accounts).toBe(0)
  })

  it('cannot be signed into before the reset; signing up over it sends the "already have an account" mail', async () => {
    const email = 'locked@example.com'
    await insertPrecreatedUser(handle.db, {
      email,
      name: 'Locked',
      legacyUserId: 'appwrite-locked',
    })

    const guess = await signIn(email, 'whatever they used in v1')
    expect(guess.statusCode).toBe(401)

    const again = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: NEW_PASSWORD, name: 'Impostor' },
    })
    // Better Auth answers exactly as it would a fresh sign-up so the form
    // cannot enumerate addresses — but it must create nothing, and the mail
    // that goes out must be the one that says what to do instead.
    expect(again.statusCode).toBe(200)
    expect(emailSender.messages.at(-1)).toMatchObject({
      to: email,
      subject: expect.stringMatching(/already/i) as string,
    })
    expect(emailSender.latestUrl()).toContain('/forgot-password')
    const impostor = await signIn(email, NEW_PASSWORD)
    expect(impostor.statusCode).toBe(401)
    const user = await handle.db.collection(COLLECTIONS.user).findOne({ email })
    expect(user).toMatchObject({ name: 'Locked', emailVerified: true })
    const accounts = await handle.db
      .collection(COLLECTIONS.account)
      .countDocuments({ userId: { $in: [authId(String(user?._id)), String(user?._id)] } })
    expect(accounts).toBe(0)
  })

  it('reset → sign-in restores the v1 profile and stamps the terms, exactly once', async () => {
    const email = 'returning@example.com'
    await stageLegacy(email)
    const { userId } = await insertPrecreatedUser(handle.db, {
      email,
      name: 'Old Timer',
      legacyUserId: `appwrite-${email}`,
    })

    // The row is the whole point: with it, the reset finds someone to mail.
    await resetPassword(email, NEW_PASSWORD)

    const session = await signIn(email, NEW_PASSWORD)
    expect(session.statusCode, session.body).toBe(200)
    const cookie = setCookieValue(session)

    const me = await app.inject({ method: 'GET', url: '/profiles/me', headers: { cookie } })
    expect(me.statusCode, me.body).toBe(200)
    const profile = me.json<{ handle: string; displayName: string; restoredFromV1?: unknown }>()
    expect(profile).toMatchObject({ handle: 'oldtimer', displayName: 'Old Timer' })
    expect(profile.restoredFromV1).toMatchObject({ tokensCredited: expect.any(Number) as number })

    const user = await handle.db.collection(COLLECTIONS.user).findOne({ _id: authId(userId) })
    expect(user?.terms).toMatchObject({ version: expect.any(String) as string })
    const firstAcceptedAt = (user?.terms as { acceptedAt: Date }).acceptedAt

    // A second session must not pay the welcome-back bonus twice or move the
    // consent date — sessions are created on every sign-in.
    const secondSession = await signIn(email, NEW_PASSWORD)
    expect(secondSession.statusCode).toBe(200)
    const welcomeBacks = await handle.db
      .collection(COLLECTIONS.tokenLedger)
      .countDocuments({ userId, kind: 'welcomeBack' })
    expect(welcomeBacks).toBe(1)
    expect(TOKEN_RULES.welcomeBackBonus).toBeGreaterThan(0)
    const userAgain = await handle.db.collection(COLLECTIONS.user).findOne({ _id: authId(userId) })
    expect((userAgain?.terms as { acceptedAt: Date }).acceptedAt).toEqual(firstAcceptedAt)
  })

  it('an ordinary sign-up is untouched by the session hook', async () => {
    const email = 'fresh@example.com'
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: NEW_PASSWORD, name: 'Fresh' },
    })
    await resetPassword(email, NEW_PASSWORD)
    // Still unverified — the reset does not verify, and the hook must not
    // pretend otherwise for a row the script never wrote.
    const blocked = await signIn(email, NEW_PASSWORD)
    expect(blocked.statusCode).toBe(403)
    const user = await handle.db.collection(COLLECTIONS.user).findOne({ email })
    expect(user?.precreatedFromV1).toBeUndefined()
    expect(user?.emailVerified).toBe(false)
  })
})
