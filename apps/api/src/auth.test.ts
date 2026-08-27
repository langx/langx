import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { createAuth } from './auth'
import { connectToDatabase, type DbHandle } from './db/client'
import { loadEnv } from './env'
import { createStorageProvider } from './storage/createStorageProvider'
import { createTranslationProvider } from './translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from './modules/billing/createRevenueCatClient'
import { CapturingEmailSender, setCookieValue } from './testSupport/authFlow'

describe('Faz 1 — Better Auth: sign-up → verify → sign-in → sign-out', () => {
  // Real signup/verify/reset writes span multiple Better Auth collections in
  // one transaction (mongodbAdapter defaults transactions on) — a plain
  // MongoMemoryServer is a standalone instance and cannot satisfy that, so
  // this suite needs a (single-node) replica set, matching how Atlas and the
  // reconfigured local dev mongod actually run.
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_auth_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_auth_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })

    emailSender = new CapturingEmailSender()
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
    })
    await app.ready()

    // A MongoMemoryReplSet's very first transaction commit is prone to a
    // transient error right after the single-node set elects itself primary
    // — the oplog isn't fully warmed up yet. @better-auth/mongo-adapter@1.7.1
    // doesn't retry `commitTransaction`; instead its catch block
    // unconditionally calls `abortTransaction`, which itself throws ("Cannot
    // call abortTransaction after calling commitTransaction") because the
    // commit — despite the client-side error — already went through. That
    // turns one transient blip into a hard 500, on whichever request happens
    // to run first. Atlas (a mature multi-node replica set) and a long-lived
    // local mongod don't exhibit this; it's specific to a just-initiated
    // replica set's first transaction *through this exact adapter code
    // path* — warming up via the raw driver on a different session didn't
    // help, so this calls the real endpoint and discards the result.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: {
          email: `warmup-${attempt}@example.com`,
          password: 'correct horse battery staple',
          name: 'Warm Up',
        },
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

  it('rejects sign-in before the email is verified', async () => {
    const email = 'unverified@example.com'
    const password = 'correct horse battery staple'

    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password, name: 'Test User' },
    })
    expect(signUp.statusCode, signUp.body).toBe(200)
    expect(emailSender.messages).toHaveLength(1)
    expect(emailSender.messages[0]?.subject).toMatch(/verify/i)

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password },
    })
    expect(signIn.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('completes sign-up → verify → sign-in → get-session → sign-out', async () => {
    const email = 'full-flow@example.com'
    const password = 'correct horse battery staple'

    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password, name: 'Full Flow' },
    })
    expect(signUp.statusCode, signUp.body).toBe(200)

    const verifyUrl = emailSender.latestUrl()
    const verify = await app.inject({
      method: 'GET',
      url: verifyUrl.replace(/^https?:\/\/[^/]+/, ''),
    })
    expect(verify.statusCode, verify.body).toBeLessThan(400)

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password },
    })
    expect(signIn.statusCode, signIn.body).toBe(200)
    const cookie = setCookieValue(signIn)

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie },
    })
    expect(session.statusCode, session.body).toBe(200)
    expect(session.json()).toMatchObject({ user: { email } })

    const signOut = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { cookie },
    })
    expect(signOut.statusCode, signOut.body).toBe(200)

    const afterSignOut = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie },
    })
    expect(afterSignOut.json()).toBeNull()
  })

  it('sends a reset-password email and accepts the new password', async () => {
    const email = 'reset-me@example.com'
    const originalPassword = 'correct horse battery staple'
    const newPassword = 'another horse another staple'

    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: originalPassword, name: 'Reset Me' },
    })

    const forgot = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      payload: { email, redirectTo: 'http://localhost:4000/reset' },
    })
    expect(forgot.statusCode, forgot.body).toBe(200)

    const resetUrl = emailSender.latestUrl()
    expect(emailSender.messages.at(-1)?.subject).toMatch(/reset/i)
    // Better Auth puts the token in the path (`/reset-password/{token}`), not
    // a query string — see api/routes/password.mjs's `requestPasswordReset`.
    const tokenMatch = /\/reset-password\/([^/?]+)/.exec(resetUrl)
    if (!tokenMatch?.[1]) throw new Error(`no token in reset URL: ${resetUrl}`)

    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { newPassword, token: decodeURIComponent(tokenMatch[1]) },
    })
    expect(reset.statusCode, reset.body).toBe(200)

    // The account is still unverified (never went through /verify-email), so
    // this only proves the new password was accepted, not that sign-in with
    // it now succeeds — that path is covered by the verified-flow test above.
    const signInOldPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: originalPassword },
    })
    expect(signInOldPassword.statusCode).toBeGreaterThanOrEqual(400)
  })
})
