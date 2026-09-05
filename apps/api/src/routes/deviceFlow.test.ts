import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import {
  CapturingEmailSender,
  setCookieValue,
  signUpAndSignIn,
  type SignedUpUser,
} from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const USER_CODE_CHARSET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/

/**
 * RFC 8628 from both ends: a browser with no session asks for a code, and a
 * phone that has one approves it.
 *
 * The case this file exists for is `approve` **without the claim first**.
 * Better Auth will not let a code be approved until a signed-in `GET /device`
 * has attached it to that user, and the app called approve straight away — so
 * approving from the phone answered "that code is no longer valid" every
 * single time, for everyone, and nothing in the suite noticed.
 */
describe('device sign-in flow', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let phone: SignedUpUser
  let other: SignedUpUser

  /** The browser asking to be signed in: no session, only a client id. */
  async function requestCode(): Promise<{
    userCode: string
    deviceCode: string
    interval: number
  }> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/device/code',
      payload: { client_id: 'langx-web', scope: 'openid' },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<{ user_code: string; device_code: string; interval: number }>()
    return { userCode: body.user_code, deviceCode: body.device_code, interval: body.interval }
  }

  /** What the phone does before it can approve: `GET /device?user_code=`. */
  function claim(userCode: string, cookie: string) {
    return app.inject({
      method: 'GET',
      url: `/api/auth/device?user_code=${encodeURIComponent(userCode)}`,
      headers: { cookie },
    })
  }

  function approve(userCode: string, cookie: string) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/device/approve',
      headers: { cookie },
      payload: { userCode },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_device_test')
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_device_test',
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
    emailSender.messages.length = 0

    phone = await signUpAndSignIn(app, emailSender, {
      email: 'phone@example.com',
      password: PASSWORD,
      name: 'Phone Owner',
    })
    other = await signUpAndSignIn(app, emailSender, {
      email: 'other@example.com',
      password: PASSWORD,
      name: 'Somebody Else',
    })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('hands the browser a five-character code from the unambiguous charset', async () => {
    const { userCode, deviceCode, interval } = await requestCode()
    // Five, chosen on 5 September 2026 — the plugin's eight was only ever its
    // default, and the arithmetic in `auth.ts` says why five is enough. The
    // placeholder on every screen is shaped like this number.
    expect(userCode.replace(/-/g, '')).toHaveLength(5)
    expect(userCode.replace(/-/g, '')).toMatch(USER_CODE_CHARSET)
    expect(deviceCode).toBeTruthy()
    // Two seconds between polls: this is the delay between the phone saying
    // yes and the browser signing in, so the client reads it off the response
    // rather than assuming a number.
    expect(interval).toBe(2)
  })

  it('refuses to approve a code that has not been claimed', async () => {
    const { userCode } = await requestCode()
    const response = await approve(userCode, phone.cookie)
    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('claimed')
  })

  it('claims the code for the signed-in phone, and says what is asking', async () => {
    const { userCode } = await requestCode()
    const claimed = await claim(userCode, phone.cookie)
    expect(claimed.statusCode).toBe(200)
    expect(claimed.json()).toMatchObject({ status: 'pending', client_id: 'langx-web' })
  })

  it('signs the browser in once the phone approves', async () => {
    const { userCode, deviceCode } = await requestCode()
    expect((await claim(userCode, phone.cookie)).statusCode).toBe(200)
    expect((await approve(userCode, phone.cookie)).statusCode).toBe(200)

    const token = await app.inject({
      method: 'POST',
      url: '/api/auth/device/token',
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: 'langx-web',
      },
    })
    expect(token.statusCode).toBe(200)

    /*
     * The cookie is the point. This endpoint is an OAuth one and answers with
     * a bearer token, which nothing in this app knows how to send — the hook
     * in `auth.ts` writes the session cookie for the session the plugin has
     * already created. Without it the browser polls, gets a 200, and stays
     * signed out.
     */
    const browserCookie = setCookieValue(token)
    const me = await app.inject({
      method: 'GET',
      url: '/profiles/me',
      headers: { cookie: browserCookie },
    })
    // No profile yet in this suite, so 404 is the signed-in answer; 401 is not.
    expect(me.statusCode).not.toBe(401)
  })

  it('accepts the code as it was typed, lowercase and hyphenated', async () => {
    const { userCode } = await requestCode()
    const typed = `${userCode.slice(0, 2).toLowerCase()}-${userCode.slice(2).toLowerCase()}`
    expect((await claim(typed, phone.cookie)).statusCode).toBe(200)
    expect((await approve(typed, phone.cookie)).statusCode).toBe(200)
  })

  it('will not let a second account approve a code the first has claimed', async () => {
    const { userCode } = await requestCode()
    expect((await claim(userCode, phone.cookie)).statusCode).toBe(200)
    const response = await approve(userCode, other.cookie)
    expect(response.statusCode).toBe(403)
  })

  it('tells the polling browser it was denied', async () => {
    const { userCode, deviceCode } = await requestCode()
    expect((await claim(userCode, phone.cookie)).statusCode).toBe(200)
    const denied = await app.inject({
      method: 'POST',
      url: '/api/auth/device/deny',
      headers: { cookie: phone.cookie },
      payload: { userCode },
    })
    expect(denied.statusCode).toBe(200)

    const token = await app.inject({
      method: 'POST',
      url: '/api/auth/device/token',
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: 'langx-web',
      },
    })
    expect(token.statusCode).toBeGreaterThanOrEqual(400)
    expect(token.body).toContain('access_denied')
  })

  it('lists both devices, and can sign one of them out', async () => {
    const { userCode, deviceCode } = await requestCode()
    expect((await claim(userCode, phone.cookie)).statusCode).toBe(200)
    expect((await approve(userCode, phone.cookie)).statusCode).toBe(200)
    const token = await app.inject({
      method: 'POST',
      url: '/api/auth/device/token',
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: 'langx-web',
      },
    })
    const browserCookie = setCookieValue(token)

    const listed = await app.inject({
      method: 'GET',
      url: '/api/auth/list-sessions',
      headers: { cookie: phone.cookie },
    })
    expect(listed.statusCode).toBe(200)
    const sessions = listed.json<{ token: string }[]>()
    expect(sessions.length).toBeGreaterThanOrEqual(2)

    // The browser's row, found by the token its cookie carries.
    const browserToken = decodeURIComponent(browserCookie.split('=')[1] ?? '').split('.')[0]
    const browserRow = sessions.find((session) => session.token === browserToken)
    expect(browserRow).toBeTruthy()

    const revoked = await app.inject({
      method: 'POST',
      url: '/api/auth/revoke-session',
      headers: { cookie: phone.cookie },
      payload: { token: browserToken },
    })
    expect(revoked.statusCode).toBe(200)

    const afterWeb = await app.inject({
      method: 'GET',
      url: '/profiles/me',
      headers: { cookie: browserCookie },
    })
    expect(afterWeb.statusCode).toBe(401)

    const afterPhone = await app.inject({
      method: 'GET',
      url: '/api/auth/list-sessions',
      headers: { cookie: phone.cookie },
    })
    expect(afterPhone.statusCode).toBe(200)
  })

  it('lists sessions from a phone that signed in days ago', async () => {
    /*
     * The freshness default would have answered 403 here. Written as a test
     * because `freshAge: 0` is one line in a config that reads like a
     * preference and is in fact the difference between a screen that works
     * and one nobody can open.
     */
    const token = decodeURIComponent(phone.cookie.split('=')[1] ?? '').split('.')[0]
    await handle.db
      .collection('session')
      .updateOne({ token }, { $set: { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } })
    const listed = await app.inject({
      method: 'GET',
      url: '/api/auth/list-sessions',
      headers: { cookie: phone.cookie },
    })
    expect(listed.statusCode).toBe(200)
  })

  it('refuses an expired code', async () => {
    const { userCode } = await requestCode()
    /*
     * By `userCode`, never by `_id`: Better Auth stores its ids as ObjectId
     * and ours are strings, so a lookup by id here matches nothing and the
     * test would pass for the wrong reason.
     */
    await handle.db
      .collection('deviceCode')
      .updateOne({ userCode }, { $set: { expiresAt: new Date(Date.now() - 60_000) } })
    const response = await claim(userCode, phone.cookie)
    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('expired_token')
  })
})
