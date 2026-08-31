import { MAX_IMAGE_BYTES, PLAN_LIMITS } from '@langx/shared'
import { ObjectId } from 'mongodb'
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
    birthDate: '1995-06-15',
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

  /**
   * A send whose ack is lost is indistinguishable from one that never arrived,
   * so the client retries it. Without the index behind this, the message it
   * already delivered would be posted a second time.
   */
  it('does not post a resent message twice', async () => {
    const a = await newUser('idem-a@example.com')
    const b = await newUser('idem-b@example.com')
    const conversationId = (await startConversation(a, b.userId))._id
    const { sendTextMessage } = await import('../modules/chat/messages')

    const first = await sendTextMessage(handle.db, a.userId, {
      conversationId,
      body: 'only once',
      clientId: 'attempt-1',
    })
    const retry = await sendTextMessage(handle.db, a.userId, {
      conversationId,
      body: 'only once',
      clientId: 'attempt-1',
    })

    expect(String(retry.message._id)).toBe(String(first.message._id))
    const count = await handle.db
      .collection(COLLECTIONS.messages)
      .countDocuments({ senderId: a.userId, body: 'only once' })
    expect(count).toBe(1)
  })

  /** A different attempt at the same words is a different message. */
  it('still allows the same text sent deliberately twice', async () => {
    const a = await newUser('idem-twice-a@example.com')
    const b = await newUser('idem-twice-b@example.com')
    const conversationId = (await startConversation(a, b.userId))._id
    const { sendTextMessage } = await import('../modules/chat/messages')

    await sendTextMessage(handle.db, a.userId, {
      conversationId,
      body: 'ha',
      clientId: 'attempt-1',
    })
    await sendTextMessage(handle.db, a.userId, {
      conversationId,
      body: 'ha',
      clientId: 'attempt-2',
    })

    const count = await handle.db
      .collection(COLLECTIONS.messages)
      .countDocuments({ senderId: a.userId, body: 'ha' })
    expect(count).toBe(2)
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

  describe('tabs, pins and the view layer', () => {
    async function list(viewer: SignedUpUser, filter?: string) {
      const response = await app.inject({
        method: 'GET',
        url: `/conversations${filter ? `?filter=${filter}` : ''}`,
        headers: { cookie: viewer.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      return response.json<{
        items: {
          _id: string
          unread: number
          pinned: boolean
          archived: boolean
          unreplied: boolean
        }[]
        pinned: { _id: string }[]
      }>()
    }

    function setFlags(viewer: SignedUpUser, id: string, body: Record<string, boolean>) {
      return app.inject({
        method: 'PATCH',
        url: `/conversations/${id}/flags`,
        headers: { cookie: viewer.cookie },
        payload: body,
      })
    }

    /**
     * The list used to ship raw documents, so `unread` arrived as a map keyed
     * by user id — meaning both sides received **the other person's** count.
     * `toConversationView` exists to stop that, and this is what pins it.
     */
    it('tells a viewer nothing about the other side', async () => {
      const viewer = await newUser('view-layer-viewer@example.com')
      const partner = await newUser('view-layer-partner@example.com')
      const convo = await startConversation(partner, viewer.userId, 'hello')
      await setFlags(partner, convo._id, { archived: true })

      const body = await list(viewer)
      const row = body.items.find((c) => c._id === convo._id)

      expect(typeof row?.unread).toBe('number')
      expect(row?.unread).toBe(1)
      // The partner archived it; the viewer must not be able to tell.
      expect(row?.archived).toBe(false)
      // `participants` legitimately carries both ids — the client resolves the
      // counterpart from it. What must not leak is the other side's *state*.
      expect(Object.keys(row ?? {})).not.toContain('archivedBy')
      expect(Object.keys(row ?? {})).not.toContain('pinnedBy')
    })

    /**
     * "They spoke last", not "I have not read it". Opening a thread clears the
     * unread without answering it, so a list keyed on unread would silently
     * drop everything somebody read and meant to come back to.
     */
    it('keeps a read-but-unanswered thread in the unreplied tab', async () => {
      const viewer = await newUser('unreplied-viewer@example.com')
      const partner = await newUser('unreplied-partner@example.com')
      const convo = await startConversation(partner, viewer.userId, 'your turn')

      await app.inject({
        method: 'POST',
        url: `/conversations/${convo._id}/read`,
        headers: { cookie: viewer.cookie },
      })

      const body = await list(viewer, 'unreplied')
      const row = body.items.find((c) => c._id === convo._id)
      expect(row, 'read does not mean answered').toBeDefined()
      expect(row?.unread).toBe(0)
      expect(row?.unreplied).toBe(true)
    })

    it('drops a thread out of unreplied once it is answered', async () => {
      const viewer = await newUser('answered-viewer@example.com')
      const partner = await newUser('answered-partner@example.com')
      const convo = await startConversation(partner, viewer.userId, 'your turn')

      expect((await list(viewer, 'unreplied')).items).toHaveLength(1)

      // Messages go over the socket, so the module is what the tests call.
      const { sendTextMessage } = await import('../modules/chat/messages')
      await sendTextMessage(handle.db, viewer.userId, {
        conversationId: convo._id,
        body: 'answered',
      })

      expect((await list(viewer, 'unreplied')).items).toHaveLength(0)
    })

    it('hides an archived thread from every tab but the archive', async () => {
      const viewer = await newUser('archive-viewer@example.com')
      const partner = await newUser('archive-partner@example.com')
      const convo = await startConversation(viewer, partner.userId, 'filed away')

      expect((await setFlags(viewer, convo._id, { archived: true })).statusCode).toBe(200)

      expect((await list(viewer)).items.map((c) => c._id)).not.toContain(convo._id)
      expect((await list(viewer, 'archived')).items.map((c) => c._id)).toContain(convo._id)

      // Un-archiving unsets the key, so it reads the same as never archived.
      await setFlags(viewer, convo._id, { archived: false })
      expect((await list(viewer)).items.map((c) => c._id)).toContain(convo._id)
      expect((await list(viewer, 'archived')).items).toHaveLength(0)
    })

    it('returns pins as their own list, out of the paginated one', async () => {
      const viewer = await newUser('pin-viewer@example.com')
      const partner = await newUser('pin-partner@example.com')
      const other = await newUser('pin-other@example.com')
      const pinned = await startConversation(viewer, partner.userId, 'keep this')
      await startConversation(viewer, other.userId, 'ordinary')

      await setFlags(viewer, pinned._id, { pinned: true })

      const body = await list(viewer)
      expect(body.pinned.map((c) => c._id)).toEqual([pinned._id])
      // And not counted twice.
      expect(body.items.map((c) => c._id)).not.toContain(pinned._id)
    })

    /** One side pinning must not pin it for the other. */
    it('pins for one participant only', async () => {
      const viewer = await newUser('pin-solo-viewer@example.com')
      const partner = await newUser('pin-solo-partner@example.com')
      const convo = await startConversation(viewer, partner.userId, 'mine only')

      await setFlags(viewer, convo._id, { pinned: true })

      expect((await list(viewer)).pinned).toHaveLength(1)
      expect((await list(partner)).pinned).toHaveLength(0)
    })

    it('refuses a request that names no flag', async () => {
      const viewer = await newUser('noflag-viewer@example.com')
      const partner = await newUser('noflag-partner@example.com')
      const convo = await startConversation(viewer, partner.userId, 'hi')

      expect((await setFlags(viewer, convo._id, {})).statusCode).toBe(400)
    })

    it('refuses to flag somebody else conversation', async () => {
      const a = await newUser('flag-outsider-a@example.com')
      const b = await newUser('flag-outsider-b@example.com')
      const outsider = await newUser('flag-outsider-c@example.com')
      const convo = await startConversation(a, b.userId, 'private')

      const response = await setFlags(outsider, convo._id, { pinned: true })
      expect(response.statusCode).not.toBe(200)
    })
  })

  /**
   * The client only started reading `nextCursor` here once the chat list
   * became an infinite query. The server side was already right; this pins it
   * before anything depends on it.
   */
  it('pages the conversation list without repeating or skipping a thread', async () => {
    const viewer = await newUser('page-convos-viewer@example.com')
    const partners = []
    for (const name of ['a', 'b', 'c']) {
      const partner = await newUser(`page-convos-${name}@example.com`)
      await startConversation(viewer, partner.userId, `thread ${name}`)
      partners.push(partner.userId)
    }

    const seen: string[] = []
    let cursor: string | null = ''
    do {
      const url: string = `/conversations?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const page = await app.inject({ method: 'GET', url, headers: { cookie: viewer.cookie } })
      expect(page.statusCode, page.body).toBe(200)
      const body = page.json<{ items: { _id: string }[]; nextCursor: string | null }>()
      expect(body.items.length).toBeLessThanOrEqual(1)
      seen.push(...body.items.map((c) => c._id))
      cursor = body.nextCursor
    } while (cursor)

    expect(seen).toHaveLength(3)
    expect(new Set(seen).size).toBe(3)
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

  it('reading over REST marks the thread delivered as well as read', async () => {
    const a = await newUser('read-implies-a@example.com')
    const b = await newUser('read-implies-b@example.com')
    const conversation = await startConversation(a, b.userId, 'opened from a push')

    // No socket anywhere in this test: opening the app straight from a
    // notification is exactly the path where nothing else can have set the
    // second tick, and a message cannot be read without having arrived.
    const read = await app.inject({
      method: 'POST',
      url: `/conversations/${conversation._id}/read`,
      headers: { cookie: b.cookie },
    })
    expect(read.statusCode, read.body).toBe(200)

    const history = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: a.cookie },
    })
    const message = history.json<{ items: { deliveredAt?: string; readAt?: string }[] }>().items[0]
    expect(message?.deliveredAt).toBeDefined()
    expect(message?.readAt).toBeDefined()
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

  describe('replies and the around window', () => {
    async function thread(prefix: string, count: number) {
      const a = await newUser(`${prefix}-a@example.com`)
      const b = await newUser(`${prefix}-b@example.com`)
      const { _id: conversationId } = await startConversation(a, b.userId, 'opening')
      const { sendTextMessage } = await import('../modules/chat/messages')
      const ids: string[] = []
      for (let i = 1; i <= count; i++) {
        const sender = i % 2 === 0 ? b : a
        const { message } = await sendTextMessage(handle.db, sender.userId, {
          conversationId,
          body: `m${i}`,
        })
        ids.push(message._id.toHexString())
      }
      return { a, b, conversationId, ids }
    }

    it('snapshots the quoted message rather than joining to it', async () => {
      const { a, b, conversationId, ids } = await thread('reply-snap', 2)
      const { sendTextMessage } = await import('../modules/chat/messages')

      const { message } = await sendTextMessage(handle.db, b.userId, {
        conversationId,
        body: 'answering that',
        replyToMessageId: ids[0],
      })

      expect(message.replyTo?.messageId.toHexString()).toBe(ids[0])
      expect(message.replyTo?.senderId).toBe(a.userId)
      expect(message.replyTo?.preview).toBe('m1')
    })

    /** The reason it is a snapshot: the quote has to outlive its target. */
    it('keeps the quote readable after the target is blanked', async () => {
      const { b, conversationId, ids } = await thread('reply-outlive', 1)
      const { sendTextMessage } = await import('../modules/chat/messages')
      const { message } = await sendTextMessage(handle.db, b.userId, {
        conversationId,
        body: 'answering',
        replyToMessageId: ids[0],
      })

      const targetId = message.replyTo?.messageId
      if (!targetId) throw new Error('the reply carried no snapshot to begin with')
      await handle.db
        .collection(COLLECTIONS.messages)
        .updateOne({ _id: targetId }, { $set: { body: '' } })

      const stored = await handle.db
        .collection<{ replyTo?: { preview: string } }>(COLLECTIONS.messages)
        .findOne({ _id: message._id })
      expect(stored?.replyTo?.preview).toBe('m1')
    })

    it('refuses a reply target from another conversation', async () => {
      const first = await thread('reply-cross-1', 1)
      const second = await thread('reply-cross-2', 1)
      const { sendTextMessage } = await import('../modules/chat/messages')

      await expect(
        sendTextMessage(handle.db, second.a.userId, {
          conversationId: second.conversationId,
          body: 'wrong thread',
          replyToMessageId: first.ids[0],
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('centres the window on the anchor and offers a cursor both ways', async () => {
      const { a, conversationId, ids } = await thread('around-centre', 40)
      const anchor = ids[20]

      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages?around=${anchor}&limit=10`,
        headers: { cookie: a.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{
        items: { _id: string; body: string }[]
        nextCursor: string | null
        prevCursor: string | null
        anchorId: string
      }>()

      expect(body.anchorId).toBe(anchor)
      expect(body.items.map((m) => m._id)).toContain(anchor)
      // Older on one side, newer on the other, oldest-first on the wire.
      const at = body.items.findIndex((m) => m._id === anchor)
      expect(at).toBeGreaterThan(0)
      expect(at).toBeLessThan(body.items.length - 1)
      expect(body.nextCursor).not.toBeNull()
      expect(body.prevCursor).not.toBeNull()
    })

    it('walks forwards to the tail with after, and says when it gets there', async () => {
      const { a, conversationId, ids } = await thread('around-forward', 12)

      const start = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages?around=${ids[0]}&limit=4`,
        headers: { cookie: a.cookie },
      })
      let body = start.json<{
        items: { body: string }[]
        prevCursor: string | null
      }>()

      const seen = body.items.map((m) => m.body)
      let guard = 0
      while (body.prevCursor && guard++ < 10) {
        const next = await app.inject({
          method: 'GET',
          url: `/conversations/${conversationId}/messages?after=${encodeURIComponent(body.prevCursor)}&limit=4`,
          headers: { cookie: a.cookie },
        })
        expect(next.statusCode, next.body).toBe(200)
        body = next.json<{ items: { body: string }[]; prevCursor: string | null }>()
        seen.push(...body.items.map((m) => m.body))
      }

      // A null prevCursor is the claim that this page reaches the live tail,
      // which is what a client trusts before splicing a new message into it.
      expect(body.prevCursor).toBeNull()
      expect(seen).toContain('m12')
      expect(new Set(seen).size).toBe(seen.length)
    })

    it('reports no newer page on the default page, which is already the tail', async () => {
      const { a, conversationId } = await thread('around-tail', 3)
      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages`,
        headers: { cookie: a.cookie },
      })
      expect(response.json<{ prevCursor: string | null }>().prevCursor).toBeNull()
    })

    it('refuses around together with cursor', async () => {
      const { a, conversationId, ids } = await thread('around-both', 2)
      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages?around=${ids[0]}&cursor=anything`,
        headers: { cookie: a.cookie },
      })
      expect(response.statusCode).toBe(400)
    })

    it('404s an anchor that is not in this conversation', async () => {
      const first = await thread('around-foreign-1', 1)
      const second = await thread('around-foreign-2', 1)
      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${second.conversationId}/messages?around=${first.ids[0]}`,
        headers: { cookie: second.a.cookie },
      })
      expect(response.statusCode).toBe(404)
    })
  })

  describe('reactions and deletion', () => {
    async function pair(prefix: string) {
      const a = await newUser(`${prefix}-a@example.com`)
      const b = await newUser(`${prefix}-b@example.com`)
      const { _id: conversationId } = await startConversation(a, b.userId, 'opening')
      const { sendTextMessage } = await import('../modules/chat/messages')
      const { message } = await sendTextMessage(handle.db, a.userId, {
        conversationId,
        body: 'the message',
      })
      return { a, b, conversationId, messageId: message._id.toHexString(), message }
    }

    it('moves a reaction rather than stacking them, and clears on a repeat', async () => {
      const { b, conversationId, messageId } = await pair('react-toggle')
      const { reactToMessage } = await import('../modules/chat/mutations')

      const first = await reactToMessage(handle.db, b.userId, {
        conversationId,
        messageId,
        emoji: '👍',
      })
      expect(first.message.reactions?.['👍']).toEqual([b.userId])

      const moved = await reactToMessage(handle.db, b.userId, {
        conversationId,
        messageId,
        emoji: '🔥',
      })
      expect(moved.message.reactions?.['👍']).toEqual([])
      expect(moved.message.reactions?.['🔥']).toEqual([b.userId])

      const cleared = await reactToMessage(handle.db, b.userId, {
        conversationId,
        messageId,
        emoji: '🔥',
      })
      expect(cleared.message.reactions?.['🔥']).toEqual([])
    })

    /** One tap must never be a payout, or the emoji strip becomes a farm. */
    it('pays nothing for a reaction', async () => {
      const { b, conversationId, messageId } = await pair('react-free')
      const { reactToMessage } = await import('../modules/chat/mutations')

      const before = await handle.db
        .collection(COLLECTIONS.tokenLedger)
        .countDocuments({ userId: b.userId })
      await reactToMessage(handle.db, b.userId, { conversationId, messageId, emoji: '❤️' })
      const after = await handle.db
        .collection(COLLECTIONS.tokenLedger)
        .countDocuments({ userId: b.userId })

      expect(after).toBe(before)
    })

    it('hides a message for the person who hid it and nobody else', async () => {
      const { a, b, conversationId, messageId } = await pair('delete-mine')
      const { deleteMessage } = await import('../modules/chat/mutations')

      const result = await deleteMessage(handle.db, b.userId, {
        conversationId,
        messageId,
        scope: 'me',
      })
      expect(result.audience).toBe('actor')

      const forThem = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages`,
        headers: { cookie: b.cookie },
      })
      const forSender = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages`,
        headers: { cookie: a.cookie },
      })

      const theirs = forThem.json<{ items: { _id: string; hidden?: boolean }[] }>().items
      const senders = forSender.json<{ items: { _id: string; hidden?: boolean }[] }>().items
      expect(theirs.find((m) => m._id === messageId)?.hidden).toBe(true)
      expect(senders.find((m) => m._id === messageId)?.hidden).toBeUndefined()
    })

    it('refuses to withdraw a message you did not send', async () => {
      const { b, conversationId, messageId } = await pair('delete-not-mine')
      const { deleteMessage } = await import('../modules/chat/mutations')

      await expect(
        deleteMessage(handle.db, b.userId, { conversationId, messageId, scope: 'everyone' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    it('refuses to withdraw a message older than the window', async () => {
      const { a, conversationId, messageId, message } = await pair('delete-stale')
      const { deleteMessage } = await import('../modules/chat/mutations')

      const longAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      await handle.db
        .collection(COLLECTIONS.messages)
        .updateOne({ _id: message._id }, { $set: { createdAt: longAgo } })

      await expect(
        deleteMessage(handle.db, a.userId, { conversationId, messageId, scope: 'everyone' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    it('empties the message, the chat-list preview and the unread count', async () => {
      const { a, b, conversationId, messageId } = await pair('delete-everyone')
      const { deleteMessage } = await import('../modules/chat/mutations')

      const before = await handle.db
        .collection<{ unread: Record<string, number> }>(COLLECTIONS.conversations)
        .findOne({ _id: new ObjectId(conversationId) })
      expect(before?.unread[b.userId]).toBeGreaterThan(0)

      await deleteMessage(handle.db, a.userId, { conversationId, messageId, scope: 'everyone' })

      const after = await handle.db
        .collection<{
          unread: Record<string, number>
          lastMessage: { body: string; deleted?: boolean }
        }>(COLLECTIONS.conversations)
        .findOne({ _id: new ObjectId(conversationId) })
      expect(after?.lastMessage.body).toBe('')
      expect(after?.lastMessage.deleted).toBe(true)
      expect(after?.unread[b.userId]).toBe((before?.unread[b.userId] ?? 1) - 1)

      const page = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages`,
        headers: { cookie: b.cookie },
      })
      const row = page
        .json<{ items: { _id: string; body: string; deleted?: boolean }[] }>()
        .items.find((m) => m._id === messageId)
      // The row stays: it is half of someone else's thread.
      expect(row?.deleted).toBe(true)
      expect(row?.body).toBe('')
    })

    /** Two devices pressing delete at once must not decrement unread twice. */
    it('is idempotent, so a second withdrawal changes nothing', async () => {
      const { a, b, conversationId, messageId } = await pair('delete-twice')
      const { deleteMessage } = await import('../modules/chat/mutations')

      await deleteMessage(handle.db, a.userId, { conversationId, messageId, scope: 'everyone' })
      const once = await handle.db
        .collection<{ unread: Record<string, number> }>(COLLECTIONS.conversations)
        .findOne({ _id: new ObjectId(conversationId) })

      await deleteMessage(handle.db, a.userId, { conversationId, messageId, scope: 'everyone' })
      const twice = await handle.db
        .collection<{ unread: Record<string, number> }>(COLLECTIONS.conversations)
        .findOne({ _id: new ObjectId(conversationId) })

      expect(twice?.unread[b.userId]).toBe(once?.unread[b.userId])
    })

    /**
     * A newer message wins the race by making the `lastMessage` filter stop
     * matching — no transaction, and no read-modify-write to lose.
     */
    it('leaves the chat-list preview alone when a newer message arrived first', async () => {
      const { a, conversationId, messageId } = await pair('delete-raced')
      const { sendTextMessage } = await import('../modules/chat/messages')
      const { deleteMessage } = await import('../modules/chat/mutations')

      await sendTextMessage(handle.db, a.userId, { conversationId, body: 'came after' })
      await deleteMessage(handle.db, a.userId, { conversationId, messageId, scope: 'everyone' })

      const conversation = await handle.db
        .collection<{ lastMessage: { body: string } }>(COLLECTIONS.conversations)
        .findOne({ _id: new ObjectId(conversationId) })
      expect(conversation?.lastMessage.body).toBe('came after')
    })

    it('404s a message id from another conversation', async () => {
      const first = await pair('mutate-foreign-1')
      const second = await pair('mutate-foreign-2')
      const { reactToMessage } = await import('../modules/chat/mutations')

      await expect(
        reactToMessage(handle.db, second.a.userId, {
          conversationId: second.conversationId,
          messageId: first.messageId,
          emoji: '👍',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('editing, starring and pinning', () => {
    async function pair(prefix: string, body = 'the original sentence') {
      const a = await newUser(`${prefix}-a@example.com`)
      const b = await newUser(`${prefix}-b@example.com`)
      const { _id: conversationId } = await startConversation(a, b.userId, 'opening')
      const { sendTextMessage } = await import('../modules/chat/messages')
      const { message } = await sendTextMessage(handle.db, a.userId, { conversationId, body })
      return { a, b, conversationId, message, messageId: message._id.toHexString() }
    }

    it('rewrites the message and the chat-list preview together', async () => {
      const { a, conversationId, messageId } = await pair('edit-basic')
      const { editMessage } = await import('../modules/chat/mutations')

      const { message } = await editMessage(handle.db, a.userId, {
        conversationId,
        messageId,
        body: 'the corrected sentence',
      })
      expect(message.body).toBe('the corrected sentence')
      expect(message.editedAt).toBeInstanceOf(Date)

      const conversation = await handle.db
        .collection<{ lastMessage: { body: string } }>(COLLECTIONS.conversations)
        .findOne({ _id: new ObjectId(conversationId) })
      expect(conversation?.lastMessage.body).toBe('the corrected sentence')
    })

    it('refuses to edit someone else message', async () => {
      const { b, conversationId, messageId } = await pair('edit-not-mine')
      const { editMessage } = await import('../modules/chat/mutations')

      await expect(
        editMessage(handle.db, b.userId, { conversationId, messageId, body: 'not yours' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    it('refuses to edit one past the window', async () => {
      const { a, conversationId, messageId, message } = await pair('edit-stale')
      const { editMessage } = await import('../modules/chat/mutations')

      await handle.db
        .collection(COLLECTIONS.messages)
        .updateOne(
          { _id: message._id },
          { $set: { createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
        )

      await expect(
        editMessage(handle.db, a.userId, { conversationId, messageId, body: 'too late' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    /**
     * The lock that keeps `correction.original` honest. Editing a sentence
     * someone has already corrected would leave their correction quoting
     * something that exists nowhere.
     */
    it('locks a message once the other person has corrected it', async () => {
      const { a, b, conversationId, messageId } = await pair('edit-corrected', 'I has a book')
      const { sendCorrection } = await import('../modules/chat/messages')
      const { editMessage } = await import('../modules/chat/mutations')

      await sendCorrection(handle.db, b.userId, {
        conversationId,
        targetMessageId: messageId,
        corrected: 'I have a book',
      })

      // The stamp is on the target, so the client can grey the row out too.
      const page = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages`,
        headers: { cookie: a.cookie },
      })
      const target = page
        .json<{ items: { _id: string; corrected?: boolean }[] }>()
        .items.find((m) => m._id === messageId)
      expect(target?.corrected).toBe(true)

      await expect(
        editMessage(handle.db, a.userId, { conversationId, messageId, body: 'I have a book' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    it('keeps a star to the person who set it', async () => {
      const { a, b, conversationId, messageId } = await pair('star-private')
      const { starMessage } = await import('../modules/chat/mutations')

      const result = await starMessage(handle.db, b.userId, {
        conversationId,
        messageId,
        starred: true,
      })
      expect(result.audience).toBe('actor')

      const forStarrer = await app.inject({
        method: 'GET',
        url: '/me/starred',
        headers: { cookie: b.cookie },
      })
      const forSender = await app.inject({
        method: 'GET',
        url: '/me/starred',
        headers: { cookie: a.cookie },
      })
      expect(forStarrer.json<{ items: { _id: string }[] }>().items.map((m) => m._id)).toEqual([
        messageId,
      ])
      expect(forSender.json<{ items: unknown[] }>().items).toEqual([])

      // And the flag is per viewer, not a list of who starred it.
      const thread = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages`,
        headers: { cookie: a.cookie },
      })
      const row = thread
        .json<{ items: { _id: string; starred?: boolean }[] }>()
        .items.find((m) => m._id === messageId)
      expect(row?.starred).toBeUndefined()
      expect(thread.body).not.toContain('starredBy')
    })

    it('unstars, and drops it off the list', async () => {
      const { b, conversationId, messageId } = await pair('star-toggle')
      const { starMessage } = await import('../modules/chat/mutations')

      await starMessage(handle.db, b.userId, { conversationId, messageId, starred: true })
      await starMessage(handle.db, b.userId, { conversationId, messageId, starred: false })

      const list = await app.inject({
        method: 'GET',
        url: '/me/starred',
        headers: { cookie: b.cookie },
      })
      expect(list.json<{ items: unknown[] }>().items).toEqual([])
    })

    it('pins one message at a time, and either person can change it', async () => {
      const { a, b, conversationId, messageId } = await pair('pin-one')
      const { sendTextMessage } = await import('../modules/chat/messages')
      const { pinMessage } = await import('../modules/chat/mutations')

      const second = await sendTextMessage(handle.db, b.userId, {
        conversationId,
        body: 'the second one',
      })

      await pinMessage(handle.db, a.userId, { conversationId, messageId })
      // The other person replaces it rather than being locked out of it.
      const replaced = await pinMessage(handle.db, b.userId, {
        conversationId,
        messageId: second.message._id.toHexString(),
      })
      expect(replaced.conversation.pinned?.messageId.toHexString()).toBe(
        second.message._id.toHexString(),
      )
      expect(replaced.conversation.pinned?.byUserId).toBe(b.userId)

      const cleared = await pinMessage(handle.db, a.userId, { conversationId, messageId: null })
      expect(cleared.conversation.pinned).toBeUndefined()
    })

    it('refuses to pin a withdrawn message', async () => {
      const { a, conversationId, messageId } = await pair('pin-deleted')
      const { deleteMessage, pinMessage } = await import('../modules/chat/mutations')

      await deleteMessage(handle.db, a.userId, { conversationId, messageId, scope: 'everyone' })
      await expect(
        pinMessage(handle.db, a.userId, { conversationId, messageId }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })
  })
})
