import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { PendingUpload } from '../modules/chat/pendingUploads'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const DB_NAME = 'langx_media_test'
const CDN = 'https://cdn.example.com'

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

/**
 * The signing routes, with a storage provider configured.
 *
 * A presigned URL is pure local signing — the presigner never makes a network
 * call to produce one — so a syntactically valid but fake endpoint exercises
 * the real code path with no live bucket. Nothing here PUTs to it, and nothing
 * stores a voice note, which is the one attachment the server reads back.
 */
describe('media routes', () => {
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

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), DB_NAME)
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: DB_NAME,
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      STORAGE_ENDPOINT: 'https://fake-r2.example.com',
      STORAGE_BUCKET: 'langx-media-test',
      STORAGE_ACCESS_KEY_ID: 'fake-access-key-id',
      STORAGE_SECRET_ACCESS_KEY: 'fake-secret-access-key',
      STORAGE_PUBLIC_BASE_URL: CDN,
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
    // Better Auth's first sign-up on a fresh replica set can race the
    // collection's creation; settle it before any test depends on one.
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

  function signedHeaders(uploadUrl: string): string[] {
    return (new URL(uploadUrl).searchParams.get('X-Amz-SignedHeaders') ?? '').split(';')
  }

  function pending(url: string) {
    return handle.db.collection<PendingUpload>(COLLECTIONS.pendingUploads).findOne({ _id: url })
  }

  const ROUTES = [
    { url: '/me/avatar/upload-url', body: { contentType: 'image/png' } },
    { url: '/me/photos/upload-url', body: { contentType: 'image/png' } },
    { url: '/posts/upload-url', body: { kind: 'image', contentType: 'image/png' } },
    { url: '/echo/upload-url', body: { kind: 'image', contentType: 'image/png' } },
  ]

  describe('signed sizes', () => {
    /**
     * The length is what bounds the bytes. Signed as `Content-Length`, the
     * bucket itself refuses a body of any other size; unsigned, one URL takes
     * whatever is sent, up to the provider's own limit of several gigabytes.
     */
    it('signs the stated length into every upload URL', async () => {
      const user = await newUser('sized@example.com')
      for (const route of ROUTES) {
        const response = await app.inject({
          method: 'POST',
          url: route.url,
          headers: { cookie: user.cookie },
          payload: { ...route.body, sizeBytes: 4096 },
        })
        expect(response.statusCode, `${route.url}: ${response.body}`).toBe(200)
        const { uploadUrl } = response.json<{ uploadUrl: string }>()
        expect(signedHeaders(uploadUrl), route.url).toContain('content-length')
      }
    })

    it('will not sign a URL for a file over its kind’s ceiling', async () => {
      const user = await newUser('oversized@example.com')
      for (const route of ROUTES) {
        const response = await app.inject({
          method: 'POST',
          url: route.url,
          headers: { cookie: user.cookie },
          payload: { ...route.body, sizeBytes: MAX_IMAGE_BYTES + 1 },
        })
        expect(response.statusCode, route.url).toBe(413)
        expect(response.json<{ code: string }>().code, route.url).toBe('MEDIA_TOO_LARGE')
      }

      // The ceiling is the kind's, not the image one for everything.
      const video = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        headers: { cookie: user.cookie },
        payload: { kind: 'video', contentType: 'video/mp4', sizeBytes: MAX_IMAGE_BYTES + 1 },
      })
      expect(video.statusCode, video.body).toBe(200)
      const tooLong = await app.inject({
        method: 'POST',
        url: '/echo/upload-url',
        headers: { cookie: user.cookie },
        payload: { kind: 'video', contentType: 'video/mp4', sizeBytes: MAX_VIDEO_BYTES + 1 },
      })
      expect(tooLong.statusCode).toBe(413)
    })

    /**
     * Installed binaries predate the field and cannot be made to send it.
     * Refusing them would break every avatar change on a phone nobody has
     * updated, so they keep the old unsized URL — still recorded for the sweep
     * where the route records — until `minVersion` passes them.
     */
    it('still signs for a build that sends no size, without a length', async () => {
      const user = await newUser('unsized@example.com')
      for (const route of ROUTES) {
        const response = await app.inject({
          method: 'POST',
          url: route.url,
          headers: { cookie: user.cookie },
          payload: route.body,
        })
        expect(response.statusCode, `${route.url}: ${response.body}`).toBe(200)
        const { uploadUrl } = response.json<{ uploadUrl: string }>()
        expect(signedHeaders(uploadUrl), route.url).not.toContain('content-length')
      }
    })
  })

  describe('uploads nobody used', () => {
    async function sign(user: SignedUpUser, url: string, sizeBytes?: number) {
      const response = await app.inject({
        method: 'POST',
        url,
        headers: { cookie: user.cookie },
        payload: {
          kind: 'image',
          contentType: 'image/png',
          ...(sizeBytes ? { sizeBytes } : {}),
        },
      })
      expect(response.statusCode, response.body).toBe(200)
      return response.json<{ publicUrl: string }>().publicUrl
    }

    it('records post and Echo uploads for the sweep, sized or not', async () => {
      const user = await newUser('swept@example.com')
      for (const url of ['/posts/upload-url', '/echo/upload-url']) {
        const sized = await sign(user, url, 4096)
        const unsized = await sign(user, url)
        expect(await pending(sized), url).not.toBeNull()
        expect(await pending(unsized), url).not.toBeNull()
      }
    })

    it('lets a post claim the files it names', async () => {
      const user = await newUser('claim-post@example.com')
      const url = await sign(user, '/posts/upload-url', 4096)
      expect(await pending(url)).not.toBeNull()

      const post = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: user.cookie },
        payload: {
          body: '',
          language: 'en',
          asks: [],
          attachments: [{ url, contentType: 'image/png', sizeBytes: 4096 }],
        },
      })
      expect(post.statusCode, post.body).toBe(201)
      expect(await pending(url)).toBeNull()
    })

    it('lets a correction and a recorded answer claim theirs', async () => {
      const author = await newUser('claim-author@example.com')
      const helper = await newUser('claim-helper@example.com')
      const posted = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: author.cookie },
        payload: { body: 'I goed home', language: 'en', asks: ['correction', 'pronunciation'] },
      })
      expect(posted.statusCode, posted.body).toBe(201)
      const postId = posted.json<{ _id: string }>()._id

      const picture = await sign(helper, '/posts/upload-url', 4096)
      expect(await pending(picture)).not.toBeNull()
      const corrected = await app.inject({
        method: 'POST',
        url: `/posts/${postId}/corrections`,
        headers: { cookie: helper.cookie },
        payload: {
          corrected: 'I went home',
          attachments: [{ url: picture, contentType: 'image/png', sizeBytes: 4096 }],
        },
      })
      expect(corrected.statusCode, corrected.body).toBe(201)
      expect(await pending(picture)).toBeNull()

      // Called without the route's normaliser, which would read the take back
      // from the (fake) bucket to sniff it.
      const { recordPendingUpload } = await import('../modules/chat/pendingUploads')
      const { answerPronunciation } = await import('../modules/feed/pronunciation')
      const key = `posts/${helper.userId}/take.m4a`
      const take = `${CDN}/${key}`
      await recordPendingUpload(handle.db, { url: take, key })
      await answerPronunciation(
        handle.db,
        helper.userId,
        postId,
        { media: { url: take, contentType: 'audio/m4a', sizeBytes: 4096, durationSeconds: 2 } },
        CDN,
      )
      expect(await pending(take)).toBeNull()
    })

    it('lets an Echo card claim the picture saved onto it', async () => {
      const user = await newUser('claim-echo@example.com')
      const made = await app.inject({
        method: 'POST',
        url: '/echo/cards',
        headers: { cookie: user.cookie },
        payload: {
          source: { kind: 'manual', clientId: 'claim-echo', front: 'la grenouille', lang: 'en' },
        },
      })
      expect(made.statusCode, made.body).toBe(201)
      const cardId = made.json<{ card: { _id: string } }>().card._id

      const url = await sign(user, '/echo/upload-url', 4096)
      expect(await pending(url)).not.toBeNull()
      const saved = await app.inject({
        method: 'PATCH',
        url: `/echo/cards/${cardId}`,
        headers: { cookie: user.cookie },
        payload: {
          front: 'la grenouille',
          back: 'the frog',
          image: { url, contentType: 'image/png', sizeBytes: 4096 },
        },
      })
      expect(saved.statusCode, saved.body).toBe(200)
      expect(await pending(url)).toBeNull()
    })

    /**
     * The sweep deletes by the key recorded at signing, so a post upload goes
     * exactly like a chat one: only once its grace period is over, and only
     * when nothing claimed it.
     */
    it('sweeps an unclaimed post upload by its key, and leaves a claimed one', async () => {
      const { recordPendingUpload, sweepUnsentUploads, UNSENT_UPLOAD_GRACE_MS } =
        await import('../modules/chat/pendingUploads')
      const user = await newUser('sweep-post@example.com')
      const used = await sign(user, '/posts/upload-url', 4096)
      await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: user.cookie },
        payload: {
          body: '',
          language: 'en',
          asks: [],
          attachments: [{ url: used, contentType: 'image/png', sizeBytes: 4096 }],
        },
      })
      const signedAt = new Date()
      const unusedKey = `posts/${user.userId}/never.png`
      await recordPendingUpload(handle.db, { url: `${CDN}/${unusedKey}`, key: unusedKey }, signedAt)

      const deleted: string[] = []
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('not used')),
        putObject: () => Promise.reject(new Error('not used')),
        getObject: () => Promise.reject(new Error('not used')),
        deleteObject: (key: string) => {
          deleted.push(key)
          return Promise.resolve()
        },
        keyFromPublicUrl: () => null,
      }
      const later = new Date(signedAt.getTime() + UNSENT_UPLOAD_GRACE_MS + 1000)
      await sweepUnsentUploads(handle.db, storage, { now: later })
      expect(deleted).toContain(unusedKey)
      expect(deleted.some((key) => used.endsWith(key))).toBe(false)
    })

    it('forgets the rows under a prefix the account purge has deleted', async () => {
      const { forgetPendingUploadsUnder, recordPendingUpload } =
        await import('../modules/chat/pendingUploads')
      const mine = 'posts/purged-user/a.png'
      // A user id that merely starts with the purged one is somebody else.
      const theirs = 'posts/purged-user2/a.png'
      await recordPendingUpload(handle.db, { url: `${CDN}/${mine}`, key: mine })
      await recordPendingUpload(handle.db, { url: `${CDN}/${theirs}`, key: theirs })

      await forgetPendingUploadsUnder(handle.db, 'posts/purged-user/')
      expect(await pending(`${CDN}/${mine}`)).toBeNull()
      expect(await pending(`${CDN}/${theirs}`)).not.toBeNull()
    })
  })
})
