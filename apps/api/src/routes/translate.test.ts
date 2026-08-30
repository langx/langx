import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'
import type {
  TranslateInput,
  TranslateResult,
  TranslationProvider,
} from '../translation/TranslationProvider'

const PASSWORD = 'correct horse battery staple'

class FakeTranslationProvider implements TranslationProvider {
  calls = 0
  translate(input: TranslateInput): Promise<TranslateResult> {
    this.calls++
    return Promise.resolve({
      translatedText: `[${input.targetLang}] ${input.text}`,
      sourceLang: 'en',
    })
  }
}

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

describe('POST /translate', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let fakeProvider: FakeTranslationProvider

  async function newUser(email: string) {
    const user = await signUpAndSignIn(app, emailSender, {
      email,
      password: PASSWORD,
      name: 'Test',
    })
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

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_translate_route_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_translate_route_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })

    await ensureIndexes(handle.db)

    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    const storage = createStorageProvider(env)
    const revenueCat = createRevenueCatClientFromEnv(env)
    fakeProvider = new FakeTranslationProvider()
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage,
      translation: fakeProvider,
      revenueCat,
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
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('rejects an unauthenticated request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/translate',
      payload: { text: 'hello', targetLang: 'tr' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('translates and serves the second identical request from cache', async () => {
    const user = await newUser('translate-cache@example.com')

    const first = await app.inject({
      method: 'POST',
      url: '/translate',
      headers: { cookie: user.cookie },
      payload: { text: 'how are you', targetLang: 'tr' },
    })
    expect(first.statusCode, first.body).toBe(200)
    expect(first.json()).toMatchObject({ translatedText: '[tr] how are you', cached: false })
    expect(fakeProvider.calls).toBe(1)

    const second = await app.inject({
      method: 'POST',
      url: '/translate',
      headers: { cookie: user.cookie },
      payload: { text: 'how are you', targetLang: 'tr' },
    })
    expect(second.statusCode, second.body).toBe(200)
    expect(second.json()).toMatchObject({ translatedText: '[tr] how are you', cached: true })
    expect(fakeProvider.calls).toBe(1) // cache hit — the fake provider was not called again
  })

  it('rejects text over the max length', async () => {
    const user = await newUser('translate-toolong@example.com')
    const response = await app.inject({
      method: 'POST',
      url: '/translate',
      headers: { cookie: user.cookie },
      payload: { text: 'a'.repeat(5000), targetLang: 'tr' },
    })
    expect(response.statusCode).toBe(400)
  })
})
