import { MongoMemoryServer } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { createAuth } from './auth'
import { connectToDatabase, type DbHandle } from './db/client'
import { ensureIndexes, INDEXES } from './db/indexes'
import { createEmailSender } from './email/sender'
import { loadEnv } from './env'

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

    app = await buildApp({ env, client: handle.client, db: handle.db, auth })
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

    // The same message cannot be awarded XP twice (REST and socket paths).
    const ledger = handle.db.collection('xpLedger')
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
})
