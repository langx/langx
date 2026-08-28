import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { type AddressInfo } from 'node:net'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
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

/** Waits for a named event once, rejecting if it doesn't arrive in time — used everywhere below instead of a bare `on` + manual timer. */
function waitForEvent<T = unknown>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs)
    socket.once(event, (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

describe('Faz 5 — realtime chat over Socket.io', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let baseUrl: string
  const openSockets: ClientSocket[] = []

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

  function connectSocket(cookie: string | undefined): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(baseUrl, {
        transports: ['websocket'],
        auth: cookie ? { cookie } : {},
        forceNew: true,
        reconnection: false,
      })
      openSockets.push(socket)
      socket.once('connect', () => resolve(socket))
      socket.once('connect_error', (error: Error) => reject(error))
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_chat_ws_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_chat_ws_test',
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

    // A real listening socket, not `app.ready()` — Socket.io needs an actual
    // HTTP upgrade handshake, which `inject()`'s in-memory dispatch can't do.
    await app.listen({ port: 0, host: '127.0.0.1' })
    const address = app.server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`

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

  afterEach(() => {
    while (openSockets.length > 0) openSockets.pop()?.disconnect()
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('rejects a connection with no session cookie at all', async () => {
    await expect(connectSocket(undefined)).rejects.toThrow()
  })

  it('rejects a connection with a garbage cookie', async () => {
    await expect(connectSocket('session_token=not-a-real-session')).rejects.toThrow()
  })

  it('delivers a message to the other participant in under 1 second', async () => {
    const alice = await newUser('ws-alice@example.com')
    const bob = await newUser('ws-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hi bob')

    const aliceSocket = await connectSocket(alice.cookie)
    const bobSocket = await connectSocket(bob.cookie)

    const received = waitForEvent<{ body: string; senderId: string }>(bobSocket, 'message:new')
    const startedAt = Date.now()
    aliceSocket.emit('message:send', { conversationId: conversation._id, body: 'are you there?' })

    const message = await received
    const elapsedMs = Date.now() - startedAt
    expect(elapsedMs).toBeLessThan(1000)
    expect(message).toMatchObject({ body: 'are you there?', senderId: alice.userId })
  })

  it('acks the sender with the persisted message', async () => {
    const alice = await newUser('ws-ack-alice@example.com')
    const bob = await newUser('ws-ack-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hi bob')
    const aliceSocket = await connectSocket(alice.cookie)

    const ack = await new Promise<{ ok: boolean; data?: { body: string } }>((resolve) => {
      aliceSocket.emit(
        'message:send',
        { conversationId: conversation._id, body: 'acked?' },
        (response: { ok: boolean; data?: { body: string } }) => resolve(response),
      )
    })
    expect(ack.ok).toBe(true)
    expect(ack.data?.body).toBe('acked?')
  })

  it('no message loss across a reconnect — history has it even if the recipient was offline', async () => {
    const alice = await newUser('ws-reconnect-alice@example.com')
    const bob = await newUser('ws-reconnect-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'first hello')

    const aliceSocket = await connectSocket(alice.cookie)
    const bobSocket = await connectSocket(bob.cookie)
    bobSocket.disconnect() // Bob goes offline before Alice's next message

    const ack = await new Promise<{ ok: boolean }>((resolve) => {
      aliceSocket.emit(
        'message:send',
        { conversationId: conversation._id, body: 'are you still there?' },
        (response: { ok: boolean }) => resolve(response),
      )
    })
    expect(ack.ok).toBe(true) // sending doesn't require the recipient to be connected

    // Bob reconnects later and catches up over REST, not a replay queue.
    const history = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: bob.cookie },
    })
    const body = history.json<{ items: { body: string }[] }>()
    expect(body.items.map((m) => m.body)).toContain('are you still there?')
  })

  it('a read receipt notifies the other participant in realtime', async () => {
    const alice = await newUser('ws-read-alice@example.com')
    const bob = await newUser('ws-read-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'read me')

    const aliceSocket = await connectSocket(alice.cookie)
    const bobSocket = await connectSocket(bob.cookie)

    const readEvent = waitForEvent<{ conversationId: string; readBy: string }>(
      aliceSocket,
      'conversation:read',
    )
    bobSocket.emit('conversation:read', { conversationId: conversation._id })

    const event = await readEvent
    expect(event).toMatchObject({ conversationId: conversation._id, readBy: bob.userId })
  })

  it('a message to a recipient who is connected comes back delivered', async () => {
    const alice = await newUser('ws-deliv-alice@example.com')
    const bob = await newUser('ws-deliv-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hello')

    // Bob first, so his connect-time sweep of that opening message fires
    // before Alice has a room to receive it in — leaving the send below as
    // the only thing that can produce the event this test waits for.
    const bobSocket = await connectSocket(bob.cookie)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const aliceSocket = await connectSocket(alice.cookie)

    const delivered = waitForEvent<{ conversationId: string; deliveredTo: string }>(
      aliceSocket,
      'conversation:delivered',
    )
    aliceSocket.emit('message:send', { conversationId: conversation._id, body: 'you there?' })

    expect(await delivered).toMatchObject({
      conversationId: conversation._id,
      deliveredTo: bob.userId,
    })
    expect(bobSocket.connected).toBe(true)

    const history = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: alice.cookie },
    })
    const sent = history
      .json<{ items: { body: string; deliveredAt?: string; readAt?: string }[] }>()
      .items.find((m) => m.body === 'you there?')
    expect(sent?.deliveredAt).toBeDefined()
    // Delivered is not read — Bob has a socket, not the thread open.
    expect(sent?.readAt).toBeUndefined()
  })

  it('a message sent to someone offline stays on one tick until they connect', async () => {
    const alice = await newUser('ws-undeliv-alice@example.com')
    const bob = await newUser('ws-undeliv-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'first hello')
    const aliceSocket = await connectSocket(alice.cookie)

    await new Promise<void>((resolve) => {
      aliceSocket.emit(
        'message:send',
        { conversationId: conversation._id, body: 'while away' },
        () => resolve(),
      )
    })

    const readHistory = async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${conversation._id}/messages`,
        headers: { cookie: alice.cookie },
      })
      return response.json<{ items: { body: string; deliveredAt?: string }[] }>().items
    }

    // Nobody was there to hand it to, so nothing may claim it arrived.
    expect((await readHistory()).find((m) => m.body === 'while away')?.deliveredAt).toBeUndefined()

    const delivered = waitForEvent<{ conversationId: string; deliveredTo: string }>(
      aliceSocket,
      'conversation:delivered',
    )
    await connectSocket(bob.cookie)

    expect(await delivered).toMatchObject({
      conversationId: conversation._id,
      deliveredTo: bob.userId,
    })
    // Both of Alice's messages, not just the one sent while Bob was away.
    const after = await readHistory()
    expect(after.every((m) => m.deliveredAt)).toBe(true)
  })

  it('reconnecting does not drag an existing delivery timestamp forward', async () => {
    const alice = await newUser('ws-redeliv-alice@example.com')
    const bob = await newUser('ws-redeliv-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'stamp me once')

    const firstBobSocket = await connectSocket(bob.cookie)
    await new Promise((resolve) => setTimeout(resolve, 300))

    const stampOf = async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${conversation._id}/messages`,
        headers: { cookie: alice.cookie },
      })
      return response.json<{ items: { deliveredAt?: string }[] }>().items[0]?.deliveredAt
    }

    const first = await stampOf()
    expect(first).toBeDefined()

    firstBobSocket.disconnect()
    await connectSocket(bob.cookie)
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Delivery is the moment it arrived, not a flag that gets re-set — a
    // second tick that keeps changing its own timestamp is telling a lie
    // about when the message got there.
    expect(await stampOf()).toBe(first)
  })

  it('typing relays to the other participant only', async () => {
    const alice = await newUser('ws-typing-alice@example.com')
    const bob = await newUser('ws-typing-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'typing test')

    const aliceSocket = await connectSocket(alice.cookie)
    const bobSocket = await connectSocket(bob.cookie)

    const typingEvent = waitForEvent<{ userId: string; isTyping: boolean }>(bobSocket, 'typing')
    aliceSocket.emit('typing', { conversationId: conversation._id, isTyping: true })

    const event = await typingEvent
    expect(event).toMatchObject({ userId: alice.userId, isTyping: true })
  })

  it('a correction references the original message', async () => {
    const alice = await newUser('ws-correct-alice@example.com')
    const bob = await newUser('ws-correct-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'I has a apple')
    const aliceSocket = await connectSocket(alice.cookie)
    const bobSocket = await connectSocket(bob.cookie)

    const history = await app.inject({
      method: 'GET',
      url: `/conversations/${conversation._id}/messages`,
      headers: { cookie: bob.cookie },
    })
    const originalId = history.json<{ items: { _id: string }[] }>().items[0]?._id
    expect(originalId).toBeDefined()

    const correctionEvent = waitForEvent<{
      type: string
      correction: { original: string; corrected: string }
    }>(aliceSocket, 'message:new')

    bobSocket.emit('message:correct', {
      conversationId: conversation._id,
      targetMessageId: originalId,
      corrected: 'I have an apple',
      note: "use 'an' before a vowel sound",
    })

    const correction = await correctionEvent
    expect(correction.type).toBe('correction')
    expect(correction.correction).toMatchObject({
      original: 'I has a apple',
      corrected: 'I have an apple',
    })
  })

  it('rejects sending into a conversation the socket owner is not part of', async () => {
    const alice = await newUser('ws-notpart-alice@example.com')
    const bob = await newUser('ws-notpart-bob@example.com')
    const outsider = await newUser('ws-notpart-outsider@example.com')
    const conversation = await startConversation(alice, bob.userId, 'private')

    const outsiderSocket = await connectSocket(outsider.cookie)
    const ack = await new Promise<{ ok: boolean; error?: { code: string } }>((resolve) => {
      outsiderSocket.emit(
        'message:send',
        { conversationId: conversation._id, body: 'sneaking in' },
        (response: { ok: boolean; error?: { code: string } }) => resolve(response),
      )
    })
    expect(ack.ok).toBe(false)
    expect(ack.error?.code).toBe('NOT_FOUND')
  })

  it('rejects sending once the two participants have blocked each other', async () => {
    const alice = await newUser('ws-blocked-alice@example.com')
    const bob = await newUser('ws-blocked-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'before the block')
    await handle.db
      .collection(COLLECTIONS.blocks)
      .insertOne({ blockerId: bob.userId, blockedId: alice.userId })

    const aliceSocket = await connectSocket(alice.cookie)
    const ack = await new Promise<{ ok: boolean; error?: { code: string } }>((resolve) => {
      aliceSocket.emit(
        'message:send',
        { conversationId: conversation._id, body: 'still there?' },
        (response: { ok: boolean; error?: { code: string } }) => resolve(response),
      )
    })
    expect(ack.ok).toBe(false)
    expect(ack.error?.code).toBe('BLOCKED')
  })
})
