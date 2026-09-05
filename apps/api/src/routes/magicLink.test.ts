import { magicLinkUrl } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { translator } from '../i18n'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { insertPrecreatedUser } from '../modules/handles/legacyPrecreate'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import {
  CapturingEmailSender,
  setCookieValue,
  signUpAndSignIn,
  type SignedUpUser,
} from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const FAILED_PATH = '/auth/magic-link/failed'

/**
 * Sign in with an emailed link, from the request to the session.
 *
 * The cases this file exists for: the link in the mail is a page on the web
 * host and never the API's verify endpoint (a scanner must not spend it);
 * an unknown address gets the same 200 and no mail (the endpoint answers
 * "is this registered" to nobody); and a pre-created v1 row — verified, no
 * password — gets in, which is the whole reason the door exists.
 */
describe('magic link sign-in', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let member: SignedUpUser

  function request(email: string, headers: Record<string, string> = {}) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/magic-link',
      headers,
      payload: { email },
    })
  }

  /** Pulls the token out of the last captured mail, the way an inbox would. */
  function latestToken(): string {
    const url = new URL(emailSender.latestUrl())
    const token = url.searchParams.get('token')
    if (!token) throw new Error(`no token in ${url.href}`)
    return token
  }

  /** What the app does with the token: the JSON form, plus the failure path it names. */
  function verify(token: string) {
    return app.inject({
      method: 'GET',
      url: `/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&errorCallbackURL=${encodeURIComponent(FAILED_PATH)}`,
    })
  }

  async function userCount(): Promise<number> {
    return handle.db.collection(COLLECTIONS.user).countDocuments()
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_magic_link_test')
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_magic_link_test',
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

    // Same first-transaction warm-up as the other suites — see auth.test.ts.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    member = await signUpAndSignIn(app, emailSender, {
      email: 'member@example.com',
      password: PASSWORD,
      name: 'A Member',
    })
    emailSender.messages.length = 0
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  describe('asking for a link', () => {
    it('mails a page on the web host, never the verify endpoint', async () => {
      const response = await request(member.email)
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ status: true })

      expect(emailSender.messages).toHaveLength(1)
      const url = emailSender.latestUrl()
      expect(url).toBe(magicLinkUrl(latestToken()))
      expect(url.startsWith('https://app.langx.io/magic-link?token=')).toBe(true)
      expect(url).not.toContain('/api/')
      expect(url).not.toContain('callbackURL')
      emailSender.messages.length = 0
    })

    it('answers an unknown address exactly like a known one, and mails nobody', async () => {
      const before = await userCount()
      const response = await request('nobody@example.com')
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ status: true })
      expect(emailSender.messages).toHaveLength(0)
      expect(await userCount()).toBe(before)
    })

    it('writes the mail in the language the request was made in', async () => {
      const response = await request(member.email, { 'accept-language': 'tr' })
      expect(response.statusCode).toBe(200)
      expect(emailSender.messages.at(-1)?.subject).toBe(translator('tr')('email.magicLinkSubject'))
      emailSender.messages.length = 0
    })
  })

  describe('spending the link', () => {
    it('signs the person in, once', async () => {
      await request(member.email)
      const token = latestToken()
      emailSender.messages.length = 0

      const first = await verify(token)
      expect(first.statusCode).toBe(200)
      expect(first.json<{ user: { email: string } }>().user.email).toBe(member.email)
      const cookie = setCookieValue(first)

      const me = await app.inject({ method: 'GET', url: '/profiles/me', headers: { cookie } })
      expect(me.statusCode).not.toBe(401)

      // Single use: the same token again is a failure, sent where the app asked.
      const second = await verify(token)
      expect(second.statusCode).toBe(302)
      expect(second.headers.location).toContain(FAILED_PATH)
      expect(second.headers.location).toContain('error=')
    })

    it('lands a failure on a 400 the app can read', async () => {
      const redirected = await verify('not-a-token')
      expect(redirected.statusCode).toBe(302)
      const location = String(redirected.headers.location)
      const failed = await app.inject({
        method: 'GET',
        url: location.replace(/^https?:\/\/[^/]+/, ''),
      })
      expect(failed.statusCode).toBe(400)
      expect(failed.json()).toMatchObject({ code: 'INVALID_TOKEN' })
    })

    it('refuses an expired token', async () => {
      await request(member.email)
      const token = latestToken()
      emailSender.messages.length = 0
      // The identifier is hashed, so the row is found by what it stores: the address.
      await handle.db
        .collection(COLLECTIONS.verification)
        .updateMany({ value: { $regex: member.email } }, { $set: { expiresAt: new Date(0) } })
      const response = await verify(token)
      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toContain(FAILED_PATH)
    })
  })

  describe('a v1 account that was pre-created without a password', () => {
    it('gets in with the link, and is settled on that first session', async () => {
      const email = 'returning-v1@example.com'
      const { userId } = await insertPrecreatedUser(handle.db, {
        email,
        name: 'Returning',
        legacyUserId: 'appwrite-returning',
      })

      const asked = await request(email)
      expect(asked.statusCode).toBe(200)
      expect(emailSender.messages).toHaveLength(1)
      const token = latestToken()
      emailSender.messages.length = 0

      const response = await verify(token)
      expect(response.statusCode).toBe(200)
      expect(response.json<{ user: { id: string } }>().user.id).toBe(userId)
      setCookieValue(response)

      const user = await handle.db
        .collection<{ terms?: unknown }>(COLLECTIONS.user)
        .findOne({ email }, { projection: { terms: 1 } })
      expect(user?.terms).toBeTruthy()
    })
  })
})
