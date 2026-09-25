import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app'
import { createAuth } from './auth'
import { connectToDatabase, type DbHandle } from './db/client'
import { ensureIndexes } from './db/indexes'
import { loadEnv } from './env'
import { createRevenueCatClientFromEnv } from './modules/billing/createRevenueCatClient'
import { createStorageProvider } from './storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn } from './testSupport/authFlow'
import { createTranslationProvider } from './translation/createTranslationProvider'

/**
 * Somebody who signed up with an email and later taps "Continue with
 * Facebook" or "Continue with Discord" under the same address must land in
 * the account they already have, not in a second, empty one.
 *
 * The whole OAuth round trip runs through Better Auth — start, provider,
 * callback — with only the provider's own HTTP endpoints stubbed, because the
 * rule being tested (trusted provider or verified address, and a verified
 * address on our side) lives inside that callback and nowhere else.
 */
describe('social sign-in joins the account that already has the address', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  const emailSender = new CapturingEmailSender()

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_social_linking_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_social_linking_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      FACEBOOK_CLIENT_ID: 'fb-app',
      FACEBOOK_CLIENT_SECRET: 'fb-secret',
      DISCORD_CLIENT_ID: 'discord-app',
      DISCORD_CLIENT_SECRET: 'discord-secret',
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
    // changes" error while Better Auth's collections come into existence.
    // Spend it here, on an address no test uses.
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

  /** Answers the provider's endpoints; everything else goes to the real fetch. */
  function stubProvider(responses: Record<string, unknown>) {
    const realFetch = globalThis.fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const match = Object.keys(responses).find((prefix) => url.startsWith(prefix))
      if (!match) return realFetch(input, init)
      return Promise.resolve(Response.json(responses[match]))
    })
  }

  function cookiesOf(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers['set-cookie']
    const all = (Array.isArray(raw) ? raw : [raw]).filter((c): c is string => typeof c === 'string')
    return all.map((c) => c.split(';')[0]).join('; ')
  }

  /** Start → provider (stubbed) → callback. Returns the signed-in user id, or the error. */
  async function signInWith(
    provider: 'facebook' | 'discord',
  ): Promise<{ userId: string | undefined; location: string }> {
    const start = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      payload: { provider, callbackURL: 'http://localhost:4000/' },
    })
    expect(start.statusCode).toBe(200)
    const state = new URL(start.json<{ url: string }>().url).searchParams.get('state') ?? ''

    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback/${provider}?code=the-code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiesOf(start) },
    })
    const location = String(callback.headers.location ?? '')
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: cookiesOf(callback) },
    })
    const userId = session.json<{ user?: { id: string } } | null>()?.user?.id
    return { userId, location }
  }

  it('Facebook lands in the existing account with the same address', async () => {
    const existing = await signUpAndSignIn(app, emailSender, {
      email: 'sofia.fb@example.com',
      password: 'correct horse battery',
      name: 'Sofia',
    })
    stubProvider({
      'https://graph.facebook.com/v24.0/oauth/access_token': {
        access_token: 'fb-token',
        token_type: 'bearer',
        expires_in: 3600,
      },
      'https://graph.facebook.com/debug_token': {
        data: { is_valid: true, app_id: 'fb-app', user_id: 'fb-1' },
      },
      'https://graph.facebook.com/me': {
        id: 'fb-1',
        name: 'Sofia R.',
        email: 'sofia.fb@example.com',
        picture: { data: { url: 'https://example.com/a.png' } },
      },
    })

    const { userId, location } = await signInWith('facebook')

    expect(location).not.toContain('error')
    expect(userId).toBe(existing.userId)
  })

  it('Discord with a verified address lands in the existing account', async () => {
    const existing = await signUpAndSignIn(app, emailSender, {
      email: 'sofia.discord@example.com',
      password: 'correct horse battery',
      name: 'Sofia',
    })
    stubProvider({
      'https://discord.com/api/oauth2/token': {
        access_token: 'discord-token',
        token_type: 'Bearer',
        expires_in: 3600,
      },
      'https://discord.com/api/users/%40me': {
        id: '80351110224678912',
        username: 'sofia',
        global_name: 'Sofia R.',
        discriminator: '0',
        avatar: null,
        email: 'sofia.discord@example.com',
        verified: true,
      },
    })

    const { userId, location } = await signInWith('discord')

    expect(location).not.toContain('error')
    expect(userId).toBe(existing.userId)
  })

  it('Discord with an unconfirmed address is refused, not merged', async () => {
    // Discord lets an account keep an address it never confirmed. Merging on
    // it would hand this account to whoever typed the address into Discord.
    await signUpAndSignIn(app, emailSender, {
      email: 'sofia.unverified@example.com',
      password: 'correct horse battery',
      name: 'Sofia',
    })
    stubProvider({
      'https://discord.com/api/oauth2/token': {
        access_token: 'discord-token',
        token_type: 'Bearer',
        expires_in: 3600,
      },
      'https://discord.com/api/users/%40me': {
        id: '80351110224678913',
        username: 'not-sofia',
        global_name: null,
        discriminator: '0',
        avatar: null,
        email: 'sofia.unverified@example.com',
        verified: false,
      },
    })

    const { userId, location } = await signInWith('discord')

    expect(location).toContain('account_not_linked')
    expect(userId).toBeUndefined()
  })
})
