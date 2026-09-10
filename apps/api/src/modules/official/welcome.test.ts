import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app'
import { createAuth } from '../../auth'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { loadEnv } from '../../env'
import { createRevenueCatClientFromEnv } from '../billing/createRevenueCatClient'
import { createStorageProvider } from '../../storage/createStorageProvider'
import { createTranslationProvider } from '../../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../../testSupport/authFlow'
import type { Conversation, Message } from '../chat/conversations'
import { sendTextMessage } from '../chat/messages'
import { fanOutMessage } from '../../ws/fanOut'
import { ensureOfficialAccounts, officialIds } from './accounts'

const PASSWORD = 'correct horse battery staple'
const DB = 'langx_official_welcome_test'

function onboarding(handle: string, native: string) {
  return {
    handle,
    displayName: handle,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: native }],
    learning: [{ code: native === 'en' ? 'tr' : 'en', level: 'intermediate', priority: 1 }],
  }
}

/**
 * Onboarding through the real endpoints, against the real accounts.
 *
 * The unit tests around `deliverOfficialMessage` prove the write; this proves
 * the wiring — that finishing onboarding actually leaves @langx in somebody's
 * chat list, in their own language, and that a message back reaches the
 * assistant path rather than sitting there.
 */
describe('a new account meets @langx', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), DB)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: DB,
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })

    await ensureIndexes(handle.db)
    // What index.ts does one line later.
    await ensureOfficialAccounts(handle.db, 'http://localhost:4000')

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
      // No key, which is what a self-host without one has.
      assistant: null,
    })
    await app.ready()

    // The same first-transaction warm-up the other suites do — see auth.test.ts.
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

  async function onboard(email: string, handleName: string, native: string) {
    const user = await signUpAndSignIn(app, emailSender, {
      email,
      password: PASSWORD,
      name: handleName,
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboarding(handleName, native),
    })
    expect(response.statusCode).toBe(201)
    return user
  }

  /** The welcome is deliberately not awaited by the route. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  async function messagesFrom(senderId: string): Promise<Message[]> {
    return handle.db
      .collection<Message>(COLLECTIONS.messages)
      .find({ senderId })
      .sort({ createdAt: 1 })
      .toArray()
  }

  it('leaves the welcome in the new account’s chat list, in their own language', async () => {
    const user = await onboard('welcome-tr@example.com', 'turkishone', 'tr')
    await settle()

    const langxId = officialIds().get('langx')!
    const said = await messagesFrom(langxId)
    const toThem = said.filter((m) => m.clientId === `welcome:${user.userId}`)
    expect(toThem).toHaveLength(1)
    expect(toThem[0]?.body).toContain('LangX’e hoş geldin')

    // And it is a real conversation, reachable from the chat list.
    const list = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { cookie: user.cookie },
    })
    expect(list.statusCode).toBe(200)
    const items = list.json<{ items: { participants: string[] }[] }>().items
    expect(items).toHaveLength(1)
    expect(items[0]?.participants).toContain(langxId)
  })

  it('writes in English to somebody we ship no catalogue for', async () => {
    const user = await onboard('welcome-ja@example.com', 'japaneseone', 'ja')
    await settle()

    const said = await messagesFrom(officialIds().get('langx')!)
    const toThem = said.find((m) => m.clientId === `welcome:${user.userId}`)
    expect(toThem?.body).toContain('Welcome to LangX')
  })

  it('answers a message to @langx even with no key, and charges nothing for it', async () => {
    const user = await onboard('writes-back@example.com', 'writesback', 'en')
    await settle()

    const langxId = officialIds().get('langx')!
    const conversation = (await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ participants: { $all: [user.userId, langxId] } }))!

    /*
     * The socket's own two lines. Text messages have no REST route — the
     * composer sends over the socket — so this is the real path, driven
     * without a socket: write, then fan out. The trigger lives at the end of
     * `fanOutMessage`, which is the point of putting it there.
     */
    const { message, conversation: updated } = await sendTextMessage(handle.db, user.userId, {
      conversationId: conversation._id.toHexString(),
      body: 'how do tokens work?',
    })
    await fanOutMessage(app, app.io, updated, message, { pushWhenAway: true })
    await settle()

    // Scoped to this thread: the suite's earlier accounts have welcomes of
    // their own, and @langx is the sender of all of them.
    const said = (await messagesFrom(langxId)).filter((m) =>
      m.conversationId.equals(conversation._id),
    )
    // The welcome, then the offline line — which names the support address.
    expect(said).toHaveLength(2)
    expect(said[1]?.body).toContain(app.env.SUPPORT_EMAIL)

    /*
     * Nothing was paid for the exchange, in either direction. Scoped by kind
     * rather than counting rows: onboarding pays a signup bonus, which is the
     * account existing and not the conversation happening.
     */
    expect(
      await handle.db
        .collection(COLLECTIONS.tokenLedger)
        .countDocuments({ kind: { $ne: 'signupBonus' } }),
    ).toBe(0)
    expect(
      await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({ userId: langxId }),
    ).toBe(0)
    const profile = await handle.db
      .collection<{ _id: string; quota: { initiations: Date[] } }>(COLLECTIONS.profiles)
      .findOne({ _id: user.userId })
    expect(profile?.quota.initiations).toEqual([])
  })
})
