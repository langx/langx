import {
  CALL_EVENTS,
  MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
  type CallEnded,
  type CallIncoming,
  type CallSession,
  type CallSignal,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { type AddressInfo } from 'node:net'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { COLLECTIONS } from '../db/collections'
import { loadEnv } from '../env'
import { StaticIceProvider } from '../modules/calls/ice'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

/**
 * Production is not one process. `fly.toml` holds `min_machines_running = 2`,
 * and a blue-green deploy briefly makes it four — so the two people in a
 * conversation routinely hold sockets on *different* machines, and which one
 * each gets is the proxy's choice, not anything either client controls.
 *
 * This file boots two API instances over one database, which is exactly that
 * shape, and puts one participant on each. Everything realtime has to still
 * work. The single-instance suite next door cannot see any of this: with one
 * process every room lookup happens to be local.
 */
describe('realtime across two API instances', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let instanceA: FastifyInstance
  let instanceB: FastifyInstance
  let urlA: string
  let urlB: string
  let emailSender: CapturingEmailSender
  const openSockets: ClientSocket[] = []

  function onboardingBody() {
    return {
      handle: `user${Math.random().toString(36).slice(2, 10)}`,
      displayName: 'Test User',
      birthDate: '1995-06-15',
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    }
  }

  async function newUser(email: string) {
    const user = await signUpAndSignIn(instanceA, emailSender, {
      email,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await instanceA.inject({
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

  async function startConversation(from: SignedUpUser, toUserId: string, body = 'hi') {
    const response = await instanceA.inject({
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

  function connectSocket(
    baseUrl: string,
    cookie: string,
    deviceId: string,
    extraAuth: Record<string, string> = {},
  ): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(baseUrl, {
        transports: ['websocket'],
        auth: { cookie, deviceId, ...extraAuth },
        forceNew: true,
        reconnection: false,
      })
      openSockets.push(socket)
      socket.once('connect', () => resolve(socket))
      socket.once('connect_error', (error: Error) => reject(error))
    })
  }

  /**
   * Waits for the *matching* event, not the first one. A socket that joins a
   * room while the other instance's change stream is a few frames behind is
   * handed what was broadcast to that room just before it arrived — under a
   * loaded test run, the conversation's opening message. That is the bus
   * working, not a fault, and it is what `appendIncomingMessage`'s id check is
   * for on the client; here it only means the first event is not necessarily
   * the one being waited on.
   */
  function waitForEvent<T = unknown>(
    socket: ClientSocket,
    event: string,
    matches: (payload: T) => boolean,
    timeoutMs = 4000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, listener)
        reject(new Error(`timed out waiting for "${event}"`))
      }, timeoutMs)
      const listener = (payload: T): void => {
        if (!matches(payload)) return
        clearTimeout(timer)
        socket.off(event, listener)
        resolve(payload)
      }
      socket.on(event, listener)
    })
  }

  async function startInstance(): Promise<{ app: FastifyInstance; url: string }> {
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_cross_instance_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    const app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
      email: emailSender,
      // Only the call test below needs it; no relay, as on a developer's machine.
      ice: new StaticIceProvider({ iceServers: [], iceTransportPolicy: 'all' }),
    })
    await app.listen({ port: 0, host: '127.0.0.1' })
    const address = app.server.address() as AddressInfo
    return { app, url: `http://127.0.0.1:${address.port}` }
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_cross_instance_test')
    await ensureIndexes(handle.db)
    emailSender = new CapturingEmailSender()

    const a = await startInstance()
    instanceA = a.app
    urlA = a.url
    const b = await startInstance()
    instanceB = b.app
    urlB = b.url

    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await instanceA.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    emailSender.messages.length = 0
  }, 180_000)

  afterEach(() => {
    while (openSockets.length > 0) openSockets.pop()?.disconnect()
  })

  afterAll(async () => {
    await instanceA?.close()
    await instanceB?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('delivers a message to a participant holding a socket on the other instance', async () => {
    const alice = await newUser('cross-alice@example.com')
    const bob = await newUser('cross-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hi bob')

    const aliceSocket = await connectSocket(urlA, alice.cookie, 'device-alice')
    const bobSocket = await connectSocket(urlB, bob.cookie, 'device-bob')

    const received = waitForEvent<{ body: string; senderId: string }>(
      bobSocket,
      'message:new',
      (message) => message.body === 'are you there?',
    )
    aliceSocket.emit('message:send', { conversationId: conversation._id, body: 'are you there?' })

    await expect(received).resolves.toMatchObject({
      body: 'are you there?',
      senderId: alice.userId,
    })
  })

  it("advances the sender's ticks when the recipient is live on the other instance", async () => {
    const alice = await newUser('cross-tick-alice@example.com')
    const bob = await newUser('cross-tick-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hi bob')

    const aliceSocket = await connectSocket(urlA, alice.cookie, 'device-alice')
    await connectSocket(urlB, bob.cookie, 'device-bob')

    const delivered = waitForEvent<{ deliveredTo: string }>(
      aliceSocket,
      'conversation:delivered',
      (event) => event.deliveredTo === bob.userId,
    )
    aliceSocket.emit('message:send', { conversationId: conversation._id, body: 'tick please' })

    await expect(delivered).resolves.toMatchObject({ deliveredTo: bob.userId })
  })

  it('carries typing across instances', async () => {
    const alice = await newUser('cross-typing-alice@example.com')
    const bob = await newUser('cross-typing-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hi bob')

    const aliceSocket = await connectSocket(urlA, alice.cookie, 'device-alice')
    const bobSocket = await connectSocket(urlB, bob.cookie, 'device-bob')

    const typing = waitForEvent<{ userId: string; isTyping: boolean }>(
      bobSocket,
      'typing',
      (event) => event.userId === alice.userId,
    )
    aliceSocket.emit('typing', { conversationId: conversation._id, isTyping: true })

    await expect(typing).resolves.toMatchObject({ userId: alice.userId, isTyping: true })
  })

  it('carries a read receipt across instances', async () => {
    const alice = await newUser('cross-read-alice@example.com')
    const bob = await newUser('cross-read-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hi bob')

    const aliceSocket = await connectSocket(urlA, alice.cookie, 'device-alice')
    const bobSocket = await connectSocket(urlB, bob.cookie, 'device-bob')

    const read = waitForEvent<{ readBy: string }>(
      aliceSocket,
      'conversation:read',
      (event) => event.readBy === bob.userId,
    )
    bobSocket.emit('conversation:read', { conversationId: conversation._id })

    await expect(read).resolves.toMatchObject({ readBy: bob.userId })
  })

  /**
   * A call is the one feature here whose *whole* exchange crosses machines:
   * the ring, the answer, every frame of signalling, the hang-up. Each device
   * is in the call's room on its own machine, so a relay is an emit to a room
   * that has exactly one member anywhere this process can see — and it only
   * arrives because the adapter carries it to the other.
   *
   * The last third is the case a deploy makes ordinary: a socket drops and its
   * owner reconnects to *the other* machine, which has never heard of the
   * call. The document has, and the key the device was handed is what lets it
   * back in.
   */
  it('carries a whole call between two machines, and lets a device rejoin on the other one', async () => {
    const alice = await newUser('cross-call-alice@example.com')
    const bob = await newUser('cross-call-bob@example.com')
    const conversation = await startConversation(alice, bob.userId, 'hi bob')
    await handle.db.collection(COLLECTIONS.conversations).updateOne(
      { _id: new ObjectId(conversation._id) },
      {
        $set: {
          messageCountBy: {
            [alice.userId]: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
            [bob.userId]: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
          },
        },
      },
    )

    const capable = { calls: '1' }
    const aliceSocket = await connectSocket(urlA, alice.cookie, 'device-alice', capable)
    const bobSocket = await connectSocket(urlB, bob.cookie, 'device-bob', capable)
    const ask = <T>(socket: ClientSocket, event: string, payload: unknown): Promise<T> =>
      new Promise((resolve, reject) => {
        socket.emit(
          event,
          payload,
          (response: { ok: true; data: T } | { ok: false; error: { code: string } }) => {
            if (response.ok) resolve(response.data)
            else reject(new Error(`${event} refused: ${response.error.code}`))
          },
        )
      })
    const callId = randomUUID()
    const forThisCall = (payload: { callId?: string }): boolean => payload.callId === callId

    // The ring crosses.
    const incoming = waitForEvent<CallIncoming>(
      bobSocket,
      CALL_EVENTS.incoming,
      (event) => event.call.callId === callId,
    )
    await ask<CallSession>(aliceSocket, CALL_EVENTS.start, {
      callId,
      conversationId: conversation._id,
      media: 'audio',
    })
    await expect(incoming).resolves.toMatchObject({ caller: { _id: alice.userId } })

    // The answer crosses back.
    const accepted = waitForEvent<{ callId: string }>(
      aliceSocket,
      CALL_EVENTS.accepted,
      forThisCall,
    )
    const answer = await ask<CallSession>(bobSocket, CALL_EVENTS.accept, { callId })
    await accepted

    // Signalling, both ways.
    const offer: CallSignal = { callId, description: { type: 'offer', sdp: 'v=0 offer' } }
    const offered = waitForEvent<CallSignal>(bobSocket, CALL_EVENTS.signal, forThisCall)
    await ask(aliceSocket, CALL_EVENTS.signal, offer)
    await expect(offered).resolves.toEqual(offer)

    const reply: CallSignal = { callId, description: { type: 'answer', sdp: 'v=0 answer' } }
    const answered = waitForEvent<CallSignal>(aliceSocket, CALL_EVENTS.signal, forThisCall)
    await ask(bobSocket, CALL_EVENTS.signal, reply)
    await expect(answered).resolves.toEqual(reply)
    await ask(bobSocket, CALL_EVENTS.connected, { callId })

    // Bob's machine is replaced under him. He comes back on Alice's.
    bobSocket.disconnect()
    const bobAgain = await connectSocket(urlA, bob.cookie, 'device-bob', capable)
    await ask(bobAgain, CALL_EVENTS.resume, { callId, resumeKey: answer.resumeKey })

    const restart = waitForEvent<CallSignal>(aliceSocket, CALL_EVENTS.signal, forThisCall)
    await ask(bobAgain, CALL_EVENTS.signal, { callId, restart: true })
    await expect(restart).resolves.toEqual({ callId, restart: true })

    // And the hang-up reaches him there.
    const ended = waitForEvent<CallEnded>(bobAgain, CALL_EVENTS.ended, forThisCall)
    await ask(aliceSocket, CALL_EVENTS.end, { callId })
    await expect(ended).resolves.toMatchObject({ reason: 'hangup', outcome: 'completed' })

    // One call, one row — whichever machine wrote it.
    expect(
      await handle.db.collection(COLLECTIONS.messages).countDocuments({ 'call.callId': callId }),
    ).toBe(1)
  })
})
