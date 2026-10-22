import { MongoMemoryServer } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { createAuth } from './auth'
import { connectToDatabase, type DbHandle } from './db/client'
import { ensureIndexes, INDEXES } from './db/indexes'
import { createEmailSender } from './email/sender'
import { loadEnv } from './env'
import { createStorageProvider } from './storage/createStorageProvider'
import { createTranslationProvider } from './translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from './modules/billing/createRevenueCatClient'

describe('Faz 0 — boot', () => {
  let mongod: MongoMemoryServer
  let handle: DbHandle
  let app: FastifyInstance

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongod.getUri(), 'langx_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: mongod.getUri(),
      MONGODB_DB: 'langx_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
    })

    const emailSender = createEmailSender(env, { warn: () => undefined })
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
      email: emailSender,
    })
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await mongod?.stop()
  })

  it('serves /health with the database up', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok', db: 'up', version: '2.0.0' })
  })

  /**
   * `@fastify/cors` defaults to `GET,HEAD,POST`, which made every `PATCH` and
   * `DELETE` impossible from the web build — editing a profile and
   * unregistering a push token failed at the preflight, before the request
   * existed. Native has no preflight and was unaffected, so the two platforms
   * quietly disagreed about whether the app worked.
   */
  it('allows the methods the app actually uses through a preflight', async () => {
    for (const method of ['PATCH', 'DELETE']) {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/profiles/me',
        headers: {
          origin: 'http://localhost:8081',
          'access-control-request-method': method,
        },
      })
      const allowed = String(response.headers['access-control-allow-methods'] ?? '')
      expect(allowed, `${method} must survive the preflight`).toContain(method)
    }
  })

  it('answers unknown routes with the shared error shape', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('applies every declared index', async () => {
    const results = await ensureIndexes(handle.db)
    expect(results.length).toBe(Object.keys(INDEXES).length)

    for (const [collection, specs] of Object.entries(INDEXES)) {
      const live = await handle.db.collection(collection).indexes()
      const names = new Set(live.map((index) => index.name))
      for (const spec of specs ?? []) {
        expect(names, `${collection}.${spec.name}`).toContain(spec.name)
      }
    }
  })

  it('is idempotent — a second run creates nothing new', async () => {
    const before = await handle.db.collection('profiles').indexes()
    await ensureIndexes(handle.db)
    const after = await handle.db.collection('profiles').indexes()

    expect(after.length).toBe(before.length)
  })

  it('enforces the invariants that uniques exist to guarantee', async () => {
    await ensureIndexes(handle.db)

    // A second conversation between the same two people can never be
    // written, in either participant order — there's no match gate, so this
    // unique index is the only thing standing between "message" and a
    // duplicate thread.
    const conversations = handle.db.collection('conversations')
    await conversations.insertOne({ pairKey: 'a_b', participants: ['a', 'b'] })
    await expect(
      conversations.insertOne({ pairKey: 'a_b', participants: ['b', 'a'] }),
    ).rejects.toThrow(/duplicate key/i)

    // The same message cannot be awarded tokens twice (REST and socket paths).
    const ledger = handle.db.collection('tokenLedger')
    await ledger.insertOne({ userId: 'u1', kind: 'message', refId: 'm1', amount: 2 })
    await expect(
      ledger.insertOne({ userId: 'u1', kind: 'message', refId: 'm1', amount: 2 }),
    ).rejects.toThrow(/duplicate key/i)

    // A cron re-run cannot pay the daily pool out a second time.
    const jobRuns = handle.db.collection('jobRuns')
    await jobRuns.insertOne({ job: 'dailyXpPool', periodKey: '2026-08-26' })
    await expect(
      jobRuns.insertOne({ job: 'dailyXpPool', periodKey: '2026-08-26' }),
    ).rejects.toThrow(/duplicate key/i)
  })
})

/**
 * Who the rate limiter thinks is asking, under `NODE_ENV=production` — the
 * only place proxy headers are read at all, and the only place the limiter's
 * real ceilings apply. `inject` connects from 127.0.0.1, which stands in for
 * the front proxy (Fly's) that every production request arrives through.
 */
describe('rate limiting behind the edge', () => {
  const EDGE_SECRET = 'edge-secret-for-tests'
  let mongod: MongoMemoryServer
  let handle: DbHandle
  let app: FastifyInstance

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongod.getUri(), 'langx_rate_limit_test')
    const env = loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: mongod.getUri(),
      MONGODB_DB: 'langx_rate_limit_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      EDGE_SECRET,
      // Production refuses to boot without it.
      TRUSTED_ORIGINS: 'https://app.example',
    })
    const emailSender = createEmailSender(env, { warn: () => undefined })
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
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await mongod?.stop()
  })

  /** Unauthenticated and limited to 30 a minute, so a 429 is cheap to reach. */
  async function unsubscribe(headers: Record<string, string>): Promise<number> {
    const response = await app.inject({
      method: 'POST',
      url: '/email/unsubscribe?token=not-a-real-token',
      headers,
    })
    return response.statusCode
  }

  it('limits one client however it fills in X-Forwarded-For', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 40; i++) {
      // Proxies append to the header a client sent, so the client chooses
      // every entry but the last — which is the one the front proxy wrote.
      statuses.push(await unsubscribe({ 'x-forwarded-for': `203.0.113.${i + 1}, 198.51.100.7` }))
    }
    expect(statuses).toContain(429)
  })

  it('gives two clients the edge vouches for a bucket each', async () => {
    const first = { 'x-langx-edge': EDGE_SECRET, 'cf-connecting-ip': '192.0.2.10' }
    const second = { 'x-langx-edge': EDGE_SECRET, 'cf-connecting-ip': '192.0.2.11' }

    const statuses: number[] = []
    for (let i = 0; i < 31; i++) statuses.push(await unsubscribe(first))
    expect(statuses.at(-1)).toBe(429)

    expect(await unsubscribe(second)).not.toBe(429)
  })

  it('ignores CF-Connecting-IP that arrives without the edge secret', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 40; i++) {
      statuses.push(
        await unsubscribe({
          'cf-connecting-ip': `192.0.2.${100 + i}`,
          'x-langx-edge': 'not-the-secret',
          'x-forwarded-for': '198.51.100.8',
        }),
      )
    }
    expect(statuses).toContain(429)
  })
})

describe('env', () => {
  it('rejects a missing MONGODB_URI instead of failing at first query', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI/)
  })

  it('treats a blank optional value as unset, not a 0-char string', () => {
    const env = loadEnv({
      MONGODB_URI: 'mongodb://localhost:27017',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      SENTRY_DSN: '',
    })

    expect(env.SENTRY_DSN).toBeUndefined()
  })

  it('requires a real BETTER_AUTH_SECRET — Better Auth cannot run without one', () => {
    expect(() =>
      loadEnv({ MONGODB_URI: 'mongodb://localhost:27017', BETTER_AUTH_SECRET: 'too-short' }),
    ).toThrow(/BETTER_AUTH_SECRET/)
    expect(() => loadEnv({ MONGODB_URI: 'mongodb://localhost:27017' })).toThrow(
      /BETTER_AUTH_SECRET/,
    )
  })

  it('parses TRUSTED_ORIGINS into a list', () => {
    const env = loadEnv({
      MONGODB_URI: 'mongodb://localhost:27017',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      TRUSTED_ORIGINS: 'http://a.test, http://b.test ,',
    })

    expect(env.TRUSTED_ORIGINS).toEqual(['http://a.test', 'http://b.test'])
  })

  /*
   * An empty list makes CORS and the socket fall back to reflecting whatever
   * origin asks, with credentials — fine on a laptop, a credentialed grant to
   * every site on the internet in production.
   */
  it('refuses to boot in production without TRUSTED_ORIGINS', () => {
    const base = {
      MONGODB_URI: 'mongodb://localhost:27017',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      NODE_ENV: 'production',
    }
    expect(() => loadEnv(base)).toThrow(/TRUSTED_ORIGINS/)
    expect(() => loadEnv({ ...base, TRUSTED_ORIGINS: ' , ' })).toThrow(/TRUSTED_ORIGINS/)
    expect(loadEnv({ ...base, TRUSTED_ORIGINS: 'https://app.example' }).TRUSTED_ORIGINS).toEqual([
      'https://app.example',
    ])
  })

  it('still boots without TRUSTED_ORIGINS in development and tests', () => {
    for (const NODE_ENV of ['development', 'test']) {
      const env = loadEnv({
        MONGODB_URI: 'mongodb://localhost:27017',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        NODE_ENV,
      })
      expect(env.TRUSTED_ORIGINS).toEqual([])
    }
  })
})
