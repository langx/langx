import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SignInMethods } from '@langx/shared'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { authId } from '../lib/authId'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

describe('sign-in methods', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string): Promise<{ user: SignedUpUser; handle: string }> {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const body = onboardingBody()
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: body,
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return { user, handle: body.handle }
  }

  function methods(user: SignedUpUser) {
    return app.inject({
      method: 'GET',
      url: '/me/sign-in-methods',
      headers: { cookie: user.cookie },
    })
  }

  /**
   * What an account made with Google or Apple looks like: a provider row and
   * no `credential` row at all. Written directly because the alternative is
   * driving a real OAuth round trip against Google in a unit test.
   */
  async function linkProvider(userId: string, provider: string, createdAt: Date) {
    await handle.db.collection(COLLECTIONS.account).insertOne({
      userId: authId(userId),
      providerId: provider,
      accountId: `${provider}-${userId}`,
      createdAt,
      updatedAt: createdAt,
    })
  }

  async function dropPassword(userId: string) {
    await handle.db
      .collection(COLLECTIONS.account)
      .deleteMany({ userId: authId(userId), providerId: 'credential' })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_signin_methods_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_signin_methods_test',
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
    })
    await app.ready()

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
  }, 180_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('needs a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/me/sign-in-methods' })).statusCode).toBe(401)
  })

  it('reports the password an email sign-up already has, and no links', async () => {
    const { user, handle: userHandle } = await newUser('methods-password@example.com')

    const body = (await methods(user)).json<SignInMethods>()

    expect(body.hasPassword).toBe(true)
    expect(body.email).toBe('methods-password@example.com')
    expect(body.handle).toBe(userHandle)
    expect(body.linked).toEqual([])
  })

  it('lists linked providers oldest first', async () => {
    const { user } = await newUser('methods-linked@example.com')
    await linkProvider(user.userId, 'apple', new Date('2026-03-02T00:00:00.000Z'))
    await linkProvider(user.userId, 'google', new Date('2026-01-05T00:00:00.000Z'))

    const body = (await methods(user)).json<SignInMethods>()

    expect(body.linked.map((row) => row.provider)).toEqual(['google', 'apple'])
    expect(body.linked[0]?.linkedAt).toBe('2026-01-05T00:00:00.000Z')
  })

  /**
   * The whole point of the screen: somebody who only ever tapped "Continue
   * with Apple" has no password, and nothing else in the app tells them.
   */
  it('reports no password for an account that only has a provider', async () => {
    const { user } = await newUser('methods-oauth-only@example.com')
    await linkProvider(user.userId, 'apple', new Date('2026-02-01T00:00:00.000Z'))
    await dropPassword(user.userId)

    const body = (await methods(user)).json<SignInMethods>()

    expect(body.hasPassword).toBe(false)
    expect(body.linked.map((row) => row.provider)).toEqual(['apple'])
  })

  /**
   * A `credential` row with no hash cannot be signed in with. Reporting it as
   * a password would tell somebody they have a fallback they do not have.
   */
  it('does not count a credential row that carries no hash', async () => {
    const { user } = await newUser('methods-empty-credential@example.com')
    await handle.db
      .collection(COLLECTIONS.account)
      .updateMany(
        { userId: authId(user.userId), providerId: 'credential' },
        { $unset: { password: '' } },
      )

    expect((await methods(user)).json<SignInMethods>().hasPassword).toBe(false)
  })

  /** A provider the app does not offer has no name or icon on the screen. */
  it('drops providers the app does not offer', async () => {
    const { user } = await newUser('methods-unknown-provider@example.com')
    await linkProvider(user.userId, 'github', new Date('2026-01-01T00:00:00.000Z'))

    expect((await methods(user)).json<SignInMethods>().linked).toEqual([])
  })

  it('sets a first password, and then signs in with it', async () => {
    const { user } = await newUser('methods-set-password@example.com')
    await dropPassword(user.userId)
    expect((await methods(user)).json<SignInMethods>().hasPassword).toBe(false)

    const set = await app.inject({
      method: 'POST',
      url: '/me/password',
      headers: { cookie: user.cookie },
      payload: { password: 'a brand new passphrase' },
    })
    expect(set.statusCode).toBe(204)
    expect((await methods(user)).json<SignInMethods>().hasPassword).toBe(true)

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'methods-set-password@example.com', password: 'a brand new passphrase' },
    })
    expect(signIn.statusCode).toBe(200)
  })

  it('refuses to overwrite a password that already exists', async () => {
    const { user } = await newUser('methods-already-set@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/me/password',
      headers: { cookie: user.cookie },
      payload: { password: 'some other passphrase' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json<{ code: string }>().code).toBe('PASSWORD_ALREADY_SET')

    // And the original still works — the refusal did not half-apply.
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'methods-already-set@example.com', password: PASSWORD },
    })
    expect(signIn.statusCode).toBe(200)
  })

  it('signs in with the handle instead of the address', async () => {
    const { handle: userHandle } = await newUser('handle-signin@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: userHandle, password: PASSWORD },
    })

    expect(response.statusCode).toBe(200)
  })

  /** `@sofia` is what people type when asked for a handle. */
  it('accepts a handle typed with a leading @ or in capitals', async () => {
    const { handle: userHandle } = await newUser('handle-signin-at@example.com')

    for (const typed of [`@${userHandle}`, userHandle.toUpperCase(), `  @${userHandle}  `]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: typed, password: PASSWORD },
      })
      expect(response.statusCode, typed).toBe(200)
    }
  })

  it('still signs in with the address', async () => {
    await newUser('handle-signin-email@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'handle-signin-email@example.com', password: PASSWORD },
    })

    expect(response.statusCode).toBe(200)
  })

  it('refuses the right handle with the wrong password', async () => {
    const { handle: userHandle } = await newUser('handle-signin-wrong@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: userHandle, password: 'not the password' },
    })

    expect(response.statusCode).not.toBe(200)
  })

  /**
   * The reason a miss falls through rather than answering: an unknown handle
   * and a known handle with a wrong password must be indistinguishable, or
   * this becomes a way to ask which handles have accounts.
   */
  it('answers an unknown handle exactly as it answers a wrong password', async () => {
    const { handle: userHandle } = await newUser('handle-signin-oracle@example.com')

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'nobodyhasthishandle', password: 'not the password' },
    })
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: userHandle, password: 'not the password' },
    })

    expect(unknown.statusCode).toBe(wrongPassword.statusCode)
    expect(unknown.json<{ code?: string }>().code).toBe(
      wrongPassword.json<{ code?: string }>().code,
    )
  })

  it('rejects a password shorter than the shared minimum', async () => {
    const { user } = await newUser('methods-short-password@example.com')
    await dropPassword(user.userId)

    const response = await app.inject({
      method: 'POST',
      url: '/me/password',
      headers: { cookie: user.cookie },
      payload: { password: 'abc' },
    })

    expect(response.statusCode).toBe(400)
  })
})
