import { ERROR_CODES, SIGN_UP_RULES } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app'
import { createAuth } from './auth'
import { connectToDatabase, type DbHandle } from './db/client'
import { COLLECTIONS } from './db/collections'
import { ensureIndexes } from './db/indexes'
import { loadEnv } from './env'
import { createRevenueCatClientFromEnv } from './modules/billing/createRevenueCatClient'
import { createStorageProvider } from './storage/createStorageProvider'
import { authId } from './lib/authId'
import { CapturingEmailSender, signUpAndSignIn } from './testSupport/authFlow'
import { createTranslationProvider } from './translation/createTranslationProvider'

/**
 * The two sign-up rules, driven through the real endpoints: a throwaway
 * address is refused before anything is written, and one network opens at
 * most `SIGN_UP_RULES.accountsPerIp` accounts a day — counted across email
 * and social sign-up alike, and never for a guest.
 *
 * Every request names its address with `remoteAddress`, which is what
 * Fastify's `request.ip` reads without a proxy in front, unless it is testing
 * the edge. Each test uses addresses of its own, so the counts do not run into
 * each other.
 */
const EDGE_SECRET = 'edge-secret-for-tests'

describe('sign-up defences', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  const emailSender = new CapturingEmailSender()
  let counter = 0

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_sign_up_defences_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_sign_up_defences_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      DISCORD_CLIENT_ID: 'discord-app',
      DISCORD_CLIENT_SECRET: 'discord-secret',
      EDGE_SECRET,
    })
    await ensureIndexes(handle.db)
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth: await createAuth({ env, db: handle.db, client: handle.client, emailSender }),
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
    })
    await app.ready()
    // The first sign-up on a fresh replica set can hit a transient "catalog
    // changes" error. Spent here, from loopback, which is never counted.
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: 'warm-up@example.com', password: 'correct horse battery', name: 'Warm' },
    })
  }, 120_000)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  async function signUp(email: string, ip: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      remoteAddress: ip,
      payload: { email, password: 'correct horse battery', name: 'Sofia' },
    })
    return { status: response.statusCode, code: response.json<{ code?: string }>().code }
  }

  function freshEmail(): string {
    counter += 1
    return `sofia.${counter}@example.com`
  }

  function cookiesOf(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers['set-cookie']
    const all = (Array.isArray(raw) ? raw : [raw]).filter((c): c is string => typeof c === 'string')
    return all.map((c) => c.split(';')[0]).join('; ')
  }

  /** A first Discord sign-in — provider stubbed, everything of ours real. */
  async function signUpWithDiscord(email: string, ip: string): Promise<string> {
    counter += 1
    const realFetch = globalThis.fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('https://discord.com/api/oauth2/token')) {
        return Promise.resolve(
          Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 }),
        )
      }
      if (url.startsWith('https://discord.com/api/users/%40me')) {
        return Promise.resolve(
          Response.json({
            id: `8035111022467${counter}`,
            username: `sofia${counter}`,
            global_name: 'Sofia',
            discriminator: '0',
            avatar: null,
            email,
            verified: true,
          }),
        )
      }
      return realFetch(input, init)
    })

    const start = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      remoteAddress: ip,
      payload: { provider: 'discord', callbackURL: 'http://localhost:4000/' },
    })
    expect(start.statusCode).toBe(200)
    const state = new URL(start.json<{ url: string }>().url).searchParams.get('state') ?? ''
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback/discord?code=the-code&state=${encodeURIComponent(state)}`,
      remoteAddress: ip,
      headers: { cookie: cookiesOf(start) },
    })
    vi.restoreAllMocks()
    return String(callback.headers.location ?? '')
  }

  async function userExists(email: string): Promise<boolean> {
    return (await handle.db.collection(COLLECTIONS.user).countDocuments({ email })) > 0
  }

  describe('throwaway addresses', () => {
    it('refuses a listed domain and writes nothing', async () => {
      const result = await signUp('sofia@mailinator.com', '198.51.100.1')
      expect(result).toEqual({ status: 400, code: ERROR_CODES.DISPOSABLE_EMAIL })
      expect(await userExists('sofia@mailinator.com')).toBe(false)
    })

    it('refuses a subdomain of a listed domain', async () => {
      const result = await signUp('sofia@inbox.mailinator.com', '198.51.100.1')
      expect(result).toEqual({ status: 400, code: ERROR_CODES.DISPOSABLE_EMAIL })
    })

    it('allows an ordinary domain', async () => {
      const email = freshEmail()
      expect((await signUp(email, '198.51.100.1')).status).toBe(200)
      expect(await userExists(email)).toBe(true)
    })
  })

  describe('accounts per network', () => {
    it(`refuses the account after the ${SIGN_UP_RULES.accountsPerIp}th from one address, and only there`, async () => {
      for (let i = 0; i < SIGN_UP_RULES.accountsPerIp; i++) {
        expect((await signUp(freshEmail(), '203.0.113.10')).status).toBe(200)
      }
      const refusedEmail = freshEmail()
      expect(await signUp(refusedEmail, '203.0.113.10')).toEqual({
        status: 429,
        code: ERROR_CODES.SIGN_UP_LIMIT_REACHED,
      })
      expect(await userExists(refusedEmail)).toBe(false)

      expect((await signUp(freshEmail(), '203.0.113.11')).status).toBe(200)
    })

    it('does not count guests', async () => {
      for (let i = 0; i <= SIGN_UP_RULES.accountsPerIp; i++) {
        const guest = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/anonymous',
          remoteAddress: '203.0.113.20',
        })
        expect(guest.statusCode).toBe(200)
      }
      for (let i = 0; i < SIGN_UP_RULES.accountsPerIp; i++) {
        expect((await signUp(freshEmail(), '203.0.113.20')).status).toBe(200)
      }
    })

    it('counts a first social sign-in, and refuses one past the cap', async () => {
      const socialEmail = freshEmail()
      expect(await signUpWithDiscord(socialEmail, '203.0.113.30')).not.toContain('error')
      expect(await userExists(socialEmail)).toBe(true)

      for (let i = 1; i < SIGN_UP_RULES.accountsPerIp; i++) {
        expect((await signUp(freshEmail(), '203.0.113.30')).status).toBe(200)
      }
      expect((await signUp(freshEmail(), '203.0.113.30')).code).toBe(
        ERROR_CODES.SIGN_UP_LIMIT_REACHED,
      )

      const refusedEmail = freshEmail()
      const location = await signUpWithDiscord(refusedEmail, '203.0.113.30')
      expect(location).toContain(`error=${ERROR_CODES.SIGN_UP_LIMIT_REACHED}`)
      expect(await userExists(refusedEmail)).toBe(false)
    })

    it('counts by the address the edge vouches for, and only then', async () => {
      // From loopback, which is never counted by itself — so every count here
      // is the Cloudflare header's.
      const viaEdge = { 'cf-connecting-ip': '203.0.113.40', 'x-langx-edge': EDGE_SECRET }
      const signUpViaEdge = async (headers: Record<string, string>) =>
        app.inject({
          method: 'POST',
          url: '/api/auth/sign-up/email',
          headers,
          payload: { email: freshEmail(), password: 'correct horse battery', name: 'Sofia' },
        })

      // Not vouched for: the header is ignored, and loopback is not counted.
      for (let i = 0; i <= SIGN_UP_RULES.accountsPerIp; i++) {
        const response = await signUpViaEdge({ 'cf-connecting-ip': '203.0.113.40' })
        expect(response.statusCode).toBe(200)
      }
      for (let i = 0; i < SIGN_UP_RULES.accountsPerIp; i++) {
        expect((await signUpViaEdge(viaEdge)).statusCode).toBe(200)
      }
      const refused = await signUpViaEdge(viaEdge)
      expect(refused.statusCode).toBe(429)
      expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.SIGN_UP_LIMIT_REACHED)
    })

    it('stores no address, only a hash of it', async () => {
      const rows = await handle.db.collection(COLLECTIONS.signUpsByIp).find().toArray()
      expect(rows.length).toBeGreaterThan(0)
      expect(JSON.stringify(rows)).not.toContain('203.0.113')
    })
  })

  describe('the address on a session', () => {
    async function latestSessionIp(userId: string): Promise<unknown> {
      const session = await handle.db
        .collection(COLLECTIONS.session)
        .find({ userId: authId(userId) })
        .sort({ createdAt: -1 })
        .limit(1)
        .next()
      return session?.ipAddress
    }

    async function signIn(email: string, ip: string, headers: Record<string, string>) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        remoteAddress: ip,
        headers,
        payload: { email, password: 'correct horse battery' },
      })
      expect(response.statusCode).toBe(200)
    }

    it('records the address Cloudflare vouched for', async () => {
      const email = freshEmail()
      const { userId } = await signUpAndSignIn(app, emailSender, {
        email,
        password: 'correct horse battery',
        name: 'Sofia',
      })

      await signIn(email, '198.51.100.10', {
        'cf-connecting-ip': '198.51.100.77',
        'x-langx-edge': EDGE_SECRET,
      })
      expect(await latestSessionIp(userId)).toBe('198.51.100.77')
    })

    it('records the connecting address when the edge did not vouch', async () => {
      const email = freshEmail()
      const { userId } = await signUpAndSignIn(app, emailSender, {
        email,
        password: 'correct horse battery',
        name: 'Sofia',
      })

      await signIn(email, '198.51.100.88', {
        'cf-connecting-ip': '198.51.100.77',
        'x-langx-client-ip': '198.51.100.99',
      })
      expect(await latestSessionIp(userId)).toBe('198.51.100.88')
    })
  })
})
