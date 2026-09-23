import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { SafeGet, SafeGetOptions } from '../modules/linkPreview/safeFetch'
import type { StorageProviderWithPut, UploadUrl } from '../storage/StorageProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

// The smallest thing `sniffImageType` reads as a PNG.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2])

const PAGE = `<html><head>
  <meta property="og:title" content="A page about &amp; things">
  <meta property="og:description" content="The description">
  <meta property="og:image" content="/cover.png">
</head></html>`

class MemoryStorage implements StorageProviderWithPut {
  objects = new Map<string, { body: Uint8Array; contentType: string }>()
  getUploadUrl(): Promise<UploadUrl> {
    return Promise.reject(new Error('not used'))
  }
  putObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
    this.objects.set(key, { body, contentType })
    return Promise.resolve(`https://media.test/${key}`)
  }
  getObject(): Promise<Uint8Array> {
    return Promise.reject(new Error('not used'))
  }
  deleteObject(): Promise<void> {
    return Promise.resolve()
  }
  keyFromPublicUrl(): string | null {
    return null
  }
}

describe('GET /link-preview', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let storage: MemoryStorage
  let cookie: string
  const calls: { address: string; options: SafeGetOptions }[] = []

  const fakeFetch: SafeGet = (address, options) => {
    calls.push({ address, options })
    const url = new URL(address)
    if (url.pathname === '/cover.png') {
      return Promise.resolve({ url, contentType: 'image/png', body: PNG })
    }
    if (url.hostname === 'down.example.com') return Promise.resolve(null)
    if (url.hostname === 'bare.example.com') {
      return Promise.resolve({ url, contentType: 'text/html', body: Buffer.from('<p>hi</p>') })
    }
    return Promise.resolve({ url, contentType: 'text/html', body: Buffer.from(PAGE) })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_link_preview_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_link_preview_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    await ensureIndexes(handle.db)
    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    storage = new MemoryStorage()
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage,
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
      email: emailSender,
      linkFetch: fakeFetch,
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
    const user = await signUpAndSignIn(app, emailSender, {
      email: 'links@example.com',
      password: PASSWORD,
      name: 'Links',
    })
    cookie = user.cookie
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(() => {
    calls.length = 0
  })

  function get(url: string, withCookie = true) {
    return app.inject({
      method: 'GET',
      url: `/link-preview?url=${encodeURIComponent(url)}`,
      headers: withCookie ? { cookie } : {},
    })
  }

  it('rejects an unauthenticated request', async () => {
    expect((await get('https://example.com/', false)).statusCode).toBe(401)
  })

  it('reads the page, copies its picture into the bucket, and caches the card', async () => {
    const first = await get('https://example.com/post#comments')
    expect(first.statusCode).toBe(200)
    const { preview } = first.json<{ preview: Record<string, unknown> }>()
    expect(preview).toMatchObject({
      url: 'https://example.com/post',
      siteName: 'example.com',
      title: 'A page about & things',
      description: 'The description',
    })
    expect(preview.image).toMatch(/^https:\/\/media\.test\/link-previews\/[0-9a-f]{64}\.png$/)
    expect([...storage.objects.values()][0]?.contentType).toBe('image/png')
    expect(calls.map((c) => c.address)).toEqual([
      'https://example.com/post',
      'https://example.com/cover.png',
    ])

    // Same page, another fragment: one row, no second fetch.
    const second = await get('https://example.com/post#top')
    expect(second.json()).toEqual(first.json())
    expect(calls).toHaveLength(2)
  })

  it('answers null for a page that cannot be read, and remembers that too', async () => {
    expect((await get('https://down.example.com/')).json()).toEqual({ preview: null })
    expect((await get('https://down.example.com/')).json()).toEqual({ preview: null })
    expect(calls).toHaveLength(1)
  })

  it('answers null for a page with nothing to put on a card', async () => {
    expect((await get('https://bare.example.com/')).json()).toEqual({ preview: null })
  })

  it('never asks the fetcher about an address it must not reach', async () => {
    for (const address of ['http://127.0.0.1/', 'http://localhost:4000/', 'file:///etc/passwd']) {
      expect((await get(address)).json()).toEqual({ preview: null })
    }
    expect(calls).toHaveLength(0)
  })
})
