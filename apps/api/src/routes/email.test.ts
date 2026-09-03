import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { signUnsubscribeToken } from '../email/unsubscribeToken'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const SECRET = 'b'.repeat(40)

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

describe('unsubscribing from a link in an email', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let userId: string

  async function notificationsOf(id: string): Promise<Record<string, unknown>> {
    const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
    return profile?.settings.notifications as Record<string, unknown>
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_email_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_email_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      EMAIL_UNSUBSCRIBE_SECRET: SECRET,
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
      email: emailSender,
    })
    await app.ready()

    // Better Auth's first transaction against a cold replica set loses a race
    // with index creation; chat.test.ts warms up the same way.
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
    await app.close()
    await handle.close()
    await replSet.stop()
  })

  beforeEach(async () => {
    const user = await signUpAndSignIn(app, emailSender, {
      email: `unsub-${Math.random().toString(36).slice(2, 10)}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(),
    })
    expect(created.statusCode, created.body).toBe(201)
    userId = user.userId
  })

  /**
   * Scanners, previewers and "protect the click" proxies all fetch a link
   * before a human sees it. A GET that acted would unsubscribe people who
   * never opened the mail.
   */
  it('asks on GET and changes nothing', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'messages')
    const response = await app.inject({ method: 'GET', url: `/email/unsubscribe?token=${token}` })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('<form method="post"')
    expect(await notificationsOf(userId)).toMatchObject({ messages: { push: true, email: true } })
  })

  it('turns one kind off on POST and leaves the phone alone', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'messages')
    const response = await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })

    expect(response.statusCode).toBe(200)
    const notifications = await notificationsOf(userId)
    expect(notifications).toMatchObject({
      messages: { push: true, email: false },
      streak: { push: true, email: true },
    })
  })

  /** RFC 8058: an empty form body, and the token that counts is in the URL. */
  it('honours a one-click POST from a mail client', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'promotions')
    const response = await app.inject({
      method: 'POST',
      url: `/email/unsubscribe?token=${token}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(await notificationsOf(userId)).toMatchObject({
      promotions: { push: false, email: false },
    })
  })

  it('takes the token from a form body when the URL has none', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'streak')
    const response = await app.inject({
      method: 'POST',
      url: '/email/unsubscribe',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `token=${encodeURIComponent(token)}`,
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(await notificationsOf(userId)).toMatchObject({ streak: { push: true, email: false } })
  })

  it('stops every kind when the scope is all', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'all')
    await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })

    const notifications = await notificationsOf(userId)
    for (const kind of ['messages', 'streak', 'profileVisits', 'promotions']) {
      expect((notifications[kind] as { email: boolean }).email, kind).toBe(false)
    }
    // Push is a different question, and nobody asked it.
    expect(notifications.messages).toMatchObject({ push: true })
  })

  /** A mail client may retry; the second press must not be an error page. */
  it('is idempotent', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'messages')
    await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })
    const second = await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })
    expect(second.statusCode).toBe(200)
  })

  it('refuses a token it did not sign', async () => {
    const forged = signUnsubscribeToken('a-different-secret-of-adequate-length', userId, 'messages')
    const get = await app.inject({ method: 'GET', url: `/email/unsubscribe?token=${forged}` })
    const post = await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${forged}` })

    expect(get.statusCode).toBe(400)
    expect(post.statusCode).toBe(400)
    expect(await notificationsOf(userId)).toMatchObject({ messages: { email: true } })
  })

  it('refuses a missing token without throwing', async () => {
    expect((await app.inject({ method: 'GET', url: '/email/unsubscribe' })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/email/unsubscribe' })).statusCode).toBe(400)
  })

  /**
   * The link in the one mail to v1 accounts their owners deleted. No account
   * behind it, so the only thing "stop" can mean is forgetting the address.
   */
  it('the v1-contact scope forgets the address, and only on the POST', async () => {
    const contacts = handle.db.collection(COLLECTIONS.v1DeletedContacts)
    await contacts.insertOne({
      _id: 'appwrite-gone' as never,
      email: 'gone@example.com',
      name: 'Gone',
      legacyUserId: 'appwrite-gone',
      recordedAt: new Date(),
    })
    const token = signUnsubscribeToken(SECRET, 'appwrite-gone', 'v1contact')

    const asked = await app.inject({
      method: 'GET',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
    })
    expect(asked.statusCode).toBe(200)
    expect(asked.body).toContain('the one message about the new LangX')
    expect(await contacts.countDocuments({ _id: 'appwrite-gone' as never })).toBe(1)

    const done = await app.inject({
      method: 'POST',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    })
    expect(done.statusCode).toBe(200)
    expect(await contacts.countDocuments({ _id: 'appwrite-gone' as never })).toBe(0)

    // A second press is not an error page.
    const again = await app.inject({
      method: 'POST',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
    })
    expect(again.statusCode).toBe(200)
  })
})
