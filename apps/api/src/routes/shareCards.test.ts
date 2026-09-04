import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { cardElement } from '../modules/cards/design'
import { renderCard } from '../modules/cards/render'
import type { StorageProviderWithPut, UploadUrl } from '../storage/StorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

/** Holds the bytes instead of talking to B2, and answers with a public URL. */
class MemoryStorage implements StorageProviderWithPut {
  readonly objects = new Map<string, Uint8Array>()

  getUploadUrl(): Promise<UploadUrl> {
    throw new Error('not used')
  }
  putObject(key: string, body: Uint8Array): Promise<string> {
    this.objects.set(key, body)
    return Promise.resolve(`https://media.example.test/${key}`)
  }
  getObject(key: string): Promise<Uint8Array> {
    const bytes = this.objects.get(key)
    if (!bytes) throw new Error(`No such object: ${key}`)
    return Promise.resolve(bytes)
  }
  deleteObject(key: string): Promise<void> {
    this.objects.delete(key)
    return Promise.resolve()
  }
  keyFromPublicUrl(url: string): string | null {
    const prefix = 'https://media.example.test/'
    return url.startsWith(prefix) ? url.slice(prefix.length) : null
  }
}

describe('share cards', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let storage: MemoryStorage
  let cookie: string

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_cards_test')
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_cards_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: 'test-legacy-salt',
    })

    const emailSender = new CapturingEmailSender()
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

    const user = await signUpAndSignIn(app, emailSender, {
      email: 'card@example.com',
      password: PASSWORD,
      name: 'Card Haver',
    })
    cookie = user.cookie
    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie },
      payload: {
        handle: 'cardhaver',
        displayName: 'Card Haver',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    expect(created.statusCode, created.body).toBe(201)
  }, 180_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  function make(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/me/share-card', headers: { cookie }, payload })
  }

  it('renders a PNG, stores it, and hands back the page rather than the picture', async () => {
    const response = await make({
      kind: 'streak',
      shape: 'story',
      headline: '47',
      caption: 'day streak on LangX',
    })
    expect(response.statusCode, response.body).toBe(201)
    const body = response.json<{ id: string; imageUrl: string; shareUrl: string }>()

    // The shared link is the page. A raw bucket URL unfurls as a bare image
    // with no title and gives whoever taps it nowhere to go.
    expect(body.shareUrl).toBe(`https://app.langx.io/s/${body.id}`)
    expect(body.imageUrl).toContain(`cards/`)

    const key = storage.keyFromPublicUrl(body.imageUrl)
    expect(key).not.toBeNull()
    const bytes = storage.objects.get(key!)
    expect(bytes).toBeDefined()
    // The PNG magic number, so this asserts a picture rather than a length.
    expect(Array.from(bytes!.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 60_000)

  it('puts the caller own handle on the card, whatever the body says', async () => {
    const created = await make({
      kind: 'badge',
      shape: 'wide',
      headline: 'First Correction',
      caption: 'badge earned',
      // Not a field the schema has — a card is a claim about who did the
      // thing, so the handle is read from the profile and never from here.
      handle: '@someone-else',
    })
    expect(created.statusCode, created.body).toBe(201)
    const { id } = created.json<{ id: string }>()

    const page = await app.inject({ method: 'GET', url: `/public/share/${id}` })
    expect(page.statusCode, page.body).toBe(200)
    expect(page.json<{ handle: string }>().handle).toBe('@cardhaver')
  }, 60_000)

  it('serves the card to a stranger, and 404s an id that is not one', async () => {
    const created = await make({
      kind: 'rank',
      shape: 'square',
      headline: '#3',
      caption: 'on the LangX token board',
    })
    const { id } = created.json<{ id: string }>()

    // No cookie: this is the page a link lands on.
    const page = await app.inject({ method: 'GET', url: `/public/share/${id}` })
    expect(page.statusCode).toBe(200)
    const card = page.json<{ kind: string; shape: string; imageUrl: string }>()
    expect(card.kind).toBe('rank')
    expect(card.shape).toBe('square')

    const missing = await app.inject({ method: 'GET', url: '/public/share/deadbeefdeadbeef' })
    expect(missing.statusCode).toBe(404)
  }, 60_000)

  it('refuses a card for somebody who is not signed in', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/me/share-card',
      payload: { kind: 'streak', shape: 'story', headline: '1', caption: 'day' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('draws every shape at the size it claims', async () => {
    // The three ratios exist so a card is not cropped or letterboxed by the
    // place it is posted; a shape that renders at the wrong size defeats that
    // silently, since the picture still looks fine on its own.
    const copy = { headline: '7', caption: 'day streak', handle: '@cardhaver' }
    for (const [shape, expected] of [
      ['story', [1080, 1920]],
      ['square', [1080, 1080]],
      ['wide', [1200, 675]],
    ] as const) {
      const png = await renderCard(await cardElement('streak', copy, shape), shape)
      // PNG puts width and height as big-endian 32-bit ints at offset 16.
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([...expected])
    }
  }, 60_000)
})
