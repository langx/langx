import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthYear: 1995,
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'B1', priority: 1 }],
    ...overrides,
  }
}

describe('Faz 5 — conversation/message history REST', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, profileOverrides: Record<string, unknown> = {}) {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'Test' })
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
    app = await buildApp({ env, client: handle.client, db: handle.db, auth, storage })
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
    const body = response.json<{ items: { body: string; type: string }[]; nextCursor: string | null }>()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({ body: 'the very first message', type: 'text' })
    expect(body.nextCursor).toBeNull()
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

    await handle.db.collection(COLLECTIONS.blocks).insertOne({ blockerId: a.userId, blockedId: b.userId })

    const response = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: b.cookie },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'BLOCKED' })
  })
})
