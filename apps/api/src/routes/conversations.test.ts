import { PLAN_LIMITS } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

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

describe('Faz 4 — starting a conversation', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, profileOverrides: Record<string, unknown> = {}) {
    const user = await signUpAndSignIn(app, emailSender, {
      email,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(profileOverrides),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return { ...user, handle: response.json<{ handle: string }>().handle }
  }

  async function makePro(userId: string) {
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: userId }, { $set: { 'entitlement.tier': 'pro' } })
  }

  /**
   * Sequential on purpose — concurrent sign-ups hit the same known
   * Better Auth transaction race as Faz 1's warm-up works around for the
   * very first write (see the plan's Faz 1 note), not something Faz 4
   * introduces. The concurrency this suite actually tests is the quota
   * decrement on `POST /conversations`, not account creation.
   */
  async function newUsers(count: number, emailPrefix: string): Promise<SignedUpUser[]> {
    const users: SignedUpUser[] = []
    for (let i = 0; i < count; i++) {
      users.push(await newUser(`${emailPrefix}-${i}@example.com`))
    }
    return users
  }

  async function startConversation(user: SignedUpUser, toUserId: string, body = 'hi there') {
    return app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: user.cookie },
      payload: { toUserId, body },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_conversations_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_conversations_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })

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

    // Same first-transaction warm-up as the other Faz 2/3 suites.
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

  it('rejects an unauthenticated request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/conversations',
      payload: { toUserId: 'someone', body: 'hi' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('404s when the caller has not onboarded yet', async () => {
    const user = await signUpAndSignIn(app, emailSender, {
      email: 'convo-no-profile@example.com',
      password: PASSWORD,
      name: 'No Profile',
    })
    const response = await startConversation(user, 'anyone')
    expect(response.statusCode).toBe(404)
  })

  it('rejects starting a conversation with yourself', async () => {
    const viewer = await newUser('convo-self@example.com')
    const response = await startConversation(viewer, viewer.userId)
    expect(response.statusCode).toBe(400)
  })

  it('404s for a recipient with no profile', async () => {
    const viewer = await newUser('convo-ghost-recipient@example.com')
    const response = await startConversation(viewer, 'not-a-real-user-id')
    expect(response.statusCode).toBe(404)
  })

  it('refuses a conversation in either block direction', async () => {
    const viewer = await newUser('convo-blocker@example.com')
    const iBlock = await newUser('convo-i-block@example.com')
    const blocksMe = await newUser('convo-blocks-me@example.com')
    await handle.db
      .collection(COLLECTIONS.blocks)
      .insertOne({ blockerId: viewer.userId, blockedId: iBlock.userId })
    await handle.db
      .collection(COLLECTIONS.blocks)
      .insertOne({ blockerId: blocksMe.userId, blockedId: viewer.userId })

    const first = await startConversation(viewer, iBlock.userId)
    expect(first.statusCode).toBe(403)
    expect(first.json()).toMatchObject({ code: 'BLOCKED' })

    const second = await startConversation(viewer, blocksMe.userId)
    expect(second.statusCode).toBe(403)
    expect(second.json()).toMatchObject({ code: 'BLOCKED' })
  })

  it('creates a conversation with the right shape', async () => {
    const viewer = await newUser('convo-creator@example.com')
    const recipient = await newUser('convo-recipient@example.com')

    const response = await startConversation(viewer, recipient.userId, 'merhaba!')
    expect(response.statusCode, response.body).toBe(201)
    const body = response.json<{
      pairKey: string
      participants: string[]
      lastMessage: { body: string; senderId: string }
      unread: Record<string, number>
      firstMessageBy: string
      bothSpoke: boolean
    }>()
    expect(body.pairKey).toBe([viewer.userId, recipient.userId].sort().join('_'))
    expect(body.participants.sort()).toEqual([viewer.userId, recipient.userId].sort())
    expect(body.lastMessage).toMatchObject({ body: 'merhaba!', senderId: viewer.userId })
    expect(body.unread).toEqual({ [viewer.userId]: 0, [recipient.userId]: 1 })
    expect(body.firstMessageBy).toBe(viewer.userId)
    expect(body.bothSpoke).toBe(false)
  })

  it('rejects a second conversation between the same pair — pairKey is the real guard', async () => {
    const viewer = await newUser('convo-dupe-viewer@example.com')
    const recipient = await newUser('convo-dupe-recipient@example.com')

    const first = await startConversation(viewer, recipient.userId)
    expect(first.statusCode, first.body).toBe(201)

    const second = await startConversation(viewer, recipient.userId)
    expect(second.statusCode).toBe(409)
    expect(second.json()).toMatchObject({ code: 'CONVERSATION_EXISTS' })

    // The other direction is the same pair — also refused.
    const reverse = await startConversation(recipient, viewer.userId)
    expect(reverse.statusCode).toBe(409)
  })

  it('free tier: 10 concurrent first-conversation attempts to 10 different people → exactly 5 succeed', async () => {
    const viewer = await newUser('quota-race-viewer@example.com')
    const recipients = await newUsers(10, 'quota-race-recipient')

    const responses = await Promise.all(recipients.map((r) => startConversation(viewer, r.userId)))
    const succeeded = responses.filter((r) => r.statusCode === 201)
    const quotaBlocked = responses.filter((r) => r.statusCode === 402)
    expect(succeeded.length).toBe(5)
    expect(quotaBlocked.length).toBe(5)
    for (const blocked of quotaBlocked) {
      expect(blocked.json()).toMatchObject({ code: 'QUOTA_EXCEEDED' })
    }
  })

  it('pro tier: all 10 concurrent first-conversation attempts succeed', async () => {
    const viewer = await newUser('quota-pro-viewer@example.com')
    await makePro(viewer.userId)
    const recipients = await newUsers(10, 'quota-pro-recipient')

    const responses = await Promise.all(recipients.map((r) => startConversation(viewer, r.userId)))
    expect(responses.every((r) => r.statusCode === 201)).toBe(true)
  })

  describe('GET /me/quota', () => {
    it('reports unlimited for Pro', async () => {
      const viewer = await newUser('quota-status-pro@example.com')
      await makePro(viewer.userId)

      const response = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: viewer.cookie },
      })
      expect(response.json()).toMatchObject({
        initiations: { limit: null, remaining: null, nextAvailableAt: null },
      })
    })

    it('counts down initiations for free, and sets nextAvailableAt once exhausted — independently of translations', async () => {
      const viewer = await newUser('quota-status-free@example.com')
      const recipients = await newUsers(5, 'quota-status-recipient')

      const before = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: viewer.cookie },
      })
      expect(before.json()).toMatchObject({
        initiations: { limit: 5, remaining: 5, nextAvailableAt: null },
        translations: { limit: 20, remaining: 20, nextAvailableAt: null },
      })

      for (const r of recipients) {
        const started = await startConversation(viewer, r.userId)
        expect(started.statusCode, started.body).toBe(201)
      }

      const after = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: viewer.cookie },
      })
      const afterBody = after.json<{
        initiations: { limit: number; remaining: number; nextAvailableAt: string | null }
        translations: { limit: number; remaining: number }
      }>()
      expect(afterBody.initiations).toMatchObject({ limit: 5, remaining: 0 })
      expect(afterBody.initiations.nextAvailableAt).not.toBeNull()
      expect(new Date(afterBody.initiations.nextAvailableAt ?? '').getTime()).toBeGreaterThan(
        Date.now(),
      )
      // Sending conversations never touches the translation bucket.
      expect(afterBody.translations).toMatchObject({ limit: 20, remaining: 20 })
    })
  })

  describe('the 24h window rolls, it does not reset', () => {
    it('is still full at 23 hours and open again at 25', async () => {
      const viewer = await newUser('rolling-window@example.com')
      const limit = PLAN_LIMITS.free.initiationsPer24h!

      // Backdate a full allowance rather than sending real messages: what is
      // under test is the window arithmetic, not the send path.
      const stamp = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
      const profiles = handle.db.collection<Profile>(COLLECTIONS.profiles)

      await profiles.updateOne(
        { _id: viewer.userId },
        { $set: { 'quota.initiations': Array.from({ length: limit }, () => stamp(23)) } },
      )
      const at23 = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: viewer.cookie },
      })
      expect(at23.json<{ initiations: { remaining: number } }>().initiations.remaining).toBe(0)

      await profiles.updateOne(
        { _id: viewer.userId },
        { $set: { 'quota.initiations': Array.from({ length: limit }, () => stamp(25)) } },
      )
      const at25 = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: viewer.cookie },
      })
      expect(at25.json<{ initiations: { remaining: number } }>().initiations.remaining).toBe(limit)
    })

    it('frees slots one at a time as each falls out of the window', async () => {
      // A calendar-day reset would open all of them at midnight; a rolling
      // window opens them individually, which is the whole point.
      const viewer = await newUser('rolling-partial@example.com')
      const limit = PLAN_LIMITS.free.initiationsPer24h!
      const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000)

      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: viewer.userId },
        {
          $set: {
            'quota.initiations': [
              hoursAgo(25),
              hoursAgo(25),
              ...Array.from({ length: limit - 2 }, () => hoursAgo(1)),
            ],
          },
        },
      )

      const response = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: viewer.cookie },
      })
      expect(response.json<{ initiations: { remaining: number } }>().initiations.remaining).toBe(2)
    })
  })
})
