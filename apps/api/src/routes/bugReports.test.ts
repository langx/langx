import { MAX_IMAGE_BYTES } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { StorageProvider, UploadUrl } from '../storage/StorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const PUBLIC_BASE = 'https://media.example.test'
const SUPPORT = 'bugs@example.test'

/** Signs nothing; remembers which key it was asked for. */
class KeyRecordingStorage implements StorageProvider {
  readonly keys: string[] = []

  getUploadUrl(key: string, contentType: string): Promise<UploadUrl> {
    this.keys.push(key)
    return Promise.resolve({
      uploadUrl: `${PUBLIC_BASE}/${key}?signed`,
      publicUrl: `${PUBLIC_BASE}/${key}`,
      contentType,
      expiresInSeconds: 300,
    })
  }
}

describe('bug reports', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let storage: KeyRecordingStorage
  let emailSender: CapturingEmailSender
  let cookie: string
  let userId: string

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_bug_reports_test')
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_bug_reports_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      STORAGE_PUBLIC_BASE_URL: PUBLIC_BASE,
      SUPPORT_EMAIL: SUPPORT,
    })

    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    storage = new KeyRecordingStorage()
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage,
      email: emailSender,
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
    })
    await app.ready()

    const user = await signUpAndSignIn(app, emailSender, {
      email: 'finder@example.com',
      password: PASSWORD,
      name: 'Bug Finder',
    })
    cookie = user.cookie
    userId = user.userId

    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie },
      payload: {
        handle: 'bugfinder',
        displayName: 'Bug Finder',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    expect(created.statusCode, created.body).toBe(201)
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.client.close()
    await replSet?.stop()
  })

  beforeEach(() => {
    emailSender.messages.length = 0
  })

  function report(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/bug-reports', headers: { cookie }, payload })
  }

  it('mails the report to the support address, replying to the finder', async () => {
    const response = await report({
      body: 'The wallet screen shows a negative balance after a gift is refused.',
    })

    expect(response.statusCode, response.body).toBe(202)
    const mail = emailSender.messages.at(-1)
    expect(mail?.to).toBe(SUPPORT)
    expect(mail?.text).toContain('negative balance')
    expect(mail?.text).toContain('@bugfinder')
    expect(mail?.text).toContain(userId)
    expect(mail?.headers?.['Reply-To']).toBe('finder@example.com')
  })

  it('carries the proof as links', async () => {
    const response = await report({
      body: 'Here is what the wallet screen looks like when it happens.',
      attachments: [
        {
          url: `${PUBLIC_BASE}/bug-reports/${userId}/proof.jpg`,
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        },
      ],
    })

    expect(response.statusCode, response.body).toBe(202)
    expect(emailSender.messages.at(-1)?.text).toContain(`${PUBLIC_BASE}/bug-reports/`)
  })

  it('refuses proof that is not in our own bucket', async () => {
    const response = await report({
      body: 'The wallet screen shows a negative balance after a refused gift.',
      attachments: [
        { url: 'https://elsewhere.example/proof.jpg', contentType: 'image/jpeg', sizeBytes: 1024 },
      ],
    })

    expect(response.statusCode).toBe(400)
    expect(emailSender.messages).toHaveLength(0)
  })

  it('refuses proof that is over the ceiling for its kind', async () => {
    const response = await report({
      body: 'The wallet screen shows a negative balance after a refused gift.',
      attachments: [
        {
          url: `${PUBLIC_BASE}/bug-reports/${userId}/proof.jpg`,
          contentType: 'image/jpeg',
          sizeBytes: MAX_IMAGE_BYTES + 1,
        },
      ],
    })

    expect(response.statusCode).toBe(413)
    expect(emailSender.messages).toHaveLength(0)
  })

  it('refuses a report too short to act on', async () => {
    const response = await report({ body: 'broken' })

    expect(response.statusCode).toBe(400)
    expect(emailSender.messages).toHaveLength(0)
  })

  it('signs an upload URL into the bug-report prefix', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/bug-reports/upload-url',
      headers: { cookie },
      payload: { kind: 'image', contentType: 'image/jpeg' },
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(storage.keys.at(-1)).toMatch(new RegExp(`^bug-reports/${userId}/[\\w-]+\\.jpg$`))
  })

  it('will not sign an upload URL for a type it does not serve', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/bug-reports/upload-url',
      headers: { cookie },
      payload: { kind: 'image', contentType: 'application/zip' },
    })

    expect(response.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })
  })

  it('needs a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/bug-reports',
      payload: { body: 'The wallet screen shows a negative balance after a refused gift.' },
    })

    expect(response.statusCode).toBe(401)
    expect(emailSender.messages).toHaveLength(0)
  })
})
