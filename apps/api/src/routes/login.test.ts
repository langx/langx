import { TOKEN_RULES, convertLegacyTokens, type LoginResult } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'
import type { LegacyVerifier } from '../modules/handles/legacyLogin'
import type { LegacyProfile } from '../modules/handles/legacyProfiles'
import { toPublicProfile, type Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const SALT = 'test-legacy-salt'

/** Stands in for the live v1 Appwrite, and records whether it was consulted. */
class FakeVerifier implements LegacyVerifier {
  readonly calls: string[] = []
  constructor(private readonly accept: Record<string, string> = {}) {}
  verify(email: string, password: string): Promise<boolean> {
    this.calls.push(email)
    return Promise.resolve(this.accept[email] === password)
  }
}

describe('sign-in, and the bridge to v1 behind it', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let verifier: FakeVerifier

  function stageLegacy(
    overrides: Partial<LegacyProfile> & { email: string },
    omit: (keyof LegacyProfile)[] = [],
  ) {
    const { email, ...rest } = overrides
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
      ...rest,
    }
    for (const key of omit) delete record[key]
    return handle.db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).insertOne(record)
  }

  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_login_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_login_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: SALT,
    })
    await ensureIndexes(handle.db)
    emailSender = new CapturingEmailSender()
    verifier = new FakeVerifier({
      'returning@example.com': 'my-v1-password',
      'incomplete@example.com': 'their-old-v1-password',
    })
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
      legacyVerifier: verifier,
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

  it('never forwards a password for an address with no v1 account', async () => {
    // The single most important property: a new user's password must not leave
    // this system just because they mistyped it.
    verifier.calls.length = 0
    const response = await login('brand-new@example.com', 'whatever')

    expect(response.statusCode).toBe(401)
    expect(verifier.calls).toHaveLength(0)
  })

  it('answers a miss and a hit in comparable time, so it is not an email oracle', async () => {
    // Same message either way is not enough: a match costs a round trip to v1
    // and a miss returns immediately, so timing alone would separate "this
    // address had a v1 account" from "it did not" — across the whole user list.
    await stageLegacy({
      email: 'timing-probe@example.com',
      _id: 'appwrite-timing',
      handle: 'timing',
    })

    const time = async (email: string) => {
      const start = Date.now()
      await login(email, 'wrong-password')
      return Date.now() - start
    }
    const known = await time('timing-probe@example.com')
    const unknown = await time('definitely-not-a-user@example.com')

    // Both are padded to the same floor; the gap is noise, not signal.
    expect(Math.abs(known - unknown)).toBeLessThan(250)
  })

  it('signs in a normal v2 user without touching v1 at all', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: 'normal@example.com', password: PASSWORD, name: 'Normal' },
    })
    const verifyUrl = emailSender.latestUrl()
    await app.inject({ method: 'GET', url: verifyUrl.replace(/^https?:\/\/[^/]+/, '') })

    verifier.calls.length = 0
    const response = await login('normal@example.com', PASSWORD)

    expect(response.statusCode, response.body).toBe(200)
    expect(response.json<LoginResult>().migratedFromV1).toBe(false)
    expect(verifier.calls).toHaveLength(0)
    expect(response.headers['set-cookie']).toBeTruthy()
  })

  it('lets a returning v1 user in with their old password, profile already restored', async () => {
    await stageLegacy({
      email: 'returning@example.com',
      _id: 'appwrite-returning',
      handle: 'returninguser',
      displayName: 'Returning User',
      frozenStreak: 12,
      legacyTokenBalance: 9136,
    })

    const response = await login('returning@example.com', 'my-v1-password')
    expect(response.statusCode, response.body).toBe(200)

    const body = response.json<LoginResult>()
    expect(body.migratedFromV1).toBe(true)
    expect(body.restored?.handle).toBe('returninguser')
    expect(body.restored?.frozenStreak).toBe(12)
    expect(body.restored?.tokensCredited).toBe(convertLegacyTokens(9136))
    expect(response.headers['set-cookie']).toBeTruthy()

    // The profile exists without the user ever seeing an onboarding form.
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'returninguser' })
    expect(profile?.displayName).toBe('Returning User')
    expect(profile?.learning[0]?.code).toBe('en')
    // The streak comes back alive, not as a souvenir: the length is theirs
    // again and today already counts, so tomorrow is the first day they have
    // to show up for.
    expect(profile?.streak.longest).toBe(12)
    expect(profile?.streak.current).toBe(12)
    expect(profile?.streak.lastQualifiedDay).toBeTruthy()
  })

  /**
   * The return value of a restore only reaches whichever request triggered it,
   * and that is regularly not the device the user is holding — an email link
   * clicked on a laptop restores the account while the phone learns nothing.
   * So it is written down, and the welcome-back screen reads it there.
   */
  it('records what came back on the profile, not only in the response', async () => {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'returninguser' })

    expect(profile?.restoredFromV1).toMatchObject({
      tokensCredited: convertLegacyTokens(9136),
      frozenStreak: 12,
      conversationsImported: 0,
    })
    expect(profile?.restoredFromV1?.at).toBeInstanceOf(Date)
    // Nothing has dismissed it yet, so the screen is still owed.
    expect(profile?.restoredFromV1?.acknowledgedAt).toBeUndefined()
  })

  it('dismisses the welcome-back screen once, and stays dismissed', async () => {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'returninguser' })
    const cookie = (
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: 'returning@example.com', password: 'my-v1-password' },
      })
    ).headers['set-cookie']

    const ack = () =>
      app.inject({
        method: 'POST',
        url: '/me/welcome-back/ack',
        headers: { cookie: Array.isArray(cookie) ? cookie.join('; ') : (cookie ?? '') },
      })

    expect((await ack()).statusCode).toBe(204)
    const first = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: profile!._id })
    const at = first?.restoredFromV1?.acknowledgedAt
    expect(at).toBeInstanceOf(Date)

    // A replay must not move the timestamp — it is a latch, not a heartbeat.
    expect((await ack()).statusCode).toBe(204)
    const second = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: profile!._id })
    expect(second?.restoredFromV1?.acknowledgedAt).toEqual(at)
  })

  /** It is nobody else's business that this account came from v1. */
  it('never shows the restore on a public profile', async () => {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'returninguser' })
    expect(profile?.restoredFromV1).toBeTruthy()
    expect(
      toPublicProfile(profile!, true, { followers: 0, following: 0, viewerFollows: false }),
    ).not.toHaveProperty('restoredFromV1')
  })

  it('credits the v1 economy exactly once, however many times sign-in is retried', async () => {
    const before = await handle.db
      .collection<{ amount: number }>(COLLECTIONS.tokenLedger)
      .find({ refId: 'appwrite-returning' })
      .toArray()

    await login('returning@example.com', 'my-v1-password')
    await login('returning@example.com', 'my-v1-password')

    const after = await handle.db
      .collection<{ amount: number }>(COLLECTIONS.tokenLedger)
      .find({ refId: 'appwrite-returning' })
      .toArray()

    // One conversion row and one welcome-back row, no more.
    expect(after).toHaveLength(before.length)
    expect(after).toHaveLength(2)
    expect(after.map((r) => r.amount).sort((a, b) => a - b)).toEqual(
      [convertLegacyTokens(9136), TOKEN_RULES.welcomeBackBonus].sort((a, b) => a - b),
    )
  })

  it('refuses the old password when v1 says no', async () => {
    await stageLegacy({
      email: 'wrongpass@example.com',
      _id: 'appwrite-wrong',
      handle: 'wrongpass',
    })
    const response = await login('wrongpass@example.com', 'not-their-password')
    expect(response.statusCode).toBe(401)
  })

  it('leaves an incomplete v1 record for onboarding rather than building a broken profile', async () => {
    // No birthDate means the age gate cannot be satisfied, and a profile
    // without it would be one the 18+ rule never actually checked.
    await stageLegacy(
      { email: 'incomplete@example.com', _id: 'appwrite-incomplete', handle: 'incomplete' },
      ['birthDate'],
    )

    const response = await login('incomplete@example.com', 'their-old-v1-password')
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json<LoginResult>().restored).toBeNull()

    // Still staged, so onboarding can pre-fill and finish the job.
    const staged = await handle.db
      .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
      .findOne({ _id: 'appwrite-incomplete' })
    expect(staged?.restoredBy).toBeUndefined()
  })
})
