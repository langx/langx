import { aggregateId } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender } from '../testSupport/authFlow'

/**
 * The two routes that let api.langx.io move off v1's Express without the
 * newsletter form or token.langx.io going dark. Neither has a session, so the
 * harness signs nobody in.
 */
describe('the public routes v1 used to serve', () => {
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
})
