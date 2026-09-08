import { aggregateId } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { INSIGHT_IMAGES } from '../modules/insight/page'
import { resetPublicStatsCache } from '../modules/insight/publicStats'
import { CONTRIBUTORS_TOP, resetContributorsCache } from '../modules/kitchen/contributors'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender } from '../testSupport/authFlow'

/** Stands in for the web build's origin; the two sites below are not on it. */
const TRUSTED_ORIGIN = 'https://app.example.test'

/**
 * Everything under `/public/`: the two routes that let api.langx.io move off
 * v1's Express without the newsletter form or token.langx.io going dark, and
 * the stats page that joined them. None of it has a session, so the harness
 * signs nobody in.
 */
describe('the routes anybody can call', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_public_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_public_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      TRUSTED_ORIGINS: TRUSTED_ORIGIN,
      // Deliberately no RESEND_AUDIENCE_ID: the unconfigured path is the one
      // a self-hosted instance hits, and it must refuse rather than lie.
    })
    await ensureIndexes(handle.db)
    const emailSender = new CapturingEmailSender()
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
  }, 120_000)

  afterAll(async () => {
    await app.close()
    await handle.close()
    await replSet.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.profiles, COLLECTIONS.tokenAggregates]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  describe('POST /public/newsletter', () => {
    it('refuses a bad address before touching any provider', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/public/newsletter',
        payload: { email: 'not-an-address' },
      })
      expect(response.statusCode).toBe(400)
    })

    /** Never a silent "ok" that subscribed nobody. */
    it('fails loudly when no audience is configured', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/public/newsletter',
        payload: { email: 'reader@example.com' },
      })
      expect(response.statusCode).toBe(500)
      expect(response.json<{ status?: string }>().status).toBeUndefined()
    })

    it('needs no session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/public/newsletter',
        payload: { email: 'reader@example.com' },
      })
      expect(response.statusCode).not.toBe(401)
    })
  })

  describe('GET /public/leaderboard/token', () => {
    it('answers an empty board without a session, and caches it', async () => {
      const response = await app.inject({ method: 'GET', url: '/public/leaderboard/token' })
      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toContain('max-age')
      expect(response.json()).toEqual({ period: 'all', entries: [] })
    })

    it('shows rank, handle and tokens — and nothing about a viewer', async () => {
      const now = new Date()
      const people = [
        { id: 'a', handle: 'ada', tokens: 300 },
        { id: 'b', handle: 'bo', tokens: 300 },
        { id: 'c', handle: 'cy', tokens: 100 },
      ]
      for (const p of people) {
        await handle.db.collection(COLLECTIONS.profiles).insertOne({
          _id: p.id,
          handle: p.handle,
          displayName: p.handle.toUpperCase(),
          entitlement: { tier: 'free' },
          streak: { current: 1, longest: 1, lastQualifiedDay: '2026-09-01' },
          settings: { discoverable: true, notifications: {} },
        } as never)
        await handle.db.collection(COLLECTIONS.tokenAggregates).insertOne({
          _id: aggregateId(p.id, 'all', 'all'),
          userId: p.id,
          periodType: 'all',
          periodKey: 'all',
          tokens: p.tokens,
          updatedAt: now,
        } as never)
      }

      const response = await app.inject({ method: 'GET', url: '/public/leaderboard/token' })
      const body = response.json<{ entries: Record<string, unknown>[] }>()
      expect(body.entries.map((e) => [e.rank, e.handle, e.tokens])).toEqual([
        [1, 'ada', 300],
        [1, 'bo', 300],
        [3, 'cy', 100],
      ])
      for (const entry of body.entries) {
        expect(entry).not.toHaveProperty('isViewer')
        expect(entry).not.toHaveProperty('userId')
      }
      expect(body).not.toHaveProperty('viewer')
    })
  })

  describe('the public stats page', () => {
    beforeEach(() => {
      resetPublicStatsCache()
    })

    it('counts members, and says nothing about any of them', async () => {
      for (const [id, guest] of [
        ['ada', false],
        ['bo', false],
        ['visitor', true],
      ] as const) {
        await handle.db.collection(COLLECTIONS.profiles).insertOne({
          _id: id,
          handle: id,
          displayName: id.toUpperCase(),
          nativeLanguages: [{ code: 'tr' }],
          learning: [{ code: 'en', level: 'a2', priority: 0 }],
          streak: { current: 1, longest: 2, lastQualifiedDay: '2026-09-01' },
          createdAt: new Date(),
          ...(guest ? { guest: true } : {}),
        } as never)
      }

      const response = await app.inject({ method: 'GET', url: '/public/stats' })
      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toContain('max-age')

      const body = response.json<Record<string, unknown>>()
      expect(body.totals).toMatchObject({ members: 2 })
      // Nothing on this page may be narrowed to a person, so the body must
      // carry no id, handle or name at all — not even one that would be true.
      // Quoted, because `ada` is a substring of a language name (Kannada) and
      // a bare match would fail on a body that leaked nothing.
      expect(JSON.stringify(body)).not.toMatch(/"ada"|handle|displayName/)
    })

    it('serves the page that draws them', async () => {
      const response = await app.inject({ method: 'GET', url: '/public/insight' })
      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('text/html')
      expect(response.body).toContain('/public/stats')
    })

    it('serves the brand images it names, and only those', async () => {
      for (const asset of INSIGHT_IMAGES) {
        const response = await app.inject({ method: 'GET', url: `/public/insight/${asset}` })
        expect(response.statusCode).toBe(200)
        expect(response.headers['content-type']).toContain('image/png')
        expect(response.rawPayload.byteLength).toBeGreaterThan(0)
      }
      // The list is closed, so the route cannot be walked out of the assets
      // directory — the parameter never reaches the filesystem as typed.
      const stranger = await app.inject({ method: 'GET', url: '/public/insight/..%2f..%2fenv.ts' })
      expect(stranger.statusCode).toBe(400)
    })
  })

  /**
   * Both pages live on other origins, so the browser only hands them a
   * response that names their origin. The first deploy did not, and curl's
   * 200 hid a CORS error on every page load.
   */
  describe('CORS on /public/*', () => {
    it('lets any origin read a public route, without credentials', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/public/leaderboard/token',
        headers: { origin: 'https://token.langx.io' },
      })
      expect(response.statusCode).toBe(200)
      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-credentials']).toBeUndefined()
    })

    it('answers the JSON preflight the newsletter form sends', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/public/newsletter',
        headers: {
          origin: 'https://langx.io',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      })
      expect(response.statusCode).toBe(204)
      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toContain('POST')
      expect(response.headers['access-control-allow-headers']).toContain('content-type')
    })

    it('keeps every other route on the trusted-origin list', async () => {
      const stranger = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'https://token.langx.io' },
      })
      expect(stranger.headers['access-control-allow-origin']).toBeUndefined()

      const trusted = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: TRUSTED_ORIGIN },
      })
      expect(trusted.headers['access-control-allow-origin']).toBe(TRUSTED_ORIGIN)
      expect(trusted.headers['access-control-allow-credentials']).toBe('true')
    })
  })

  describe('the contributor strip on Our Kitchen', () => {
    const gitHubRow = (login: string, type = 'User') => ({
      login,
      avatar_url: `https://avatars.example/${login}`,
      html_url: `https://github.com/${login}`,
      type,
    })

    beforeEach(async () => {
      resetContributorsCache()
      await handle.db.collection(COLLECTIONS.githubContributors).deleteMany({})
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('lists the most active first, drops bots, and caches the answer', async () => {
      const rows = [
        ...Array.from({ length: 8 }, (_, i) => gitHubRow(`dev${i}`)),
        gitHubRow('dependabot[bot]', 'Bot'),
      ]
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)

      const first = await app.inject({ method: 'GET', url: '/public/contributors' })
      expect(first.statusCode, first.body).toBe(200)
      expect(first.headers['cache-control']).toContain('max-age=')
      const body = first.json<{
        total: number
        top: { login: string; avatarUrl: string; url: string }[]
      }>()
      // Eight people; the bot is not one of them.
      expect(body.total).toBe(8)
      expect(body.top).toHaveLength(CONTRIBUTORS_TOP)
      expect(body.top[0]).toEqual({
        login: 'dev0',
        avatarUrl: 'https://avatars.example/dev0',
        url: 'https://github.com/dev0',
      })

      // The second read is served from the cache: GitHub is not asked again.
      await app.inject({ method: 'GET', url: '/public/contributors' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('serves the last good list when GitHub refuses, and nothing when it never answered', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('rate limited', { status: 403 })),
      )
      const cold = await app.inject({ method: 'GET', url: '/public/contributors' })
      expect(cold.statusCode).toBe(200)
      expect(cold.json()).toEqual({ total: 0, top: [] })

      // An old answer in Mongo, older than the TTL, from another process.
      await handle.db.collection(COLLECTIONS.githubContributors).insertOne({
        _id: 'langx/langx' as never,
        fetchedAt: new Date(0),
        view: { total: 3, top: [{ login: 'old', avatarUrl: 'a', url: 'u' }] },
      })
      const stale = await app.inject({ method: 'GET', url: '/public/contributors' })
      expect(stale.json<{ total: number }>().total).toBe(3)
    })
  })
})
