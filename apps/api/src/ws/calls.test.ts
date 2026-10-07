import {
  CALL_EVENTS,
  CALL_LIMITS,
  CALL_TOKEN_HEADER,
  DEFAULT_APP_CONFIG,
  MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
  type AppConfigResponse,
  type CallEnded,
  type CallIncoming,
  type CallRingData,
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
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { invalidateAppConfigCache, updateAppConfig } from '../modules/appConfig/appConfig'
import { claimEnd, type Call } from '../modules/calls/calls'
import { StaticIceProvider } from '../modules/calls/ice'
import { endCallByParty, endCallsOf, runCallSweepTick, startCall } from '../modules/calls/service'
import type { VoipPush, VoipResult, VoipSender } from '../modules/calls/voipPush'
import type { Conversation, Message } from '../modules/chat/conversations'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import type { LoggingPushSender } from '../modules/push/devices'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

/** A socket that declares it can take a call — what a build with calling sends. */
const CAPABLE = { calls: '1' }

type AckResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string; reason?: string } }

/** Stands in for Apple: says yes to everything and keeps what it was sent. */
class RecordingVoipSender implements VoipSender {
  readonly configured = true
  readonly sent: VoipPush[] = []

  send(push: VoipPush): Promise<VoipResult> {
    this.sent.push(push)
    return Promise.resolve({ ok: true })
  }

  close(): void {}
}

function waitForEvent<T = unknown>(
  socket: ClientSocket,
  event: string,
  matches: (payload: T) => boolean = () => true,
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

/** Resolves true if the event arrives inside the window — for asserting that it does not. */
function heard(socket: ClientSocket, event: string, windowMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, listener)
      resolve(false)
    }, windowMs)
    const listener = (): void => {
      clearTimeout(timer)
      socket.off(event, listener)
      resolve(true)
    }
    socket.on(event, listener)
  })
}

function ask<T = unknown>(
  socket: ClientSocket,
  event: string,
  payload: unknown,
): Promise<AckResult<T>> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: AckResult<T>) => resolve(response))
  })
}

async function ok<T>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  const response = await ask<T>(socket, event, payload)
  if (!response.ok) throw new Error(`${event} refused: ${response.error.code}`)
  return response.data
}

describe('calls over Socket.io', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let voip: RecordingVoipSender
  let baseUrl: string
  let userCount = 0
  const openSockets: ClientSocket[] = []

  const push = (): LoggingPushSender => app.push as LoggingPushSender
  const calls = () => handle.db.collection<Call>(COLLECTIONS.calls)
  const conversations = () => handle.db.collection<Conversation>(COLLECTIONS.conversations)
  const messages = () => handle.db.collection<Message>(COLLECTIONS.messages)

  async function newUser(displayName = 'Test User') {
    userCount++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `call-user-${userCount}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `caller${userCount}x${Math.random().toString(36).slice(2, 6)}`,
        displayName,
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  /**
   * Two people in a thread who may call each other: each has received the
   * five messages the gate asks for. Written straight onto the conversation —
   * one test below earns it the long way, by actually sending them.
   */
  async function pair(names: [string, string] = ['Alice', 'Bob']) {
    const alice = await newUser(names[0])
    const bob = await newUser(names[1])
    const response = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: alice.cookie },
      payload: { toUserId: bob.userId, body: 'hi' },
    })
    if (response.statusCode !== 201) throw new Error(`conversation failed: ${response.body}`)
    const conversationId = response.json<{ _id: string }>()._id
    await conversations().updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: {
          messageCountBy: {
            [alice.userId]: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
            [bob.userId]: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
          },
        },
      },
    )
    return { alice, bob, conversationId }
  }

  function connect(
    user: SignedUpUser,
    deviceId: string,
    extraAuth: Record<string, string> = CAPABLE,
  ): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(baseUrl, {
        transports: ['websocket'],
        auth: { cookie: user.cookie, deviceId, ...extraAuth },
        forceNew: true,
        reconnection: false,
      })
      openSockets.push(socket)
      socket.once('connect', () => resolve(socket))
      socket.once('connect_error', (error: Error) => reject(error))
    })
  }

  /** Alice rings Bob, both on capable sockets. The start most tests begin from. */
  async function ringing(media: 'audio' | 'video' = 'audio') {
    const { alice, bob, conversationId } = await pair()
    const aliceSocket = await connect(alice, 'alice-phone')
    const bobSocket = await connect(bob, 'bob-phone')
    const callId = randomUUID()
    const incoming = waitForEvent<CallIncoming>(bobSocket, CALL_EVENTS.incoming)
    const session = await ok<CallSession>(aliceSocket, CALL_EVENTS.start, {
      callId,
      conversationId,
      media,
    })
    return { alice, bob, conversationId, aliceSocket, bobSocket, callId, session, incoming }
  }

  /** The same, answered and with media flowing. */
  async function talking() {
    const ring = await ringing()
    await ring.incoming
    const accepted = waitForEvent(ring.aliceSocket, CALL_EVENTS.accepted)
    const answer = await ok<CallSession>(ring.bobSocket, CALL_EVENTS.accept, {
      callId: ring.callId,
    })
    await accepted
    await ok(ring.aliceSocket, CALL_EVENTS.connected, { callId: ring.callId })
    return { ...ring, answer }
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_calls_ws_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_calls_ws_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    await ensureIndexes(handle.db)

    emailSender = new CapturingEmailSender()
    voip = new RecordingVoipSender()
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
      // Two processes on one machine need no relay to find each other, and
      // this is exactly what a developer's own instance runs with.
      ice: new StaticIceProvider({ iceServers: [], iceTransportPolicy: 'all' }),
      voip,
    })
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
  }, 180_000)

  afterEach(async () => {
    while (openSockets.length > 0) openSockets.pop()?.disconnect()
    /*
     * A test that leaves a call ringing leaves it for the next one's sweep to
     * find — and several of these drive the sweeper at a time in the future,
     * where every leftover has expired. Each test starts with no calls.
     */
    await calls().deleteMany({})
    push().sent.length = 0
    push().callSignals.length = 0
    voip.sent.length = 0
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  describe('ringing', () => {
    it('rings the open apps that can take a call, with who is calling', async () => {
      const { alice, bob, conversationId } = await pair(['Sofia', 'Bob'])
      const aliceSocket = await connect(alice, 'alice-phone')
      const bobSocket = await connect(bob, 'bob-phone')
      const callId = randomUUID()

      const incoming = waitForEvent<CallIncoming>(bobSocket, CALL_EVENTS.incoming)
      const session = await ok<CallSession>(aliceSocket, CALL_EVENTS.start, {
        callId,
        conversationId,
        media: 'video',
      })

      const rung = await incoming
      expect(rung.caller).toMatchObject({ _id: alice.userId, displayName: 'Sofia' })
      expect(rung.call).toMatchObject({
        callId,
        conversationId,
        media: 'video',
        state: 'ringing',
        callerId: alice.userId,
        calleeId: bob.userId,
      })
      // The deadline is the server's, and so is the clock it is read against.
      const ringMs = Date.parse(rung.call.ringDeadline) - Date.parse(rung.call.serverNow)
      expect(ringMs).toBeGreaterThan((CALL_LIMITS.ringSeconds - 2) * 1000)
      expect(ringMs).toBeLessThanOrEqual(CALL_LIMITS.ringSeconds * 1000)

      expect(session.call.state).toBe('ringing')
      expect(session.ice.iceTransportPolicy).toBe('all')
      expect(session.resumeKey.length).toBeGreaterThan(16)
    })

    it('never rings a build that did not say it can take a call', async () => {
      const { alice, bob, conversationId } = await pair()
      const aliceSocket = await connect(alice, 'alice-phone')
      const capable = await connect(bob, 'bob-new')
      // Every build already on a phone: it connects, and says nothing.
      const old = await connect(bob, 'bob-old', {})

      const reachedOld = heard(old, CALL_EVENTS.incoming)
      const reachedNew = waitForEvent(capable, CALL_EVENTS.incoming)
      await ok(aliceSocket, CALL_EVENTS.start, {
        callId: randomUUID(),
        conversationId,
        media: 'audio',
      })

      await reachedNew
      expect(await reachedOld).toBe(false)
    })

    it('hands a retried start the call it already made instead of a second one', async () => {
      const { aliceSocket, bobSocket, conversationId, callId, session, incoming } = await ringing()
      await incoming

      // The ack was lost; the device asks again with the same id.
      const again = heard(bobSocket, CALL_EVENTS.incoming)
      const retried = await ok<CallSession>(aliceSocket, CALL_EVENTS.start, {
        callId,
        conversationId,
        media: 'audio',
      })

      expect(retried.resumeKey).toBe(session.resumeKey)
      expect(await again).toBe(false)
      expect(await calls().countDocuments({ _id: callId })).toBe(1)
    })

    it('tells the caller when a phone has actually started ringing', async () => {
      const { aliceSocket, bobSocket, callId, incoming } = await ringing()
      await incoming

      const ringingNow = waitForEvent<{ callId: string }>(aliceSocket, CALL_EVENTS.ringing)
      await ok(bobSocket, CALL_EVENTS.ringing, { callId })
      expect((await ringingNow).callId).toBe(callId)
    })
  })

  describe('a call that connects', () => {
    it('carries the signalling both ways and to nobody else', async () => {
      const { alice, bob, aliceSocket, bobSocket, callId, incoming } = await ringing()
      await incoming
      // A second device of each person, open and capable, and not in the call.
      const aliceTablet = await connect(alice, 'alice-tablet')
      const bobTablet = await connect(bob, 'bob-tablet')

      const accepted = waitForEvent<{ callId: string }>(aliceSocket, CALL_EVENTS.accepted)
      const answer = await ok<CallSession>(bobSocket, CALL_EVENTS.accept, { callId })
      await accepted
      expect(answer.call.state).toBe('connecting')
      // Each side has a key of its own.
      expect(answer.resumeKey.length).toBeGreaterThan(16)

      const offer: CallSignal = { callId, description: { type: 'offer', sdp: 'v=0 offer' } }
      const tabletHeard = heard(bobTablet, CALL_EVENTS.signal)
      const ownTabletHeard = heard(aliceTablet, CALL_EVENTS.signal)
      const offered = waitForEvent<CallSignal>(bobSocket, CALL_EVENTS.signal)
      await ok(aliceSocket, CALL_EVENTS.signal, offer)
      expect(await offered).toEqual(offer)

      const candidates: CallSignal = {
        callId,
        candidates: [{ candidate: 'candidate:1 1 udp 1 203.0.113.9 9 typ relay', sdpMid: '0' }],
      }
      const trickled = waitForEvent<CallSignal>(aliceSocket, CALL_EVENTS.signal)
      await ok(bobSocket, CALL_EVENTS.signal, candidates)
      expect(await trickled).toEqual(candidates)

      expect(await tabletHeard).toBe(false)
      expect(await ownTabletHeard).toBe(false)
    })

    it('does not relay what the schema did not allow', async () => {
      const { aliceSocket, bobSocket, callId } = await talking()

      const offered = waitForEvent<Record<string, unknown>>(bobSocket, CALL_EVENTS.signal)
      await ok(aliceSocket, CALL_EVENTS.signal, {
        callId,
        description: { type: 'offer', sdp: 'v=0' },
        smuggled: 'x'.repeat(100),
      })
      expect(await offered).not.toHaveProperty('smuggled')

      const refused = await ask(aliceSocket, CALL_EVENTS.signal, { callId })
      expect(refused).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
    })

    it('refuses to relay for a socket that is not in the call', async () => {
      const { bob, aliceSocket, callId } = await talking()
      // The same account as one of the two — and still not a party to it.
      const bobTablet = await connect(bob, 'bob-tablet')
      const eve = await connect(await newUser('Eve'), 'eve-phone')

      const leaked = heard(aliceSocket, CALL_EVENTS.signal)
      for (const outsider of [bobTablet, eve]) {
        const refused = await ask(outsider, CALL_EVENTS.signal, {
          callId,
          description: { type: 'offer', sdp: 'v=0 not yours' },
        })
        expect(refused).toMatchObject({ ok: false, error: { code: 'CALL_ENDED' } })
        const media = await ask(outsider, CALL_EVENTS.media, { callId, audio: true, video: true })
        expect(media).toMatchObject({ ok: false })
        const connected = await ask(outsider, CALL_EVENTS.connected, { callId })
        expect(connected).toMatchObject({ ok: false })
      }
      expect(await leaked).toBe(false)
    })

    it('passes the camera and microphone state along', async () => {
      const { aliceSocket, bobSocket, callId } = await talking()
      const told = waitForEvent(bobSocket, CALL_EVENTS.media)
      await ok(aliceSocket, CALL_EVENTS.media, { callId, audio: false, video: true })
      expect(await told).toEqual({ callId, audio: false, video: true })
    })

    it('becomes active on the first device to say media is flowing', async () => {
      const { aliceSocket, bobSocket, callId, incoming } = await ringing()
      await incoming
      await ok(bobSocket, CALL_EVENTS.accept, { callId })

      expect((await calls().findOne({ _id: callId }))?.state).toBe('connecting')
      await ok(bobSocket, CALL_EVENTS.connected, { callId })
      const first = await calls().findOne({ _id: callId })
      expect(first?.state).toBe('active')

      // The other device says so too, a moment later. The clock does not move.
      await ok(aliceSocket, CALL_EVENTS.connected, { callId })
      const second = await calls().findOne({ _id: callId })
      expect(second?.connectedAt).toEqual(first?.connectedAt)
    })
  })

  describe('the row a call leaves', () => {
    it('records a call both took, and pays nobody and moves no counter for it', async () => {
      const { alice, bob, aliceSocket, bobSocket, conversationId, callId } = await talking()
      const before = await conversations().findOne({ _id: new ObjectId(conversationId) })
      const ledgerBefore = await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({})
      const streaksBefore = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .find({ _id: { $in: [alice.userId, bob.userId] } }, { projection: { streak: 1 } })
        .toArray()

      const endedForBob = waitForEvent<CallEnded>(bobSocket, CALL_EVENTS.ended)
      const rowForBob = waitForEvent<{ type: string; call?: unknown; senderId: string }>(
        bobSocket,
        'message:new',
        (message) => message.type === 'call',
      )
      const ended = await ok<CallEnded>(aliceSocket, CALL_EVENTS.end, { callId })

      expect(ended).toMatchObject({ callId, reason: 'hangup', outcome: 'completed' })
      expect(ended.durationSeconds).toBeGreaterThanOrEqual(0)
      expect(await endedForBob).toMatchObject({ reason: 'hangup', outcome: 'completed' })
      expect(await rowForBob).toMatchObject({
        type: 'call',
        senderId: alice.userId,
        call: { callId, media: 'audio', outcome: 'completed' },
      })

      const row = await messages().findOne({ 'call.callId': callId })
      expect(row).toMatchObject({ type: 'call', body: '', senderId: alice.userId })

      const after = await conversations().findOne({ _id: new ObjectId(conversationId) })
      // The gate's own counters: a call must not be a way to ring past it.
      expect(after?.messageCount).toBe(before?.messageCount)
      expect(after?.messageCountBy).toEqual(before?.messageCountBy)
      expect(after?.bothSpoke).toBe(before?.bothSpoke)
      // A call both of them were on is nobody's unread.
      expect(after?.unread).toEqual(before?.unread)
      expect(after?.lastMessage).toMatchObject({
        body: '📞 Voice call',
        senderId: alice.userId,
        call: { media: 'audio', outcome: 'completed' },
      })

      expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({})).toBe(
        ledgerBefore,
      )
      const streaksAfter = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .find({ _id: { $in: [alice.userId, bob.userId] } }, { projection: { streak: 1 } })
        .toArray()
      expect(streaksAfter).toEqual(streaksBefore)

      // And the line is free again.
      expect(await calls().countDocuments({ live: true, parties: alice.userId })).toBe(0)
    })

    it('counts a call nobody answered as unread, and tells the phone that was not open', async () => {
      const { alice, bob, conversationId } = await pair(['Sofia', 'Bob'])
      const aliceSocket = await connect(alice, 'alice-phone')
      const bobSocket = await connect(bob, 'bob-web')
      // Bob's phone: registered for push, and not holding a socket.
      await app.inject({
        method: 'POST',
        url: '/me/devices',
        headers: { cookie: bob.cookie },
        payload: {
          pushToken: 'ExponentPushToken[bob-phone]',
          platform: 'ios',
          deviceId: 'bob-phone',
        },
      })
      const callId = randomUUID()
      const incoming = waitForEvent(bobSocket, CALL_EVENTS.incoming)
      await ok(aliceSocket, CALL_EVENTS.start, { callId, conversationId, media: 'video' })
      await incoming
      const unreadBefore =
        (await conversations().findOne({ _id: new ObjectId(conversationId) }))?.unread[
          bob.userId
        ] ?? 0

      const endedForAlice = waitForEvent<CallEnded>(aliceSocket, CALL_EVENTS.ended)
      const endedForBob = waitForEvent<CallEnded>(bobSocket, CALL_EVENTS.ended)
      const swept = await runCallSweepTick(
        app,
        new Date(Date.now() + (CALL_LIMITS.ringSeconds + 1) * 1000),
      )

      expect(swept.ended).toBe(1)
      expect(await endedForAlice).toMatchObject({ callId, reason: 'timeout', outcome: 'missed' })
      expect(await endedForBob).toMatchObject({ callId, reason: 'timeout', outcome: 'missed' })

      const after = await conversations().findOne({ _id: new ObjectId(conversationId) })
      expect(after?.unread[bob.userId]).toBe(unreadBefore + 1)
      expect(after?.unread[alice.userId] ?? 0).toBe(0)
      expect(after?.lastMessage.call).toMatchObject({ media: 'video', outcome: 'missed' })

      // Worded from the one side this push goes to.
      const missed = push().sent.find((message) => message.data.kind === 'message')
      expect(missed).toMatchObject({
        to: ['ExponentPushToken[bob-phone]'],
        title: 'Sofia',
        body: '📹 Missed video call',
        data: { kind: 'message', conversationId, senderId: alice.userId },
      })
    })

    it('leaves a declined call out of the unread count and sends no push for it', async () => {
      const { bob, bobSocket, aliceSocket, conversationId, callId, incoming } = await ringing()
      await incoming
      await app.inject({
        method: 'POST',
        url: '/me/devices',
        headers: { cookie: bob.cookie },
        payload: { pushToken: 'ExponentPushToken[bob-2]', platform: 'ios', deviceId: 'bob-2' },
      })
      const before = await conversations().findOne({ _id: new ObjectId(conversationId) })

      const endedForAlice = waitForEvent<CallEnded>(aliceSocket, CALL_EVENTS.ended)
      const row = waitForEvent(
        aliceSocket,
        'message:new',
        (m: { type: string }) => m.type === 'call',
      )
      const ended = await ok<CallEnded>(bobSocket, CALL_EVENTS.end, { callId })
      expect(ended).toMatchObject({ reason: 'declined', outcome: 'declined' })
      expect(await endedForAlice).toMatchObject({ reason: 'declined', outcome: 'declined' })
      await row

      const after = await conversations().findOne({ _id: new ObjectId(conversationId) })
      expect(after?.unread).toEqual(before?.unread)
      expect(push().sent.filter((message) => message.data.kind === 'message')).toEqual([])
    })

    it('calls it missed when the caller gives up first', async () => {
      const { aliceSocket, bobSocket, callId, incoming } = await ringing()
      await incoming
      const endedForBob = waitForEvent<CallEnded>(bobSocket, CALL_EVENTS.ended)
      const ended = await ok<CallEnded>(aliceSocket, CALL_EVENTS.end, { callId })
      expect(ended).toMatchObject({ reason: 'cancelled', outcome: 'missed' })
      expect(await endedForBob).toMatchObject({ reason: 'cancelled', outcome: 'missed' })
    })

    it('answers a second "end" with how the call ended, not with an error', async () => {
      const { aliceSocket, bobSocket, callId } = await talking()
      await ok(aliceSocket, CALL_EVENTS.end, { callId })
      // Both people pressed the red button at once.
      const again = await ok<CallEnded>(bobSocket, CALL_EVENTS.end, { callId })
      expect(again).toMatchObject({ reason: 'hangup', outcome: 'completed' })
      expect(await messages().countDocuments({ 'call.callId': callId })).toBe(1)
    })

    it('says "failed" when it was answered and the devices never reached each other', async () => {
      const { aliceSocket, bobSocket, callId, incoming } = await ringing()
      await incoming
      await ok(bobSocket, CALL_EVENTS.accept, { callId })

      const endedForAlice = waitForEvent<CallEnded>(aliceSocket, CALL_EVENTS.ended)
      await runCallSweepTick(
        app,
        new Date(Date.now() + (CALL_LIMITS.connectTimeoutSeconds + 1) * 1000),
      )
      expect(await endedForAlice).toMatchObject({ reason: 'connectFailed', outcome: 'failed' })
    })

    it('writes the row a dead process never got to, once', async () => {
      const { callId, incoming } = await ringing()
      await incoming
      // The transition landed and the process died before the thread heard.
      const now = new Date()
      await claimEnd(handle.db, callId, 'ringing', 'cancelled', now)
      expect(await messages().countDocuments({ 'call.callId': callId })).toBe(0)

      const later = new Date(now.getTime() + 31_000)
      expect((await runCallSweepTick(app, later)).logged).toBe(1)
      // Both machines sweep. The second finds nothing left to write.
      expect((await runCallSweepTick(app, later)).logged).toBe(0)
      expect(await messages().countDocuments({ 'call.callId': callId })).toBe(1)
      expect((await calls().findOne({ _id: callId }))?.logPending).toBeUndefined()
    })

    it('cannot be replied to, reacted to, starred, pinned, corrected or withdrawn', async () => {
      const { alice, bob, aliceSocket, bobSocket, conversationId, callId } = await talking()
      await ok(aliceSocket, CALL_EVENTS.end, { callId })
      const row = await messages().findOne({ 'call.callId': callId })
      const messageId = row?._id.toHexString()
      const ledgerBefore = await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({})

      const refusals = await Promise.all([
        ask(bobSocket, 'message:send', {
          conversationId,
          body: 'what?',
          replyToMessageId: messageId,
        }),
        ask(bobSocket, 'message:react', { conversationId, messageId, emoji: '👍' }),
        ask(bobSocket, 'message:star', { conversationId, messageId, starred: true }),
        ask(bobSocket, 'conversation:pin', { conversationId, messageId }),
        // The one that would have paid: the row is "theirs" to whoever was called.
        ask(bobSocket, 'message:correct', {
          conversationId,
          targetMessageId: messageId,
          corrected: 'x',
        }),
        ask(aliceSocket, 'message:delete', { conversationId, messageId, scope: 'everyone' }),
      ])
      for (const refusal of refusals) {
        expect(refusal).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
      }
      expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({})).toBe(
        ledgerBefore,
      )

      // Tidying your own copy is still yours to do.
      const hidden = await ask(bobSocket, 'message:delete', {
        conversationId,
        messageId,
        scope: 'me',
      })
      expect(hidden.ok).toBe(true)
      expect([alice.userId, bob.userId]).toContain(row?.senderId)
    })
  })

  describe('one live call per person', () => {
    it('says busy without saying why, and leaves the thread a missed call', async () => {
      const { bob, callId: firstCall } = await talking()
      // Carol has a thread with Bob too, and calls while he is talking.
      const carol = await newUser('Carol')
      const opened = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { cookie: carol.cookie },
        payload: { toUserId: bob.userId, body: 'hi bob' },
      })
      const conversationId = opened.json<{ _id: string }>()._id
      await conversations().updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { messageCountBy: { [carol.userId]: 5, [bob.userId]: 5 } } },
      )
      const carolSocket = await connect(carol, 'carol-phone')

      const callId = randomUUID()
      const refused = await ask(carolSocket, CALL_EVENTS.start, {
        callId,
        conversationId,
        media: 'audio',
      })
      expect(refused).toMatchObject({ ok: false, error: { code: 'CALL_BUSY' } })
      if (!refused.ok) expect(refused.error.message).not.toMatch(/call with|talking to/i)

      const row = await messages().findOne({ 'call.callId': callId })
      expect(row?.call).toMatchObject({ outcome: 'busy' })
      const thread = await conversations().findOne({ _id: new ObjectId(conversationId) })
      expect(thread?.unread[bob.userId]).toBeGreaterThan(0)
      // And the call he was in is untouched.
      expect((await calls().findOne({ _id: firstCall }))?.state).toBe('active')
    })

    it('refuses a second call from somebody already in one', async () => {
      const { alice, callId: firstCall } = await talking()
      const dave = await newUser('Dave')
      const opened = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { cookie: alice.cookie },
        payload: { toUserId: dave.userId, body: 'hi dave' },
      })
      const conversationId = opened.json<{ _id: string }>()._id
      await conversations().updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { messageCountBy: { [alice.userId]: 5, [dave.userId]: 5 } } },
      )
      await connect(dave, 'dave-phone')
      // Alice's other phone, while her first is in a call.
      const aliceTablet = await connect(alice, 'alice-tablet')

      const refused = await ask(aliceTablet, CALL_EVENTS.start, {
        callId: randomUUID(),
        conversationId,
        media: 'audio',
      })
      expect(refused).toMatchObject({ ok: false, error: { code: 'CALL_IN_PROGRESS' } })
      expect((await calls().findOne({ _id: firstCall }))?.live).toBe(true)
    })

    it('tells two people who called each other at once to take the first call', async () => {
      const { bobSocket, conversationId, incoming } = await ringing()
      await incoming
      // Bob taps "call" on the same thread while Alice's ring is on its way.
      const refused = await ask(bobSocket, CALL_EVENTS.start, {
        callId: randomUUID(),
        conversationId,
        media: 'audio',
      })
      expect(refused).toMatchObject({ ok: false, error: { code: 'CALL_GLARE' } })
    })

    it('lets exactly one of two simultaneous calls to the same person ring', async () => {
      const bob = await newUser('Bob')
      await connect(bob, 'bob-phone')
      // One at a time: sign-up reads its link out of a shared outbox.
      const callers = []
      for (const name of ['Ann', 'Ben']) {
        const caller = await newUser(name)
        const opened = await app.inject({
          method: 'POST',
          url: '/conversations',
          headers: { cookie: caller.cookie },
          payload: { toUserId: bob.userId, body: 'hi' },
        })
        const conversationId = opened.json<{ _id: string }>()._id
        await conversations().updateOne(
          { _id: new ObjectId(conversationId) },
          { $set: { messageCountBy: { [caller.userId]: 5, [bob.userId]: 5 } } },
        )
        callers.push({ caller, conversationId })
      }

      const results = await Promise.allSettled(
        callers.map(({ caller, conversationId }) =>
          startCall(app, caller.userId, { callId: randomUUID(), conversationId, media: 'audio' }),
        ),
      )
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      const refusal = results.find((result) => result.status === 'rejected')
      expect((refusal as PromiseRejectedResult).reason).toMatchObject({ code: 'CALL_BUSY' })
      expect(await calls().countDocuments({ live: true, parties: bob.userId })).toBe(1)
    })

    it('does not let a call whose deadline has passed keep anybody busy', async () => {
      const { alice, bob, conversationId, callId, incoming } = await ringing()
      await incoming
      // Nobody swept yet: the first call is past its ring and still marked live.
      const later = new Date(Date.now() + (CALL_LIMITS.ringSeconds + 5) * 1000)
      const second = randomUUID()
      const session = await startCall(
        app,
        bob.userId,
        { callId: second, conversationId, media: 'audio' },
        {},
        later,
      )
      expect(session.call.callId).toBe(second)
      expect(await calls().findOne({ _id: callId })).toMatchObject({
        state: 'ended',
        endCause: 'timeout',
      })
      expect(await calls().countDocuments({ live: true, parties: alice.userId })).toBe(1)
    })
  })

  describe('several devices', () => {
    it('stops the other phones ringing when one answers, and only that one is in the call', async () => {
      const { bob, aliceSocket, bobSocket, callId, incoming } = await ringing()
      const bobTablet = await connect(bob, 'bob-tablet')
      await incoming

      const stopped = waitForEvent<CallEnded>(bobTablet, CALL_EVENTS.ended)
      // The device that answered is told nothing of the sort.
      const answererStopped = heard(bobSocket, CALL_EVENTS.ended)
      const callerStopped = heard(aliceSocket, CALL_EVENTS.ended)
      await ok(bobSocket, CALL_EVENTS.accept, { callId })

      expect(await stopped).toEqual({ callId, reason: 'answeredElsewhere' })
      expect(await answererStopped).toBe(false)
      expect(await callerStopped).toBe(false)

      // Too late to answer it there as well.
      const second = await ask(bobTablet, CALL_EVENTS.accept, { callId })
      expect(second).toMatchObject({
        ok: false,
        error: { code: 'CALL_ENDED', reason: 'answeredElsewhere' },
      })
      // And a late "decline" from it must not hang up a call it is not in.
      const lateDecline = await ask(bobTablet, CALL_EVENTS.end, { callId })
      expect(lateDecline).toMatchObject({ ok: false, error: { code: 'CALL_ENDED' } })
      expect((await calls().findOne({ _id: callId }))?.live).toBe(true)
    })

    it('lets the device that was in the call come back to it, and no other', async () => {
      const { bob, aliceSocket, bobSocket, callId, answer } = await talking()

      // Bob's network changes: the socket is gone, the call is not.
      bobSocket.disconnect()
      const reconnected = await connect(bob, 'bob-phone')

      const wrong = await ask(reconnected, CALL_EVENTS.resume, {
        callId,
        resumeKey: 'x'.repeat(32),
      })
      expect(wrong).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      // Not in the room yet, so nothing it sends is relayed.
      expect((await ask(reconnected, CALL_EVENTS.signal, { callId, restart: true })).ok).toBe(false)

      const resumed = await ok<{ call: { state: string } }>(reconnected, CALL_EVENTS.resume, {
        callId,
        resumeKey: answer.resumeKey,
      })
      expect(resumed.call.state).toBe('active')

      const restart = waitForEvent<CallSignal>(aliceSocket, CALL_EVENTS.signal)
      await ok(reconnected, CALL_EVENTS.signal, { callId, restart: true })
      expect(await restart).toEqual({ callId, restart: true })
    })

    it('does not treat a dropped socket as a hang-up', async () => {
      const { bobSocket, aliceSocket, callId } = await talking()
      const ended = heard(aliceSocket, CALL_EVENTS.ended)
      bobSocket.disconnect()
      expect(await ended).toBe(false)
      expect((await calls().findOne({ _id: callId }))?.live).toBe(true)
    })
  })

  describe('time', () => {
    it('keeps a call alive on its heartbeats and ends it when they stop', async () => {
      const { aliceSocket, bobSocket, callId } = await talking()
      const connectedAt = (await calls().findOne({ _id: callId }))?.connectedAt as Date

      await ok(bobSocket, CALL_EVENTS.heartbeat, { callId })
      const leased = (await calls().findOne({ _id: callId }))?.deadline as Date
      expect(leased.getTime()).toBeGreaterThan(Date.now() + (CALL_LIMITS.leaseSeconds - 5) * 1000)

      // Inside the lease: nothing to sweep.
      const soon = new Date(Date.now() + (CALL_LIMITS.leaseSeconds - 10) * 1000)
      expect((await runCallSweepTick(app, soon)).ended).toBe(0)

      // Both devices are gone and nobody said so.
      const endedForAlice = waitForEvent<CallEnded>(aliceSocket, CALL_EVENTS.ended)
      const late = new Date(leased.getTime() + 1000)
      expect((await runCallSweepTick(app, late)).ended).toBe(1)
      const ended = await endedForAlice
      expect(ended).toMatchObject({ reason: 'connectionLost', outcome: 'completed' })
      // Measured on the server's clock, to when it was ended.
      expect(ended.durationSeconds).toBe(
        Math.round((late.getTime() - connectedAt.getTime()) / 1000),
      )
    })

    it('never leases a call past the longest one allowed', async () => {
      const { bobSocket, callId } = await talking()
      const call = (await calls().findOne({ _id: callId })) as Call
      const connectedAt = call.connectedAt as Date
      const limit = connectedAt.getTime() + CALL_LIMITS.maxDurationMinutes * 60 * 1000

      // As if it had been running for just under two hours.
      await calls().updateOne(
        { _id: callId },
        {
          $set: {
            connectedAt: new Date(connectedAt.getTime() - (limit - connectedAt.getTime()) + 20_000),
          },
        },
      )
      await ok(bobSocket, CALL_EVENTS.heartbeat, { callId })
      const capped = (await calls().findOne({ _id: callId })) as Call
      const stop =
        (capped.connectedAt as Date).getTime() + CALL_LIMITS.maxDurationMinutes * 60 * 1000
      expect(capped.deadline.getTime()).toBe(stop)

      const ended = waitForEvent<CallEnded>(bobSocket, CALL_EVENTS.ended)
      await runCallSweepTick(app, new Date(stop + 1000))
      expect(await ended).toMatchObject({ reason: 'maxDuration', outcome: 'completed' })
    })
  })

  describe('who may call whom', () => {
    it('unlocks on five messages from the other person, and not one sooner', async () => {
      const alice = await newUser('Alice')
      const bob = await newUser('Bob')
      const opened = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { cookie: alice.cookie },
        payload: { toUserId: bob.userId, body: 'hi' },
      })
      const conversationId = opened.json<{ _id: string }>()._id
      const aliceSocket = await connect(alice, 'alice-phone')
      const bobSocket = await connect(bob, 'bob-phone')

      // Alice writing more does not open her own gate.
      for (let i = 0; i < 6; i++) {
        await ok(aliceSocket, 'message:send', { conversationId, body: `are you there ${i}` })
      }
      for (let i = 0; i < MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES - 1; i++) {
        await ok(bobSocket, 'message:send', { conversationId, body: `reply ${i}` })
      }
      const locked = await ask(aliceSocket, CALL_EVENTS.start, {
        callId: randomUUID(),
        conversationId,
        media: 'audio',
      })
      expect(locked).toMatchObject({ ok: false, error: { code: 'CALLS_LOCKED', max: 5 } })

      await ok(bobSocket, 'message:send', { conversationId, body: 'the fifth' })
      const incoming = waitForEvent(bobSocket, CALL_EVENTS.incoming)
      await ok(aliceSocket, CALL_EVENTS.start, {
        callId: randomUUID(),
        conversationId,
        media: 'audio',
      })
      await incoming
    })

    it('does not count a call as a message received', async () => {
      // A thread from before the per-sender map, so the gate counts rows.
      const { alice, bob, conversationId } = await pair()
      await conversations().updateOne(
        { _id: new ObjectId(conversationId) },
        { $unset: { messageCountBy: '', messageCount: '' } },
      )
      // Five rows Bob "sent" Alice — every one of them a call he placed.
      await messages().insertMany(
        Array.from({ length: 5 }, () => ({
          _id: new ObjectId(),
          conversationId: new ObjectId(conversationId),
          senderId: bob.userId,
          type: 'call' as const,
          body: '',
          call: { callId: randomUUID(), media: 'audio' as const, outcome: 'missed' as const },
          createdAt: new Date(),
        })),
      )
      await expect(
        startCall(app, alice.userId, { callId: randomUUID(), conversationId, media: 'audio' }),
      ).rejects.toMatchObject({ code: 'CALLS_LOCKED' })
    })

    it('respects the switch, in both directions', async () => {
      const { alice, bob, conversationId } = await pair()
      await connect(bob, 'bob-phone')
      const start = () =>
        startCall(app, alice.userId, { callId: randomUUID(), conversationId, media: 'audio' })

      const off = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: bob.cookie },
        payload: { privacy: { refuseCalls: true } },
      })
      expect(off.statusCode).toBe(200)
      await expect(start()).rejects.toMatchObject({ code: 'CALLS_REFUSED', reason: 'them' })

      // And somebody who takes no calls places none.
      await expect(
        startCall(app, bob.userId, { callId: randomUUID(), conversationId, media: 'audio' }),
      ).rejects.toMatchObject({ code: 'CALLS_REFUSED', reason: 'you' })

      const profile = await app.inject({
        method: 'GET',
        url: `/profiles/${bob.userId}`,
        headers: { cookie: alice.cookie },
      })
      expect(profile.json<{ acceptsCalls?: boolean }>().acceptsCalls).toBe(false)

      await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: bob.cookie },
        payload: { privacy: { refuseCalls: false } },
      })
      await expect(start()).resolves.toMatchObject({ call: { state: 'ringing' } })
    })

    it('refuses a call across a block, to a suspended account, and to nobody in the thread', async () => {
      const { alice, bob, conversationId } = await pair()
      await connect(bob, 'bob-phone')
      const start = (callerId: string) =>
        startCall(app, callerId, { callId: randomUUID(), conversationId, media: 'audio' })

      const eve = await newUser('Eve')
      await expect(start(eve.userId)).rejects.toMatchObject({ code: 'NOT_FOUND' })

      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: bob.userId },
        {
          $set: {
            suspension: {
              at: new Date(),
              until: new Date(Date.now() + 86_400_000),
              permanent: false,
              reason: 'spam',
            },
          },
        },
      )
      await expect(start(alice.userId)).rejects.toMatchObject({ code: 'RECIPIENT_SUSPENDED' })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: bob.userId }, { $unset: { suspension: '' } })

      await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: bob.cookie },
        payload: { userId: alice.userId },
      })
      await expect(start(alice.userId)).rejects.toMatchObject({ code: 'BLOCKED' })
    })

    it('makes somebody who is not answered wait for the other person, not for the clock', async () => {
      const { alice, bob, conversationId } = await pair()
      const bobSocket = await connect(bob, 'bob-phone')
      await connect(alice, 'alice-phone')
      const ringAndGiveUp = async () => {
        const callId = randomUUID()
        await startCall(app, alice.userId, { callId, conversationId, media: 'audio' })
        await endCallByParty(app, alice.userId, { callId }, { inRoom: false })
      }
      for (let i = 0; i < CALL_LIMITS.unansweredPerPerson24h; i++) await ringAndGiveUp()

      const refusal = await startCall(app, alice.userId, {
        callId: randomUUID(),
        conversationId,
        media: 'audio',
      }).catch((error: unknown) => error)
      expect(refusal).toMatchObject({ code: 'CALL_COOLDOWN' })
      // A date about a day out — when the oldest of the three stops counting.
      const retryAt = Date.parse((refusal as { retryAt: string }).retryAt)
      expect(retryAt).toBeGreaterThan(Date.now() + 23 * 3_600_000)
      expect(retryAt).toBeLessThanOrEqual(Date.now() + 24 * 3_600_000)

      // The other direction is untouched: Bob may call her back.
      const back = randomUUID()
      await startCall(app, bob.userId, { callId: back, conversationId, media: 'audio' })
      await endCallByParty(app, bob.userId, { callId: back }, { inRoom: false })
      // …and having called back, he has turned to face her again.
      await expect(ringAndGiveUp()).resolves.toBeUndefined()

      // Two more into silence, and the limit is back.
      await ringAndGiveUp()
      await ringAndGiveUp()
      await expect(ringAndGiveUp()).rejects.toMatchObject({ code: 'CALL_COOLDOWN' })

      // A message from him lifts it as well.
      await ok(bobSocket, 'message:send', { conversationId, body: 'sorry, was out' })
      await expect(ringAndGiveUp()).resolves.toBeUndefined()
    })

    it('caps how many calls one account can start in an hour', async () => {
      const { alice, bob, conversationId } = await pair()
      await connect(bob, 'bob-phone')
      const now = new Date()
      await calls().insertMany(
        Array.from({ length: CALL_LIMITS.startsPerHour }, (_, index) => ({
          _id: randomUUID(),
          conversationId: new ObjectId(),
          callerId: alice.userId,
          calleeId: `somebody-${index}`,
          parties: [alice.userId, `somebody-${index}`] as [string, string],
          media: 'audio' as const,
          state: 'ended' as const,
          ringDeadline: now,
          deadline: now,
          createdAt: new Date(now.getTime() - 60_000),
          endedAt: now,
          endedFrom: 'active' as const,
          endCause: 'hangup' as const,
          caller: { resumeKey: 'k'.repeat(32) },
        })),
      )
      await expect(
        startCall(app, alice.userId, { callId: randomUUID(), conversationId, media: 'audio' }),
      ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    })
  })

  describe('nobody to ring', () => {
    it('tells the caller at once, and leaves the thread a missed call', async () => {
      const { alice, bob, conversationId } = await pair()
      const aliceSocket = await connect(alice, 'alice-phone')
      // Bob is signed in on a build with no calling, and has no phone to ring.
      const old = await connect(bob, 'bob-old', {})
      const callId = randomUUID()

      const row = waitForEvent<{ type: string }>(old, 'message:new', (m) => m.type === 'call')
      const refused = await ask(aliceSocket, CALL_EVENTS.start, {
        callId,
        conversationId,
        media: 'audio',
      })
      expect(refused).toMatchObject({ ok: false, error: { code: 'CALL_UNREACHABLE' } })

      // The old build still gets the row — it draws its "update the app" card.
      await row
      expect((await messages().findOne({ 'call.callId': callId }))?.call?.outcome).toBe('missed')
      expect(await calls().countDocuments({ live: true, parties: bob.userId })).toBe(0)
    })
  })

  describe('phones that are not open', () => {
    async function withPhone(platform: 'ios' | 'android', endpoint: Record<string, unknown> = {}) {
      const { alice, bob, conversationId } = await pair(['Sofia', 'Bob'])
      const registered = await app.inject({
        method: 'PUT',
        url: '/me/call-endpoint',
        headers: { cookie: bob.cookie },
        payload: { deviceId: 'bob-phone', platform, protocol: 1, ...endpoint },
      })
      expect(registered.statusCode).toBe(204)
      await app.inject({
        method: 'POST',
        url: '/me/devices',
        headers: { cookie: bob.cookie },
        payload: {
          pushToken: `ExponentPushToken[bob-${platform}]`,
          platform,
          deviceId: 'bob-phone',
          locale: 'tr',
        },
      })
      return { alice, bob, conversationId }
    }

    it('rings an Android phone with a data push and stops it with another', async () => {
      const { alice, bob, conversationId } = await withPhone('android')
      const callId = randomUUID()
      // Nothing of Bob's is open, and the call is placed all the same.
      await startCall(app, alice.userId, { callId, conversationId, media: 'video' })
      await expect.poll(() => push().callSignals.length).toBe(1)

      const ring = push().callSignals[0]
      expect(ring?.to).toEqual(['ExponentPushToken[bob-android]'])
      expect(ring?.ttlSeconds).toBeLessThanOrEqual(CALL_LIMITS.ringSeconds)
      const data = ring?.data as CallRingData
      expect(data).toMatchObject({
        kind: 'callRing',
        callId,
        conversationId,
        media: 'video',
        callerId: alice.userId,
        callerName: 'Sofia',
      })
      // No VoIP push and no drawn notification: this phone rings natively.
      expect(voip.sent).toEqual([])
      expect(push().sent).toEqual([])

      // "Decline" on the lock screen, with no session anywhere in reach.
      const forged = await app.inject({
        method: 'POST',
        url: `/calls/${callId}/decline`,
        headers: { [CALL_TOKEN_HEADER]: `${Math.floor(Date.now() / 1000) + 60}.AAAA` },
        payload: {},
      })
      expect(forged.statusCode).toBe(404)

      // No ticket at all reads the same as a wrong one.
      const bare = await app.inject({ method: 'POST', url: `/calls/${callId}/decline` })
      expect(bare.statusCode).toBe(404)
      // And a ticket is not a session: the signed-in route does not take one.
      const wrongDoor = await app.inject({
        method: 'POST',
        url: `/calls/${callId}/end`,
        headers: { [CALL_TOKEN_HEADER]: data.callToken },
        payload: {},
      })
      expect(wrongDoor.statusCode).toBe(401)

      const declined = await app.inject({
        method: 'POST',
        url: `/calls/${callId}/decline`,
        headers: { [CALL_TOKEN_HEADER]: data.callToken },
        payload: {},
      })
      expect(declined.statusCode).toBe(200)
      expect(declined.json<CallEnded>()).toMatchObject({ reason: 'declined', outcome: 'declined' })

      await expect.poll(() => push().callSignals.length).toBe(2)
      expect(push().callSignals[1]?.data).toEqual({
        kind: 'callCancel',
        callId,
        reason: 'declined',
      })
      expect((await calls().findOne({ _id: callId }))?.calleeId).toBe(bob.userId)
    })

    it('does not let the ticket in a ring hang up a call that was answered', async () => {
      const { alice, bob, conversationId } = await withPhone('android')
      const bobWeb = await connect(bob, 'bob-web')
      const callId = randomUUID()
      await startCall(app, alice.userId, { callId, conversationId, media: 'audio' })
      await expect.poll(() => push().callSignals.length).toBe(1)
      const { callToken } = push().callSignals[0]?.data as CallRingData

      await ok(bobWeb, CALL_EVENTS.accept, { callId })
      // The phone in his pocket is told to stop — and it is the only one told.
      await expect.poll(() => push().callSignals.length).toBe(2)
      expect(push().callSignals[1]?.data).toMatchObject({
        kind: 'callCancel',
        reason: 'answeredElsewhere',
      })

      const late = await app.inject({
        method: 'POST',
        url: `/calls/${callId}/decline`,
        headers: { [CALL_TOKEN_HEADER]: callToken },
        payload: {},
      })
      expect(late.statusCode).toBe(409)
      expect((await calls().findOne({ _id: callId }))?.live).toBe(true)
    })

    it('rings an iPhone straight through Apple, with everything its call screen needs', async () => {
      const token = 'ab'.repeat(32)
      const { alice, conversationId } = await withPhone('ios', {
        voipToken: token,
        apnsEnvironment: 'sandbox',
      })
      const callId = randomUUID()
      await startCall(app, alice.userId, { callId, conversationId, media: 'audio' })
      await expect.poll(() => voip.sent.length).toBe(1)

      const sent = voip.sent[0]
      expect(sent).toMatchObject({ token, environment: 'sandbox' })
      expect(sent?.payload).toMatchObject({
        aps: {},
        langx: { kind: 'callRing', callId, callerName: 'Sofia', media: 'audio' },
      })
      // It expires when the ring does, so a late delivery rings nobody.
      const call = (await calls().findOne({ _id: callId })) as Call
      expect(sent?.expiresAt).toEqual(call.ringDeadline)
      // Not also as a notification: one phone, one ring.
      expect(push().sent).toEqual([])
      expect(push().callSignals).toEqual([])
    })

    it('falls back to an ordinary notification, in the phone’s language, where the call screen is not allowed', async () => {
      const { alice, conversationId } = await withPhone('ios', {
        voipToken: 'cd'.repeat(32),
        callKit: false,
      })
      await startCall(app, alice.userId, { callId: randomUUID(), conversationId, media: 'video' })
      await expect.poll(() => push().sent.length).toBe(1)

      expect(voip.sent).toEqual([])
      expect(push().sent[0]).toMatchObject({
        to: ['ExponentPushToken[bob-ios]'],
        title: 'Sofia',
        body: 'Gelen görüntülü arama',
        data: { kind: 'call', conversationId, senderId: alice.userId },
        priority: 'high',
      })
      expect(push().sent[0]?.ttlSeconds).toBeLessThanOrEqual(CALL_LIMITS.ringSeconds)
    })

    it('moves a phone’s token to whoever is signed in on it now', async () => {
      const token = 'ef'.repeat(32)
      const first = await newUser('First')
      const second = await newUser('Second')
      const register = (user: SignedUpUser, payload: Record<string, unknown>) =>
        app.inject({
          method: 'PUT',
          url: '/me/call-endpoint',
          headers: { cookie: user.cookie },
          payload: { deviceId: 'shared-phone', platform: 'ios', protocol: 1, ...payload },
        })
      const endpoints = () => handle.db.collection(COLLECTIONS.callEndpoints)

      await register(first, { voipToken: token })
      await register(second, { voipToken: token })
      // One phone, one owner: the first account's calls must not ring it now.
      expect(await endpoints().countDocuments({ 'voip.token': token })).toBe(1)
      expect(await endpoints().findOne({ 'voip.token': token })).toMatchObject({
        userId: second.userId,
      })

      // PushKit took the token back: registering without one forgets it.
      await register(second, {})
      expect(await endpoints().findOne({ userId: second.userId })).not.toHaveProperty('voip')

      // Not a token: refused before it is stored anywhere.
      const junk = await register(second, { voipToken: 'ExponentPushToken[nope]' })
      expect(junk.statusCode).toBe(400)
    })

    it('forgets a phone when its owner signs out of it', async () => {
      const { alice, bob, conversationId } = await withPhone('android')
      await app.inject({
        method: 'DELETE',
        url: '/me/devices?deviceId=bob-phone',
        headers: { cookie: bob.cookie },
      })
      await expect(
        startCall(app, alice.userId, { callId: randomUUID(), conversationId, media: 'audio' }),
      ).rejects.toMatchObject({ code: 'CALL_UNREACHABLE' })
      expect(push().callSignals).toEqual([])
    })
  })

  describe('a call cut short by moderation', () => {
    it('ends when one of them blocks the other, and makes no sound about it', async () => {
      const { alice, bob, aliceSocket, bobSocket, callId } = await talking()
      const endedForAlice = waitForEvent<CallEnded>(aliceSocket, CALL_EVENTS.ended)
      const endedForBob = waitForEvent<CallEnded>(bobSocket, CALL_EVENTS.ended)
      const announced = heard(aliceSocket, 'message:new')

      const blocked = await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: bob.cookie },
        payload: { userId: alice.userId },
      })
      expect(blocked.statusCode).toBe(201)

      // Neither is told which of the things it could have been.
      expect(await endedForAlice).toMatchObject({ callId, reason: 'ended' })
      expect(await endedForBob).toMatchObject({ callId, reason: 'ended' })
      // The row is history; nobody is knocked for it.
      expect(await messages().countDocuments({ 'call.callId': callId })).toBe(1)
      expect(await announced).toBe(false)
      expect(push().sent).toEqual([])
    })

    it('ends when an account is suspended or deleted mid-call', async () => {
      const first = await talking()
      const ended = waitForEvent<CallEnded>(first.aliceSocket, CALL_EVENTS.ended)
      expect(await endCallsOf(app, first.bob.userId, 'suspended')).toBe(1)
      expect(await ended).toMatchObject({ reason: 'ended' })

      const second = await talking()
      const endedAgain = waitForEvent<CallEnded>(second.bobSocket, CALL_EVENTS.ended)
      const deleted = await app.inject({
        method: 'POST',
        url: '/me/delete',
        headers: { cookie: second.alice.cookie },
        payload: { confirm: 'DELETE' },
      })
      expect(deleted.statusCode).toBe(200)
      expect(await endedAgain).toMatchObject({ callId: second.callId, reason: 'ended' })
    })
  })

  describe('REST', () => {
    it('answers "is anybody calling me?" for an app that just woke up', async () => {
      const { alice, bob, callId, incoming } = await ringing()
      await incoming

      const forBob = await app.inject({
        method: 'GET',
        url: '/calls/current',
        headers: { cookie: bob.cookie },
      })
      expect(forBob.json()).toMatchObject({
        current: {
          role: 'callee',
          call: { callId, state: 'ringing' },
          peer: { _id: alice.userId },
        },
      })
      const forAlice = await app.inject({
        method: 'GET',
        url: '/calls/current',
        headers: { cookie: alice.cookie },
      })
      expect(forAlice.json()).toMatchObject({ current: { role: 'caller' } })

      const eve = await newUser('Eve')
      const forEve = await app.inject({
        method: 'GET',
        url: '/calls/current',
        headers: { cookie: eve.cookie },
      })
      expect(forEve.json()).toEqual({ current: null })
      // Nor can she ask about a call by its id.
      const peek = await app.inject({
        method: 'GET',
        url: `/calls/${callId}`,
        headers: { cookie: eve.cookie },
      })
      expect(peek.statusCode).toBe(404)
      expect((await app.inject({ method: 'GET', url: '/calls/current' })).statusCode).toBe(401)
    })

    it('lets the device in a call hang up over REST with its key, and nothing else of that account', async () => {
      const { alice, callId, session } = await talking()
      const without = await app.inject({
        method: 'POST',
        url: `/calls/${callId}/end`,
        headers: { cookie: alice.cookie },
        payload: {},
      })
      expect(without.statusCode).toBe(409)

      const withKey = await app.inject({
        method: 'POST',
        url: `/calls/${callId}/end`,
        headers: { cookie: alice.cookie },
        payload: { resumeKey: session.resumeKey, reason: 'connectionLost' },
      })
      expect(withKey.statusCode).toBe(200)
      expect(withKey.json<CallEnded>()).toMatchObject({
        reason: 'connectionLost',
        outcome: 'completed',
      })
    })

    it('reports whether calls can be placed, and obeys the operator’s switch', async () => {
      const config = async () =>
        (await app.inject({ method: 'GET', url: '/app-config' })).json<AppConfigResponse>()
      expect((await config()).callService).toBe(true)

      const { alice, bob, conversationId } = await pair()
      await connect(bob, 'bob-phone')
      await updateAppConfig(handle.db, {
        flags: { ...DEFAULT_APP_CONFIG.flags, callsEnabled: false },
      })
      try {
        expect((await config()).callService).toBe(false)
        await expect(
          startCall(app, alice.userId, { callId: randomUUID(), conversationId, media: 'audio' }),
        ).rejects.toMatchObject({ code: 'CALLS_UNAVAILABLE' })
      } finally {
        await handle.db.collection(COLLECTIONS.appConfig).deleteMany({})
        invalidateAppConfigCache()
      }
    })

    it('reads a config written before the switch existed as "on"', async () => {
      await handle.db.collection(COLLECTIONS.appConfig).insertOne({
        _id: 'current' as unknown as ObjectId,
        maintenance: { enabled: false, message: '', until: null },
        minVersion: { ios: '0.0.0', android: '0.0.0', web: '0.0.0' },
        // Three flags: the document every deployment has today.
        flags: { translationEnabled: true, discoveryEnabled: true, signupsEnabled: true },
        updatedAt: new Date(),
      })
      invalidateAppConfigCache()
      try {
        const response = await app.inject({ method: 'GET', url: '/app-config' })
        const body = response.json<AppConfigResponse>()
        expect(body.flags.callsEnabled).toBe(true)
        expect(body.callService).toBe(true)
      } finally {
        await handle.db.collection(COLLECTIONS.appConfig).deleteMany({})
        invalidateAppConfigCache()
      }
    })
  })
})
