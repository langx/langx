import { exportPKCS8, generateKeyPair, importSPKI, jwtVerify, exportSPKI } from 'jose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuth } from './auth'
import { connectToDatabase, type DbHandle } from './db/client'
import type { EmailSender } from './email/sender'
import { loadEnv } from './env'

/**
 * Pure config-wiring checks — does createAuth() turn env vars into the right
 * socialProviders entries — so they don't need a replica set. No OAuth
 * traffic is made; a standalone MongoMemoryServer is enough since
 * betterAuth() doesn't touch the database at construction time.
 */
describe('Faz 1 — OAuth providers activate only when fully configured', () => {
  let mongod: MongoMemoryServer
  let handle: DbHandle
  const noopEmailSender: EmailSender = { deliverable: true, send: () => Promise.resolve() }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongod.getUri(), 'langx_auth_config_test')
  })

  afterAll(async () => {
    await handle?.close()
    await mongod?.stop()
  })

  it('wires no social providers when none are configured', async () => {
    const env = loadEnv({
      MONGODB_URI: mongod.getUri(),
      BETTER_AUTH_SECRET: 'a'.repeat(32),
    })
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: noopEmailSender,
    })

    expect(auth.options.socialProviders).toEqual({})
  })

  it('wires Google once both client vars are set', async () => {
    const env = loadEnv({
      MONGODB_URI: mongod.getUri(),
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    })
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: noopEmailSender,
    })

    expect(auth.options.socialProviders?.google).toMatchObject({
      clientId: 'test-google-client-id',
      clientSecret: 'test-google-client-secret',
    })
    expect(auth.options.socialProviders?.apple).toBeUndefined()
  })

  it('does not wire Google when only one of the two vars is set', async () => {
    const env = loadEnv({
      MONGODB_URI: mongod.getUri(),
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      GOOGLE_CLIENT_ID: 'test-google-client-id',
    })
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: noopEmailSender,
    })

    expect(auth.options.socialProviders?.google).toBeUndefined()
  })

  it('wires Apple with a real, verifiable ES256 client-secret JWT', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true })
    const pem = await exportPKCS8(privateKey)

    const env = loadEnv({
      MONGODB_URI: mongod.getUri(),
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      APPLE_CLIENT_ID: 'tech.newchapter.languageXchange.web',
      APPLE_TEAM_ID: 'TEAMID123',
      APPLE_KEY_ID: 'KEYID456',
      // .env stores PEM with real newlines escaped — env.ts unescapes them.
      APPLE_PRIVATE_KEY: pem.replace(/\n/g, '\\n'),
    })
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: noopEmailSender,
    })

    const apple = auth.options.socialProviders?.apple
    // auth.ts always sets a plain options object, never the lazy function
    // form the type also allows — assert that shape before reading fields.
    if (typeof apple !== 'object')
      throw new Error('expected apple provider options, got a function')
    expect(apple).toMatchObject({
      clientId: 'tech.newchapter.languageXchange.web',
      appBundleIdentifier: 'tech.newchapter.languageXchange',
    })

    const pubKey = await importSPKI(await exportSPKI(publicKey), 'ES256')
    const { payload, protectedHeader } = await jwtVerify(apple.clientSecret ?? '', pubKey, {
      audience: 'https://appleid.apple.com',
    })
    expect(protectedHeader.kid).toBe('KEYID456')
    expect(payload).toMatchObject({
      iss: 'TEAMID123',
      sub: 'tech.newchapter.languageXchange.web',
    })
  })

  it('does not wire Apple when the private key is missing', async () => {
    const env = loadEnv({
      MONGODB_URI: mongod.getUri(),
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      APPLE_CLIENT_ID: 'tech.newchapter.languageXchange.web',
      APPLE_TEAM_ID: 'TEAMID123',
      APPLE_KEY_ID: 'KEYID456',
    })
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: noopEmailSender,
    })

    expect(auth.options.socialProviders?.apple).toBeUndefined()
  })
})
