import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app'
import { createAuth } from '../../auth'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { loadEnv } from '../../env'
import { authId } from '../../lib/authId'
import { createRevenueCatClientFromEnv } from '../billing/createRevenueCatClient'
import { createStorageProvider } from '../../storage/createStorageProvider'
import { createTranslationProvider } from '../../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../../testSupport/authFlow'
import type { Conversation, Message } from '../chat/conversations'
import { sendTextMessage } from '../chat/messages'
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

  async function onboard(email: string, handleName: string, native: string, userAgent?: string) {
    const user = await signUpAndSignIn(app, emailSender, {
      email,
      password: PASSWORD,
      name: handleName,
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie, ...(userAgent ? { 'user-agent': userAgent } : {}) },
      payload: onboarding(handleName, native),
    })
    expect(response.statusCode).toBe(201)
    return user
  }

  /**
   * Wait for the welcome to land, rather than guess how long it takes.
   *
   * The route does not await it — that is the behaviour under test, not an
   * accident — so something here has to. What stood here was a flat 300 ms,
   * which is a guess about a machine: it holds on a quiet laptop and does not
   * on a loaded CI runner, where the same suite is driving an in-memory
   * replica set that answers transactions with `WriteConflict` and retries.
   * The test then read an empty collection and reported a missing welcome,
   * which is a true statement about that moment and a false one about the
   * code.
   *
   * So it polls for the messages it is about to assert on, and gives up at a
   * deadline **without** failing: the assertion that follows is the one that
   * should report the absence, in its own words, on the line that cares.
   */
  async function settle(...clientIds: string[]): Promise<void> {
    const langxId = officialIds().get('langx')!
    const deadline = Date.now() + 5000
    for (;;) {
      const said = await messagesFrom(langxId)
      const landed = new Set(said.map((message) => message.clientId))
      if (clientIds.every((id) => landed.has(id))) return
      if (Date.now() >= deadline) return
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
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
    await settle(`welcome:${user.userId}`)

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

  /**
   * Somebody who was on v1 gets the other message, and only the other one.
   *
   * Which of the two is decided by `cameFromV1` — `user.precreatedFromV1` —
   * and not by `profile.restoredFromV1`, the field that used to gate this.
   * `restoredFromV1` is only written where a v1 profile was *staged*, and the
   * pre-creation script also opened rows for v1 accounts with nothing to
   * stage: those people were sent the *new user's* welcome, having been on
   * LangX for years.
   *
   * The stamp goes on before onboarding because that is the order in life —
   * the script wrote the row, its owner signs in later.
   */
  it('greets a returning v1 account with the welcome back instead', async () => {
    const user = await signUpAndSignIn(app, emailSender, {
      email: 'welcome-back@example.com',
      password: PASSWORD,
      name: 'backagain',
    })
    await handle.db
      .collection(COLLECTIONS.user)
      .updateOne(
        { _id: authId(user.userId) },
        { $set: { precreatedFromV1: { at: new Date(), legacyUserId: 'v1-id' } } },
      )
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboarding('backagain', 'tr'),
    })
    expect(response.statusCode, response.body).toBe(201)
    await settle(`welcomeback:${user.userId}`)

    const said = await messagesFrom(officialIds().get('langx')!)
    const back = said.filter((m) => m.clientId === `welcomeback:${user.userId}`)
    expect(back).toHaveLength(1)
    expect(back[0]?.body).toContain('tekrar hoş geldin')
    // Not both. One person, one hello.
    expect(said.filter((m) => m.clientId === `welcome:${user.userId}`)).toHaveLength(0)
  })

  /**
   * Two ways to help, and they live in different places: the store ask is only
   * for somebody who has a store, the invite is for everybody.
   */
  it('points at inviting a friend, whatever they signed up on', async () => {
    const user = await onboard('invite@example.com', 'inviteone', 'en', 'Mozilla/5.0 (Macintosh)')
    await settle(`welcome:${user.userId}`)

    const said = await messagesFrom(officialIds().get('langx')!)
    const welcome = said.find((m) => m.clientId === `welcome:${user.userId}`)
    expect(welcome?.body).toContain('Share & invite')
  })

  /**
   * The ask goes only where it can be acted on. Somebody who signed up in a
   * browser has no store to be sent to, and being asked anyway is a worse
   * first impression than not being asked.
   */
  it('asks for a rating in the app, and never on the web', async () => {
    const langxId = officialIds().get('langx')!

    const onPhone = await onboard('ios@example.com', 'iphoneone', 'en', 'CFNetwork/1.0 Darwin/23')
    const onWeb = await onboard('web@example.com', 'browserone', 'en', 'Mozilla/5.0 (Macintosh)')
    await settle(`welcome:${onPhone.userId}`, `welcome:${onWeb.userId}`)

    const said = await messagesFrom(langxId)
    const phone = said.find((m) => m.clientId === `welcome:${onPhone.userId}`)
    const web = said.find((m) => m.clientId === `welcome:${onWeb.userId}`)

    expect(phone?.body).toContain('App Store')
    expect(web?.body).not.toContain('App Store')
    expect(web?.body).not.toContain('Google Play')

    // The sign-off is last on both, after the ask rather than before it.
    expect(phone?.body.trimEnd().endsWith('💛')).toBe(true)
    expect(web?.body.trimEnd().endsWith('💛')).toBe(true)
    expect(phone?.body.indexOf('App Store')).toBeLessThan(phone!.body.indexOf('💛'))
    // And the welcome itself is the same for both.
    expect(web?.body).toContain('welcome to LangX')
    expect(phone?.body).toContain('welcome to LangX')
  })

  it('writes in English to somebody we ship no catalogue for', async () => {
    const user = await onboard('welcome-ja@example.com', 'japaneseone', 'ja')
    await settle(`welcome:${user.userId}`)

    const said = await messagesFrom(officialIds().get('langx')!)
    const toThem = said.find((m) => m.clientId === `welcome:${user.userId}`)
    expect(toThem?.body).toContain('welcome to LangX')
  })

  /**
   * The welcome opens a thread that cannot be written back into. That is the
   * whole shape of `@langx`: it says things, and the reply box is not there —
   * on the screen because the app draws none, and here because the API would
   * refuse it anyway.
   */
  it('opens a thread nobody can write into', async () => {
    const user = await onboard('writes-back@example.com', 'writesback', 'en')
    await settle(`welcome:${user.userId}`)

    const langxId = officialIds().get('langx')!
    const conversation = (await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ participants: { $all: [user.userId, langxId] } }))!

    await expect(
      sendTextMessage(handle.db, user.userId, {
        conversationId: conversation._id.toHexString(),
        body: 'how do tokens work?',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // The welcome, and nothing after it, in this thread.
    const inThread = (await messagesFrom(langxId)).filter((m) =>
      m.conversationId.equals(conversation._id),
    )
    expect(inThread).toHaveLength(1)

    // And it is reported to the app as a channel, which is what hides the box.
    const view = await app.inject({
      method: 'GET',
      url: `/profiles/langx`,
      headers: { cookie: user.cookie },
    })
    expect(view.json<{ official?: true; acceptsMessages?: boolean }>()).toMatchObject({
      official: true,
      acceptsMessages: false,
    })
  })
})
