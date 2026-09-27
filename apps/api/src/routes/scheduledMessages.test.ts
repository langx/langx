import {
  MAX_SCHEDULE_AHEAD_DAYS,
  MAX_SCHEDULED_PER_CONVERSATION,
  type ScheduledMessageDto,
} from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import type { Message } from '../modules/chat/conversations'
import { SCHEDULED_CLAIM_STALE_MS, type ScheduledMessage } from '../modules/chat/scheduled'
import { runScheduledMessageTick } from '../modules/chat/scheduledSender'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const DB_NAME = 'langx_scheduled_test'
const HOUR = 60 * 60 * 1000

describe('scheduled messages', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let alice: SignedUpUser
  let bob: SignedUpUser
  let conversationId: string
  let clientSeq = 0

  async function newUser(email: string): Promise<SignedUpUser> {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `user${Math.random().toString(36).slice(2, 10)}`,
        displayName: 'Test User',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    if (response.statusCode !== 201) throw new Error(`onboarding failed: ${response.body}`)
    return user
  }

  function schedule(payload: Record<string, unknown>, as: SignedUpUser = alice) {
    clientSeq++
    return app.inject({
      method: 'POST',
      // The route's own limit of twenty a minute is per address, and this
      // suite makes more than twenty creates. A fresh address each keeps the
      // limiter out of assertions that are not about it.
      remoteAddress: `10.0.${Math.floor(clientSeq / 250)}.${clientSeq % 250}`,
      url: `/conversations/${conversationId}/scheduled`,
      headers: { cookie: as.cookie },
      payload: { body: 'Good morning!', clientId: `c${clientSeq}`, ...payload },
    })
  }

  function inHours(hours: number): string {
    return new Date(Date.now() + hours * HOUR).toISOString()
  }

  async function list(as: SignedUpUser = alice): Promise<ScheduledMessageDto[]> {
    const response = await app.inject({
      method: 'GET',
      url: `/conversations/${conversationId}/scheduled`,
      headers: { cookie: as.cookie },
    })
    expect(response.statusCode).toBe(200)
    return response.json<{ items: ScheduledMessageDto[] }>().items
  }

  const rows = () => handle.db.collection<ScheduledMessage>(COLLECTIONS.scheduledMessages)
  const messages = () => handle.db.collection<Message>(COLLECTIONS.messages)

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
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    alice = await newUser('alice-scheduled@example.com')
    bob = await newUser('bob-scheduled@example.com')
    const started = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: alice.cookie },
      payload: { toUserId: bob.userId, body: 'hi' },
    })
    if (started.statusCode !== 201) throw new Error(`conversation failed: ${started.body}`)
    conversationId = started.json<{ _id: string }>()._id
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await rows().deleteMany({})
    await handle.db.collection(COLLECTIONS.blocks).deleteMany({})
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: bob.userId }, { $unset: { timezone: '', 'privacy.hideCity': '' } })
  })

  it('queues a message at the time given, and lists it for its author only', async () => {
    const sendAt = inHours(3)
    const created = await schedule({ sendAt })
    expect(created.statusCode).toBe(201)
    expect(created.json<ScheduledMessageDto>()).toMatchObject({ status: 'pending', sendAt })

    expect(await list()).toHaveLength(1)
    // Bob is in the conversation and still sees nothing of it.
    expect(await list(bob)).toHaveLength(0)
  })

  it('treats a retried create as the same message', async () => {
    const payload = { sendAt: inHours(2), clientId: 'retry-me' }
    const first = await schedule(payload)
    const second = await schedule(payload)
    expect(second.json<ScheduledMessageDto>()._id).toBe(first.json<ScheduledMessageDto>()._id)
    expect(await list()).toHaveLength(1)
  })

  it('refuses a time too soon, too far ahead, or both a time and a mode', async () => {
    expect((await schedule({ sendAt: new Date().toISOString() })).statusCode).toBe(400)
    expect((await schedule({ sendAt: inHours(MAX_SCHEDULE_AHEAD_DAYS * 24 + 1) })).statusCode).toBe(
      400,
    )
    expect((await schedule({ sendAt: inHours(2), mode: 'theirMorning' })).statusCode).toBe(400)
  })

  it(`holds at most ${MAX_SCHEDULED_PER_CONVERSATION} per conversation`, async () => {
    for (let i = 0; i < MAX_SCHEDULED_PER_CONVERSATION; i++) {
      expect((await schedule({ sendAt: inHours(i + 1) })).statusCode).toBe(201)
    }
    const over = await schedule({ sendAt: inHours(10) })
    expect(over.statusCode).toBe(402)
    expect(over.json()).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      max: MAX_SCHEDULED_PER_CONVERSATION,
    })
  })

  it('refuses a conversation the caller is not in', async () => {
    const carol = await newUser('carol-scheduled@example.com')
    expect((await schedule({ sendAt: inHours(2) }, carol)).statusCode).toBe(404)
  })

  describe('in their morning', () => {
    it("resolves to nine o'clock on the partner's clock", async () => {
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: bob.userId }, { $set: { timezone: 'Asia/Tokyo' } })
      const before = new Date()
      const created = await schedule({ mode: 'theirMorning' })
      expect(created.statusCode).toBe(201)
      const sendAt = new Date(created.json<ScheduledMessageDto>().sendAt)
      // The next one, not any one: within a day of now, and never behind it.
      expect(sendAt.getTime()).toBeGreaterThan(before.getTime())
      expect(sendAt.getTime() - before.getTime()).toBeLessThanOrEqual(24 * HOUR)
      expect(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(sendAt),
      ).toBe('09:00')
    })

    it('is refused when their timezone is unknown or hidden', async () => {
      expect((await schedule({ mode: 'theirMorning' })).statusCode).toBe(400)
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: bob.userId },
          { $set: { timezone: 'Asia/Tokyo', 'privacy.hideCity': true } },
        )
      expect((await schedule({ mode: 'theirMorning' })).statusCode).toBe(400)
    })
  })

  describe('cancelling', () => {
    it('removes a pending message', async () => {
      const id = (await schedule({ sendAt: inHours(2) })).json<ScheduledMessageDto>()._id
      const cancelled = await app.inject({
        method: 'DELETE',
        url: `/scheduled/${id}`,
        headers: { cookie: alice.cookie },
      })
      expect(cancelled.statusCode).toBe(204)
      expect(await list()).toHaveLength(0)
    })

    it("is not somebody else's to do", async () => {
      const id = (await schedule({ sendAt: inHours(2) })).json<ScheduledMessageDto>()._id
      const refused = await app.inject({
        method: 'DELETE',
        url: `/scheduled/${id}`,
        headers: { cookie: bob.cookie },
      })
      expect(refused.statusCode).toBe(404)
      expect(await list()).toHaveLength(1)
    })
  })

  describe('the scheduler', () => {
    it('sends a due message once, even when two passes run together', async () => {
      const id = (
        await schedule({ sendAt: inHours(1), body: 'Sent once' })
      ).json<ScheduledMessageDto>()._id
      const later = new Date(Date.now() + 2 * HOUR)

      const results = await Promise.all([
        runScheduledMessageTick(app, later),
        runScheduledMessageTick(app, later),
      ])
      expect(results.reduce((sum, r) => sum + r.sent, 0)).toBe(1)

      const sent = await messages().find({ senderId: alice.userId, body: 'Sent once' }).toArray()
      expect(sent).toHaveLength(1)
      const row = await rows().findOne({ _id: new ObjectId(id) })
      expect(row).toMatchObject({ status: 'sent', messageId: sent[0]?._id })
      // Sent rows leave the author's list; the message is in the thread now.
      expect(await list()).toHaveLength(0)
    })

    it('leaves a message alone until it is due', async () => {
      await schedule({ sendAt: inHours(3) })
      expect((await runScheduledMessageTick(app, new Date())).sent).toBe(0)
      expect(await list()).toMatchObject([{ status: 'pending' }])
    })

    it('fails, visibly, when a block arrived in the meantime', async () => {
      await schedule({ sendAt: inHours(1), body: 'Blocked by then' })
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: bob.userId, blockedId: alice.userId, createdAt: new Date() })

      const result = await runScheduledMessageTick(app, new Date(Date.now() + 2 * HOUR))
      expect(result).toEqual({ sent: 0, failed: 1 })
      expect(await messages().countDocuments({ body: 'Blocked by then' })).toBe(0)
      expect(await list()).toMatchObject([{ status: 'failed', failureReason: 'BLOCKED' }])
    })

    it('fails when the author has been suspended since', async () => {
      await schedule({ sendAt: inHours(1), body: 'Suspended by then' })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: alice.userId },
          { $set: { 'suspension.until': new Date(Date.now() + 48 * HOUR) } },
        )
      try {
        await runScheduledMessageTick(app, new Date(Date.now() + 2 * HOUR))
      } finally {
        await handle.db
          .collection<Profile>(COLLECTIONS.profiles)
          .updateOne({ _id: alice.userId }, { $unset: { suspension: '' } })
      }
      expect(await messages().countDocuments({ body: 'Suspended by then' })).toBe(0)
      expect(await list()).toMatchObject([{ status: 'failed', failureReason: 'ACCOUNT_SUSPENDED' }])
    })

    it('retries a claim that died once, without sending twice', async () => {
      const id = new ObjectId(
        (await schedule({ sendAt: inHours(1), body: 'Died mid-send' })).json<ScheduledMessageDto>()
          ._id,
      )
      const later = new Date(Date.now() + 2 * HOUR)
      // A claim from a process that wrote the message and then went away.
      const messageId = new ObjectId()
      await messages().insertOne({
        _id: messageId,
        conversationId: new ObjectId(conversationId),
        senderId: alice.userId,
        type: 'text',
        body: 'Died mid-send',
        clientId: `scheduled:${id.toHexString()}`,
        createdAt: later,
      })
      await rows().updateOne(
        { _id: id },
        {
          $set: {
            status: 'sending',
            attempts: 1,
            claimedAt: new Date(later.getTime() - SCHEDULED_CLAIM_STALE_MS - 1000),
          },
        },
      )

      await runScheduledMessageTick(app, later)
      expect(await messages().countDocuments({ body: 'Died mid-send' })).toBe(1)
      expect(await rows().findOne({ _id: id })).toMatchObject({ status: 'sent', messageId })
    })

    it('gives up on a claim that died twice', async () => {
      const id = new ObjectId(
        (await schedule({ sendAt: inHours(1) })).json<ScheduledMessageDto>()._id,
      )
      const later = new Date(Date.now() + 2 * HOUR)
      await rows().updateOne(
        { _id: id },
        {
          $set: {
            status: 'sending',
            attempts: 2,
            claimedAt: new Date(later.getTime() - SCHEDULED_CLAIM_STALE_MS - 1000),
          },
        },
      )
      await runScheduledMessageTick(app, later)
      expect(await rows().findOne({ _id: id })).toMatchObject({ status: 'failed' })
    })
  })
})
