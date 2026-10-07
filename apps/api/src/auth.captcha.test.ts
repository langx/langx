import { DEFAULT_APP_CONFIG } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app'
import { createAuth } from './auth'
import { CAPTCHA_HEADER } from './auth/captcha'
import { connectToDatabase, type DbHandle } from './db/client'
import { COLLECTIONS } from './db/collections'
import { ensureIndexes } from './db/indexes'
import { loadEnv } from './env'
import { invalidateAppConfigCache, updateAppConfig } from './modules/appConfig/appConfig'
import { createRevenueCatClientFromEnv } from './modules/billing/createRevenueCatClient'
import { createStorageProvider } from './storage/createStorageProvider'
import { CapturingEmailSender } from './testSupport/authFlow'
import { createTranslationProvider } from './translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
/** Cloudflare's documented always-passes test secret; the stub below plays its part. */
const TEST_SECRET = '1x0000000000000000000000000000000AA'
/** What the stubbed siteverify accepts. Anything else is a token Cloudflare would refuse. */
const GOOD_TOKEN = 'good-token'

/**
 * Turnstile on the password forms, through Better Auth's own endpoints.
 *
 * Two apps over one database: one started without `TURNSTILE_SECRET_KEY`,
 * which must behave as if the plugin did not exist, and one with it, whose
 * treatment of a missing token follows `flags.captchaRequired`. Cloudflare is
 * never called — `fetch` is stubbed for the siteverify URL only.
 */
describe('Turnstile on sign-up, sign-in and reset', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let plain: FastifyInstance
  let guarded: FastifyInstance
  const siteverifyCalls: { secret: string; response: string }[] = []

  async function start(env: ReturnType<typeof loadEnv>): Promise<FastifyInstance> {
    const emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    const app = await buildApp({
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
    return app
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_auth_captcha_test')
    await ensureIndexes(handle.db)
    const base = {
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_auth_captcha_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    }
    plain = await start(loadEnv(base))
    guarded = await start(loadEnv({ ...base, TURNSTILE_SECRET_KEY: TEST_SECRET }))

    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url !== SITEVERIFY) return realFetch(input, init)
      const body = JSON.parse(init?.body as string) as { secret: string; response: string }
      siteverifyCalls.push(body)
      const success = body.response === GOOD_TOKEN
      return new Response(
        JSON.stringify(
          success
            ? { success: true, hostname: 'app.langx.io', 'error-codes': [] }
            : { success: false, 'error-codes': ['invalid-input-response'] },
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    // The first transaction against a fresh replica set can fail while it
    // elects; the other auth suites warm up the same way.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await signUp(plain)
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }, 120_000)

  afterAll(async () => {
    vi.unstubAllGlobals()
    await plain.close()
    await guarded.close()
    await handle.close()
    await replSet.stop()
  })

  afterEach(async () => {
    siteverifyCalls.length = 0
    await handle.db.collection(COLLECTIONS.appConfig).deleteMany({})
    invalidateAppConfigCache()
  })

  async function setRequired(captchaRequired: boolean): Promise<void> {
    await updateAppConfig(handle.db, { flags: { ...DEFAULT_APP_CONFIG.flags, captchaRequired } })
  }

  function signUp(app: FastifyInstance, token?: string) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: token === undefined ? {} : { [CAPTCHA_HEADER]: token },
      payload: {
        email: `captcha-${Math.random().toString(36).slice(2, 10)}@example.com`,
        password: PASSWORD,
        name: 'Test',
      },
    })
  }

  it('without a secret, signs up with no token and never asks Cloudflare', async () => {
    await setRequired(true)
    expect((await signUp(plain)).statusCode).toBe(200)
    expect(siteverifyCalls).toHaveLength(0)
  })

  /**
   * The web build sends the token cross-origin, so the browser asks first. A
   * preflight that did not allow the header would fail every web sign-up
   * before the request existed — with nothing in the server log.
   */
  it('lets a browser send the token header across origins', async () => {
    const preflight = await guarded.inject({
      method: 'OPTIONS',
      url: '/api/auth/sign-up/email',
      headers: {
        origin: 'https://app.langx.io',
        'access-control-request-method': 'POST',
        'access-control-request-headers': `content-type,${CAPTCHA_HEADER}`,
      },
    })
    expect(preflight.headers['access-control-allow-headers']).toContain(CAPTCHA_HEADER)
  })

  describe('with a secret and the switch off', () => {
    it('lets a request without a token through, as builds before this one send', async () => {
      expect((await signUp(guarded)).statusCode).toBe(200)
      expect(siteverifyCalls).toHaveLength(0)
    })

    it('checks a token that is sent, and accepts a good one', async () => {
      expect((await signUp(guarded, GOOD_TOKEN)).statusCode).toBe(200)
      expect(siteverifyCalls).toEqual([
        expect.objectContaining({ secret: TEST_SECRET, response: GOOD_TOKEN }),
      ])
    })

    it('refuses a bad token rather than treating it as absent', async () => {
      const response = await signUp(guarded, 'forged')
      expect(response.statusCode).toBe(403)
      expect(response.json<{ code: string }>().code).toBe('VERIFICATION_FAILED')
    })
  })

  describe('with a secret and the switch on', () => {
    it('refuses a sign-up without a token', async () => {
      await setRequired(true)
      const response = await signUp(guarded)
      expect(response.statusCode).toBe(400)
      expect(response.json<{ code: string }>().code).toBe('MISSING_RESPONSE')
    })

    it('refuses a sign-in and a reset request without one too', async () => {
      await setRequired(true)
      const signIn = await guarded.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: 'nobody@example.com', password: PASSWORD },
      })
      expect(signIn.statusCode).toBe(400)
      const reset = await guarded.inject({
        method: 'POST',
        url: '/api/auth/request-password-reset',
        payload: { email: 'nobody@example.com' },
      })
      expect(reset.statusCode).toBe(400)
    })

    it('still signs up with a good token', async () => {
      await setRequired(true)
      expect((await signUp(guarded, GOOD_TOKEN)).statusCode).toBe(200)
    })

    it('leaves the routes it does not cover alone', async () => {
      await setRequired(true)
      const session = await guarded.inject({ method: 'GET', url: '/api/auth/get-session' })
      expect(session.statusCode).toBe(200)
    })
  })
})
