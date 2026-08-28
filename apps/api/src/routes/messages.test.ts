import { MAX_IMAGE_BYTES, PLAN_LIMITS } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import type { Profile } from '../modules/profiles/profiles'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthYear: 1995,
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

describe('Faz 5 — conversation/message history REST', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, profileOverrides: Record<string, unknown> = {}) {
    const user = await signUpAndSignIn(app, emailSender, {
      email,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(profileOverrides),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return { ...user, handle: response.json<{ handle: string }>().handle }
  }

  async function startConversation(from: SignedUpUser, toUserId: string, body = 'hi') {
    const response = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: from.cookie },
      payload: { toUserId, body },
    })
    if (response.statusCode !== 201) {
      throw new Error(`start conversation failed (${response.statusCode}): ${response.body}`)
    }
    return response.json<{ _id: string }>()
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_messages_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_messages_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })

    await ensureIndexes(handle.db)

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

  it('lists a user own conversations, most recent first', async () => {
    const viewer = await newUser('list-convos-viewer@example.com')
    const older = await newUser('list-convos-older@example.com')
    const newer = await newUser('list-convos-newer@example.com')

    await startConversation(viewer, older.userId, 'older thread')
    await startConversation(viewer, newer.userId, 'newer thread')

    const response = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { cookie: viewer.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    const body = response.json<{ items: { participants: string[] }[] }>()
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.participants).toContain(newer.userId) // most recent activity first
  })

  it('404s the message history of a conversation you are not part of', async () => {
    const a = await newUser('history-a@example.com')
    const b = await newUser('history-b@example.com')
    const outsider = await newUser('history-outsider@example.com')
    const conversation = await startConversation(a, b.userId, 'private stuff')

    const response = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: outsider.cookie },
    })
    expect(response.statusCode).toBe(404)
  })

  it('returns the first message in history, oldest-first within the page', async () => {
    const a = await newUser('history-first-a@example.com')
    const b = await newUser('history-first-b@example.com')
    const conversation = await startConversation(a, b.userId, 'the very first message')

    const response = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: a.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    const body = response.json<{
      items: { body: string; type: string }[]
      nextCursor: string | null
    }>()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({ body: 'the very first message', type: 'text' })
    expect(body.nextCursor).toBeNull()
  })

  it('names both participants even when only one side has written', async () => {
    // The thread header identifies the counterpart from this list. Deriving it
    // from the messages instead leaves a one-sided thread nameless.
    const a = await newUser('participants-a@example.com')
    const b = await newUser('participants-b@example.com')
    const conversation = await startConversation(a, b.userId, 'no reply yet')

    const response = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: a.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    const body = response.json<{ participants: string[] }>()
    expect(body.participants).toEqual(expect.arrayContaining([a.userId, b.userId]))
  })

  it('marking a conversation read zeroes the reader unread count', async () => {
    const a = await newUser('read-a@example.com')
    const b = await newUser('read-b@example.com')
    const conversation = await startConversation(a, b.userId, 'hey b')

    const response = await app.inject({
      method: 'POST',
      url: `/conversations/${conversation._id}/read`,
      headers: { cookie: b.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    const body = response.json<{ unread: Record<string, number> }>()
    expect(body.unread[b.userId]).toBe(0)
  })

  it('refuses history access once the two participants have blocked each other', async () => {
    const a = await newUser('blocked-history-a@example.com')
    const b = await newUser('blocked-history-b@example.com')
    const conversation = await startConversation(a, b.userId, 'before the block')

    await handle.db
      .collection(COLLECTIONS.blocks)
      .insertOne({ blockerId: a.userId, blockedId: b.userId })

    const response = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: b.cookie },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'BLOCKED' })
  })

  describe('the free tier is limited in conversations opened, never in talking', () => {
    it('spends no quota replying, however many messages arrive', async () => {
      // The product's core promise: 5 new conversations a day, unlimited
      // replies. If replying ever charged quota, that promise is broken.
      const me = await newUser('reply-quota-me@example.com')
      const them = await newUser('reply-quota-them@example.com')

      const conversation = await startConversation(them, me.userId, 'they opened it')
      const { sendTextMessage } = await import('../modules/chat/messages')

      for (let i = 0; i < 20; i++) {
        await sendTextMessage(handle.db, them.userId, {
          conversationId: conversation._id,
          body: `inbound ${i}`,
        })
        await sendTextMessage(handle.db, me.userId, {
          conversationId: conversation._id,
          body: `reply ${i}`,
        })
      }

      const quota = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: me.cookie },
      })
      const initiations = quota.json<{ initiations: { limit: number; remaining: number } }>()
        .initiations
      // Untouched: this user never opened a conversation.
      expect(initiations.remaining).toBe(initiations.limit)
    })

    it('lets a free account write far more corrections than any quota would allow', async () => {
      // PLAN_LIMITS.correctionsPer24h is null on both tiers, deliberately:
      // rate-limiting corrections would shrink what a free user gives a Pro one.
      const teacher = await newUser('corrections-teacher@example.com')
      const learner = await newUser('corrections-learner@example.com')
      const conversation = await startConversation(learner, teacher.userId, 'I has a apple')

      const { sendTextMessage, sendCorrection } = await import('../modules/chat/messages')
      const target = await sendTextMessage(handle.db, learner.userId, {
        conversationId: conversation._id,
        body: 'I has a apple',
      })

      expect(PLAN_LIMITS.free.correctionsPer24h).toBeNull()
      for (let i = 0; i < 50; i++) {
        const result = await sendCorrection(handle.db, teacher.userId, {
          conversationId: conversation._id,
          targetMessageId: String(target.message._id),
          corrected: `I have an apple (${i})`,
        })
        expect(result.message.type).toBe('correction')
      }

      const quota = await app.inject({
        method: 'GET',
        url: '/me/quota',
        headers: { cookie: teacher.cookie },
      })
      const initiations = quota.json<{ initiations: { limit: number; remaining: number } }>()
        .initiations
      // Corrections are not a tracked bucket at all, so nothing moved.
      expect(initiations.remaining).toBe(initiations.limit)
    })
  })

  describe('image and voice messages', () => {
    const BUCKET = 'https://cdn.example.com'
    const image = {
      url: `${BUCKET}/messages/x/a.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
    }

    async function pair(prefix: string) {
      const a = await newUser(`${prefix}-a@example.com`)
      const b = await newUser(`${prefix}-b@example.com`)
      const conversation = await startConversation(a, b.userId, 'hi')
      return { a, b, conversationId: conversation._id }
    }

    it('sends an image and shows a label in the chat list instead of an empty line', async () => {
      const { a, conversationId } = await pair('media-image')
      const { sendMediaMessage } = await import('../modules/chat/messages')

      const result = await sendMediaMessage(
        handle.db,
        a.userId,
        { conversationId, kind: 'image', media: image },
        BUCKET,
      )
      expect(result.message.type).toBe('image')
      expect(result.message.media?.url).toBe(image.url)
      // A caption-less attachment would otherwise render as a blank row.
      expect(result.conversation.lastMessage.body).toBe('📷 Photo')
    })

    it('keeps a caption on the message rather than splitting it in two', async () => {
      const { a, conversationId } = await pair('media-caption')
      const { sendMediaMessage } = await import('../modules/chat/messages')
      const result = await sendMediaMessage(
        handle.db,
        a.userId,
        { conversationId, kind: 'image', media: image, body: 'look at this' },
        BUCKET,
      )
      expect(result.message.body).toBe('look at this')
      expect(result.conversation.lastMessage.body).toBe('look at this')
    })

    it('refuses an attachment that points outside our bucket', async () => {
      // Otherwise a message can embed an arbitrary host, and the account purge
      // could never delete it.
      const { a, conversationId } = await pair('media-foreign')
      const { sendMediaMessage } = await import('../modules/chat/messages')
      await expect(
        sendMediaMessage(
          handle.db,
          a.userId,
          {
            conversationId,
            kind: 'image',
            media: { ...image, url: 'https://evil.example.net/x.jpg' },
          },
          BUCKET,
        ),
      ).rejects.toThrow(/own storage bucket/)
    })

    it('refuses a content type that does not match the kind', async () => {
      const { a, conversationId } = await pair('media-mismatch')
      const { sendMediaMessage } = await import('../modules/chat/messages')
      await expect(
        sendMediaMessage(
          handle.db,
          a.userId,
          { conversationId, kind: 'audio', media: { ...image, contentType: 'image/jpeg' } },
          BUCKET,
        ),
      ).rejects.toThrow(/not a supported audio type/)
    })

    it('refuses an oversized attachment', async () => {
      const { a, conversationId } = await pair('media-huge')
      const { sendMediaMessage } = await import('../modules/chat/messages')
      await expect(
        sendMediaMessage(
          handle.db,
          a.userId,
          { conversationId, kind: 'image', media: { ...image, sizeBytes: MAX_IMAGE_BYTES + 1 } },
          BUCKET,
        ),
      ).rejects.toThrow(/too large/)
    })

    it('will not sign an upload URL for a conversation you are not in', async () => {
      // The signed URL is a capability: handing one out would let an outsider
      // write into our bucket for free.
      const { conversationId } = await pair('media-outsider')
      const outsider = await newUser('media-outsider-c@example.com')
      const response = await app.inject({
        method: 'POST',
        url: '/messages/upload-url',
        headers: { cookie: outsider.cookie },
        payload: { conversationId, kind: 'image', contentType: 'image/jpeg' },
      })
      expect(response.statusCode).toBe(404)
    })

    it('charges the media quota, which text and corrections do not', async () => {
      const { a, conversationId } = await pair('media-quota')
      const { sendMediaMessage, sendTextMessage } = await import('../modules/chat/messages')
      const { consumeQuota } = await import('../lib/quota')

      await sendTextMessage(handle.db, a.userId, { conversationId, body: 'free of charge' })
      await sendMediaMessage(
        handle.db,
        a.userId,
        { conversationId, kind: 'image', media: image },
        BUCKET,
      )
      // The send path itself does not spend it — the socket handler does, so
      // spend one here and check the bucket is the media one.
      await consumeQuota(handle.db, a.userId, 'free', 'media')

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: a.userId })
      expect(profile?.quota.media).toHaveLength(1)
      expect(profile?.quota.initiations).toHaveLength(1) // just the conversation they opened
    })
  })
})
