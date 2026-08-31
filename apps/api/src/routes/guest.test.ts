import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import type { Profile } from '../modules/profiles/profiles'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

describe('guests', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_guest_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
    await ensureIndexes(handle.db)
    const revenueCat = createRevenueCatClientFromEnv(env)
    app = await buildApp({
      env,
      db: handle.db,
      client: handle.client,
      auth: await createAuth({
        env,
        db: handle.db,
        client: handle.client,
        emailSender: new CapturingEmailSender(),
        revenueCat,
      }),
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat,
    })
    await app.ready()
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.client.close()
    await replSet?.stop()
  })

  /** The plugin's own endpoint; the cookie it returns is an ordinary session. */
  async function signInAsGuest(): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/api/auth/sign-in/anonymous' })
    if (response.statusCode !== 200) {
      throw new Error(`anonymous sign-in failed (${response.statusCode}): ${response.body}`)
    }
    const cookie = response.headers['set-cookie']
    return Array.isArray(cookie) ? cookie.join('; ') : String(cookie)
  }

  const guestBody = {
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
  }

  it('can create a profile with only languages', async () => {
    const cookie = await signInAsGuest()
    const created = await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })
    expect(created.statusCode, created.body).toBe(201)

    const profile = created.json<Profile>()
    expect(profile.guest).toBe(true)
    // The two things that keep a guest out of everybody else's way.
    expect(profile.settings.discoverable).toBe(false)
    expect(profile.handle.startsWith('guest:')).toBe(true)
  })

  /**
   * A guest has not signed up, and paying the bonus here would pay it twice
   * when they do — the ledger's unique is keyed on the *user id*, and
   * registering mints a new one.
   */
  it('is not paid the signup bonus', async () => {
    const cookie = await signInAsGuest()
    const created = await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })
    const userId = created.json<Profile>()._id

    const ledger = await handle.db
      .collection(COLLECTIONS.tokenLedger)
      .countDocuments({ userId, kind: 'signupBonus' })
    expect(ledger).toBe(0)
  })

  it('can browse', async () => {
    const cookie = await signInAsGuest()
    await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })

    for (const url of ['/discovery', '/feed']) {
      const response = await app.inject({ method: 'GET', url, headers: { cookie } })
      expect(response.statusCode, `${url}: ${response.body}`).toBe(200)
    }
  })

  /**
   * Iterated over a table rather than written out one by one, so a write route
   * added later without `requireMember` fails here rather than shipping.
   */
  it('is refused every write', async () => {
    const cookie = await signInAsGuest()
    await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })

    const writes: InjectOptions[] = [
      { method: 'PATCH', url: '/profiles/me', payload: { bio: 'hello' } },
      { method: 'POST', url: '/profiles/me/location', payload: { lat: 41, lng: 29 } },
      { method: 'DELETE', url: '/profiles/me/location' },
      { method: 'POST', url: '/billing/refresh' },
      {
        method: 'POST',
        url: '/me/devices',
        payload: { pushToken: 'ExponentPushToken[x]', platform: 'ios' },
      },
      { method: 'POST', url: '/blocks', payload: { userId: 'someone' } },
      { method: 'POST', url: '/reports', payload: { userId: 'someone', reason: 'spam' } },
    ]

    for (const write of writes) {
      const where = `${String(write.method)} ${JSON.stringify(write.url)}`
      const response = await app.inject({ ...write, headers: { cookie } })
      expect(response.statusCode, `${where} -> ${response.body}`).toBe(403)
      expect(response.json<{ code: string }>().code, where).toBe('GUEST_ACCOUNT')
    }
  })

  it('never appears in anybody else discovery', async () => {
    const cookie = await signInAsGuest()
    await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })

    const guests = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .countDocuments({ guest: true, 'settings.discoverable': true })
    expect(guests).toBe(0)
  })
})
