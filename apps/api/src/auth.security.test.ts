import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { createAuth } from './auth'
import { connectToDatabase, type DbHandle } from './db/client'
import { COLLECTIONS } from './db/collections'
import { ensureIndexes } from './db/indexes'
import { loadEnv } from './env'
import { createRevenueCatClientFromEnv } from './modules/billing/createRevenueCatClient'
import { LoggingPushSender } from './modules/push/devices'
import { createStorageProvider } from './storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn } from './testSupport/authFlow'
import { createTranslationProvider } from './translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'

/**
 * The security notices as they actually fire: through Better Auth's own
 * endpoints, from the `after` hook, with a user agent on the request.
 */
describe('what a sign-in tells the person it belongs to', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let push: LoggingPushSender

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_auth_security_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_auth_security_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    await ensureIndexes(handle.db)
    emailSender = new CapturingEmailSender()
    push = new LoggingPushSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender, push })
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
      email: emailSender,
      push,
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
  }, 120_000)

  afterAll(async () => {
    await app.close()
    await handle.close()
    await replSet.stop()
  })

  beforeEach(() => {
    emailSender.messages.length = 0
    push.sent.length = 0
  })

  async function newUser(): Promise<{ email: string; userId: string }> {
    const user = await signUpAndSignIn(app, emailSender, {
      email: `sec-${Math.random().toString(36).slice(2, 10)}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    return { email: user.email, userId: user.userId }
  }

  function signIn(email: string, userAgent: string, country?: string) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { 'user-agent': userAgent, ...(country ? { 'cf-ipcountry': country } : {}) },
      payload: { email, password: PASSWORD },
    })
  }

  const securityMails = () =>
    emailSender.messages.filter((message) => /sign-in|password/i.test(message.subject))

  it('writes on the first sign-in from a device and stays quiet on the next', async () => {
    const { email } = await newUser()
    emailSender.messages.length = 0

    const first = await signIn(email, IPHONE, 'TR')
    expect(first.statusCode).toBe(200)
    expect(securityMails()).toHaveLength(1)
    expect(securityMails()[0]?.html).toContain('Safari on iPhone')
    expect(securityMails()[0]?.html).toContain('Türkiye')

    emailSender.messages.length = 0
    expect((await signIn(email, IPHONE, 'TR')).statusCode).toBe(200)
    expect(securityMails()).toHaveLength(0)
  })

  it('writes again when the device really is a different one', async () => {
    const { email } = await newUser()
    await signIn(email, IPHONE)
    emailSender.messages.length = 0

    await signIn(email, WINDOWS)
    expect(securityMails()).toHaveLength(1)
    expect(securityMails()[0]?.html).toContain('Chrome on Windows')
  })

  /**
   * Being told you signed in seconds after creating the account is noise, and
   * the verification mail is already on its way.
   */
  it('says nothing about the sign-up itself', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'user-agent': IPHONE },
      payload: {
        email: `fresh-${Math.random().toString(36).slice(2, 10)}@example.com`,
        password: PASSWORD,
        name: 'Fresh',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(securityMails()).toHaveLength(0)
  })

  it('records the device so a later sign-in is an ordinary one', async () => {
    const { email, userId } = await newUser()
    await signIn(email, IPHONE)
    const rows = await handle.db.collection(COLLECTIONS.knownDevices).find({ userId }).toArray()
    expect(rows.map((row) => row._id)).toContain(`${userId}:ios-safari`)
  })

  it('writes when the password changes', async () => {
    const user = await signUpAndSignIn(app, emailSender, {
      email: `pw-${Math.random().toString(36).slice(2, 10)}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    emailSender.messages.length = 0

    const changed = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: user.cookie, 'user-agent': WINDOWS },
      payload: { currentPassword: PASSWORD, newPassword: 'a different long password' },
    })
    expect(changed.statusCode, changed.body).toBe(200)
    const mail = securityMails()
    expect(mail).toHaveLength(1)
    expect(mail[0]?.subject).toMatch(/password/i)
    expect(mail[0]?.html).toContain('Chrome on Windows')
  })

  /** The notice is not a notification: no switch behind it, no header to opt out with. */
  it('sends the notice with no unsubscribe header at all', async () => {
    const { email } = await newUser()
    await signIn(email, WINDOWS)
    expect(securityMails()[0]?.headers).toBeUndefined()
  })
})
