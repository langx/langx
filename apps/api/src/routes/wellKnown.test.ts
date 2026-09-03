import { MongoMemoryServer } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { createEmailSender } from '../email/sender'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const ASSOCIATION_PATH = '/.well-known/apple-developer-domain-association.txt'
const TOKEN = '5A2F1C…apple-generated-token'

/**
 * Apple fetches this file itself, so nothing about the request comes from us:
 * the assertions below are the whole contract — the exact path, `text/plain`,
 * 200, and the bytes unchanged.
 */
async function buildAppWith(
  handle: DbHandle,
  mongoUri: string,
  extra: Record<string, string>,
): Promise<FastifyInstance> {
  const env = loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: mongoUri,
    MONGODB_DB: 'langx_wellknown_test',
    LOG_LEVEL: 'silent',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    ...extra,
  })
  const emailSender = createEmailSender(env, { warn: () => undefined })
  const app = await buildApp({
    env,
    client: handle.client,
    db: handle.db,
    auth: await createAuth({ env, db: handle.db, client: handle.client, emailSender }),
    storage: createStorageProvider(env),
    translation: createTranslationProvider(env),
    revenueCat: createRevenueCatClientFromEnv(env),
  })
  await app.ready()
  return app
}

describe('the Apple domain association file', () => {
  let mongod: MongoMemoryServer
  let handle: DbHandle
  let configured: FastifyInstance
  let unconfigured: FastifyInstance

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongod.getUri(), 'langx_wellknown_test')
    configured = await buildAppWith(handle, mongod.getUri(), {
      APPLE_DOMAIN_ASSOCIATION: TOKEN,
    })
    unconfigured = await buildAppWith(handle, mongod.getUri(), {})
  })

  afterAll(async () => {
    await configured?.close()
    await unconfigured?.close()
    await handle?.close()
    await mongod?.stop()
  })

  it('serves the token as plain text, byte for byte', async () => {
    const response = await configured.inject({ method: 'GET', url: ASSOCIATION_PATH })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toBe(TOKEN)
  })

  /**
   * Apple does not follow redirects, so a 30x here fails verification just as
   * surely as a 404 — and would be the harder of the two to spot, since a
   * browser would happily show the file.
   */
  it('answers on the exact path only, with no redirect', async () => {
    const response = await configured.inject({ method: 'GET', url: ASSOCIATION_PATH })
    expect(response.statusCode).not.toBe(301)
    expect(response.statusCode).not.toBe(302)

    const wrongPath = await configured.inject({
      method: 'GET',
      url: '/.well-known/apple-developer-domain-association',
    })
    expect(wrongPath.statusCode).toBe(404)
  })

  it('404s rather than serving an empty file when no token is configured', async () => {
    const response = await unconfigured.inject({ method: 'GET', url: ASSOCIATION_PATH })

    expect(response.statusCode).toBe(404)
    expect(response.body).not.toBe('')
  })
})
