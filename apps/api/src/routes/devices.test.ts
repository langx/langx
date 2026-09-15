import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Device } from '../modules/push/devices'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

function onboardingBody() {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
  }
}

/**
 * What signing out has to be able to do, and the shape of the call it makes.
 *
 * The point of these is the *absence* of a push token: the app can only
 * produce one by asking iOS to register for remote notifications and then
 * asking Expo's server, neither of which answers on a timetable, and a
 * sign-out that waits for that is a sign-out that can fail to happen at all.
 * The installation id is a local read, so the route has to accept it alone.
 */
describe('DELETE /me/devices — withdrawing an installation by its id', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string): Promise<SignedUpUser> {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  function register(user: SignedUpUser, deviceId: string, pushToken: string) {
    return app.inject({
      method: 'POST',
      url: '/me/devices',
      headers: { cookie: user.cookie },
      payload: { pushToken, platform: 'ios', deviceId },
    })
  }

  function rowsFor(userId: string) {
    return handle.db.collection<Device>(COLLECTIONS.devices).find({ userId }).toArray()
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_devices_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_devices_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })

    await ensureIndexes(handle.db)

    emailSender = new CapturingEmailSender()
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

    // Same first-transaction warm-up as the other route suites.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    emailSender.messages.length = 0
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('removes the row for that installation, with no push token in the call', async () => {
    const user = await newUser('unregister-me@example.com')
    expect((await register(user, 'phone-a', 'ExponentPushToken[a]')).statusCode).toBe(204)

    const response = await app.inject({
      method: 'DELETE',
      url: '/me/devices?deviceId=phone-a',
      headers: { cookie: user.cookie },
    })

    expect(response.statusCode).toBe(204)
    expect(await rowsFor(user.userId)).toHaveLength(0)
  })

  it('leaves this account’s other devices alone', async () => {
    const user = await newUser('two-devices@example.com')
    await register(user, 'phone-b', 'ExponentPushToken[b]')
    await register(user, 'tablet-b', 'ExponentPushToken[c]')

    await app.inject({
      method: 'DELETE',
      url: '/me/devices?deviceId=phone-b',
      headers: { cookie: user.cookie },
    })

    const left = await rowsFor(user.userId)
    expect(left.map((row) => row.deviceId)).toEqual(['tablet-b'])
  })

  /*
   * The row belongs to whoever is signed in, and only to them: signing out on
   * a borrowed phone must not reach the row the lender's account has for it.
   */
  it('cannot reach another account’s row for the same installation', async () => {
    const lender = await newUser('lender@example.com')
    const borrower = await newUser('borrower@example.com')
    await register(lender, 'shared-phone', 'ExponentPushToken[d]')
    await register(borrower, 'shared-phone', 'ExponentPushToken[e]')

    await app.inject({
      method: 'DELETE',
      url: '/me/devices?deviceId=shared-phone',
      headers: { cookie: borrower.cookie },
    })

    expect(await rowsFor(borrower.userId)).toHaveLength(0)
    expect(await rowsFor(lender.userId)).toHaveLength(1)
  })

  // The caller asked for the device to be gone. It is.
  it('answers 204 for an installation this account has no row for', async () => {
    const user = await newUser('never-registered@example.com')

    const response = await app.inject({
      method: 'DELETE',
      url: '/me/devices?deviceId=phone-nobody-registered',
      headers: { cookie: user.cookie },
    })

    expect(response.statusCode).toBe(204)
  })

  it('refuses a caller with no session', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/me/devices?deviceId=phone-a' })
    expect(response.statusCode).toBe(401)
  })
})
