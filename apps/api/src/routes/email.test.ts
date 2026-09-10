import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { authId } from '../lib/authId'
import { loadEnv } from '../env'
import { translator } from '../i18n'
import { signUnsubscribeToken } from '../email/unsubscribeToken'
import { mintDeletionToken, verifyDeletionToken } from '../modules/account/deletionTokens'
import { isEmailSuppressed } from '../modules/notifications/suppressions'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const SECRET = 'b'.repeat(40)

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

describe('unsubscribing from a link in an email', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let userId: string
  let cookie: string
  let profileHandle: string

  async function notificationsOf(id: string): Promise<Record<string, unknown>> {
    const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
    return profile?.settings.notifications as Record<string, unknown>
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_email_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_email_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      EMAIL_UNSUBSCRIBE_SECRET: SECRET,
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

    // Better Auth's first transaction against a cold replica set loses a race
    // with index creation; chat.test.ts warms up the same way.
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
    await app.close()
    await handle.close()
    await replSet.stop()
  })

  beforeEach(async () => {
    const user = await signUpAndSignIn(app, emailSender, {
      email: `unsub-${Math.random().toString(36).slice(2, 10)}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const body = onboardingBody()
    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: body,
    })
    expect(created.statusCode, created.body).toBe(201)
    userId = user.userId
    cookie = user.cookie
    profileHandle = body.handle
    emailSender.messages.length = 0
  })

  /**
   * Scanners, previewers and "protect the click" proxies all fetch a link
   * before a human sees it. A GET that acted would unsubscribe people who
   * never opened the mail.
   */
  it('asks on GET and changes nothing', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'messages')
    const response = await app.inject({ method: 'GET', url: `/email/unsubscribe?token=${token}` })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('<form method="post"')
    expect(await notificationsOf(userId)).toMatchObject({ messages: { push: true, email: true } })
  })

  it('turns one kind off on POST and leaves the phone alone', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'messages')
    const response = await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })

    expect(response.statusCode).toBe(200)
    const notifications = await notificationsOf(userId)
    expect(notifications).toMatchObject({
      messages: { push: true, email: false },
      streak: { push: true, email: true },
    })
  })

  /** RFC 8058: an empty form body, and the token that counts is in the URL. */
  it('honours a one-click POST from a mail client', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'promotions')
    const response = await app.inject({
      method: 'POST',
      url: `/email/unsubscribe?token=${token}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(await notificationsOf(userId)).toMatchObject({
      promotions: { push: false, email: false },
    })
  })

  it('takes the token from a form body when the URL has none', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'streak')
    const response = await app.inject({
      method: 'POST',
      url: '/email/unsubscribe',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `token=${encodeURIComponent(token)}`,
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(await notificationsOf(userId)).toMatchObject({ streak: { push: true, email: false } })
  })

  it('stops every kind when the scope is all', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'all')
    await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })

    const notifications = await notificationsOf(userId)
    for (const kind of ['messages', 'streak', 'profileVisits', 'promotions']) {
      expect((notifications[kind] as { email: boolean }).email, kind).toBe(false)
    }
    // Push is a different question, and nobody asked it.
    expect(notifications.messages).toMatchObject({ push: true })
  })

  /** A mail client may retry; the second press must not be an error page. */
  it('is idempotent', async () => {
    const token = signUnsubscribeToken(SECRET, userId, 'messages')
    await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })
    const second = await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${token}` })
    expect(second.statusCode).toBe(200)
  })

  it('refuses a token it did not sign', async () => {
    const forged = signUnsubscribeToken('a-different-secret-of-adequate-length', userId, 'messages')
    const get = await app.inject({ method: 'GET', url: `/email/unsubscribe?token=${forged}` })
    const post = await app.inject({ method: 'POST', url: `/email/unsubscribe?token=${forged}` })

    expect(get.statusCode).toBe(400)
    expect(post.statusCode).toBe(400)
    expect(await notificationsOf(userId)).toMatchObject({ messages: { email: true } })
  })

  it('refuses a missing token without throwing', async () => {
    expect((await app.inject({ method: 'GET', url: '/email/unsubscribe' })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/email/unsubscribe' })).statusCode).toBe(400)
  })

  /**
   * The link in the one mail to v1 accounts their owners deleted. No account
   * behind it, so the only thing "stop" can mean is forgetting the address.
   */
  it('the v1-contact scope forgets the address, and only on the POST', async () => {
    const contacts = handle.db.collection(COLLECTIONS.v1DeletedContacts)
    await contacts.insertOne({
      _id: 'appwrite-gone' as never,
      email: 'gone@example.com',
      name: 'Gone',
      legacyUserId: 'appwrite-gone',
      recordedAt: new Date(),
    })
    const token = signUnsubscribeToken(SECRET, 'appwrite-gone', 'v1contact')

    const asked = await app.inject({
      method: 'GET',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
    })
    expect(asked.statusCode).toBe(200)
    expect(asked.body).toContain('the one message about the new LangX')
    expect(await contacts.countDocuments({ _id: 'appwrite-gone' as never })).toBe(1)

    const done = await app.inject({
      method: 'POST',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    })
    expect(done.statusCode).toBe(200)
    expect(await contacts.countDocuments({ _id: 'appwrite-gone' as never })).toBe(0)

    // A second press is not an error page.
    const again = await app.inject({
      method: 'POST',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
    })
    expect(again.statusCode).toBe(200)
  })

  /**
   * A pre-created v1 row, mailed from a campaign, pressing the link before ever
   * onboarding. There is no profile to switch anything off on — which used to
   * make this a silent success — and the profile they create later must not
   * be seeded with the consent they just withdrew.
   */
  it('records a refusal from somebody with no profile, and onboarding honours it', async () => {
    const stranger = await signUpAndSignIn(app, emailSender, {
      email: `v1-${Math.random().toString(36).slice(2, 10)}@example.com`,
      password: PASSWORD,
      name: 'Returning',
    })
    await handle.db
      .collection(COLLECTIONS.user)
      .updateOne(
        { _id: authId(stranger.userId) },
        { $set: { precreatedFromV1: { at: new Date(), legacyUserId: 'v1-x' } } },
      )
    const token = signUnsubscribeToken(SECRET, stranger.userId, 'promotions')

    const done = await app.inject({
      method: 'POST',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
    })
    expect(done.statusCode).toBe(200)
    expect(await isEmailSuppressed(handle.db, stranger.email)).toBe(true)

    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: stranger.cookie },
      payload: onboardingBody(),
    })
    expect(created.statusCode, created.body).toBe(201)
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: stranger.userId })
    /*
     * The default opts people in, so this is the case that has to keep
     * working: somebody who pressed unsubscribe before they had a profile is
     * on `emailSuppressions`, and every sender reads it — the cell below says
     * yes and nothing goes to them anyway.
     */
    expect(profile?.promotionsConsent).toBeUndefined()
    expect(await isEmailSuppressed(handle.db, stranger.email)).toBe(true)
  })

  /**
   * The same GET/POST split, on the link that ends an account — where getting
   * it wrong costs rather more than an unwanted unsubscribe.
   */
  describe('the delete-account link', () => {
    async function deletedAt(id: string): Promise<Date | undefined> {
      const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
      return profile?.deletedAt
    }

    it('asks on GET, and a link previewer cannot delete anything', async () => {
      const token = await mintDeletionToken(handle.db, userId)
      const response = await app.inject({
        method: 'GET',
        url: `/account/delete/confirm?token=${token}`,
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toContain('<form method="post"')
      expect(await deletedAt(userId)).toBeUndefined()
      // And the token is still spendable afterwards: asking must not burn it.
      expect(await verifyDeletionToken(handle.db, token)).toBe(userId)
    })

    it('schedules the deletion on POST', async () => {
      const token = await mintDeletionToken(handle.db, userId)
      const response = await app.inject({
        method: 'POST',
        url: `/account/delete/confirm?token=${token}`,
      })

      expect(response.statusCode).toBe(200)
      expect(await deletedAt(userId)).toBeInstanceOf(Date)
    })

    it('refuses the same link twice', async () => {
      const token = await mintDeletionToken(handle.db, userId)
      await app.inject({ method: 'POST', url: `/account/delete/confirm?token=${token}` })

      const again = await app.inject({
        method: 'POST',
        url: `/account/delete/confirm?token=${token}`,
      })
      expect(again.statusCode).toBe(400)
    })

    it('refuses a token nobody minted', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/account/delete/confirm?token=made-up',
      })
      expect(response.statusCode).toBe(400)
      expect(await deletedAt(userId)).toBeUndefined()
    })
  })

  /**
   * The one mail sent while signed in. It follows the order every auth mail
   * does — the languages on the profile, then the language the app is being
   * read in, then English — because here, unlike a notification, there is a
   * request to read the second answer off.
   */
  describe('asking for the delete-account link', () => {
    async function request(acceptLanguage?: string) {
      return app.inject({
        method: 'POST',
        url: '/me/delete/request',
        headers: { cookie, ...(acceptLanguage ? { 'accept-language': acceptLanguage } : {}) },
        payload: { handle: profileHandle },
      })
    }

    async function speaks(codes: string[]): Promise<void> {
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: userId }, { $set: { nativeLanguages: codes.map((code) => ({ code })) } })
    }

    it('writes the mail in a native language before the language the app is in', async () => {
      const response = await request('de')
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toEqual({ sent: true, deliverable: true })
      expect(emailSender.messages.at(-1)?.subject).toBe(translator('tr')('email.deleteSubject'))
    })

    it('falls back to the language the app is in when no native language has a catalogue', async () => {
      await speaks(['ja'])
      const response = await request('de')
      expect(response.statusCode, response.body).toBe(200)
      expect(emailSender.messages.at(-1)?.subject).toBe(translator('de')('email.deleteSubject'))
    })

    it('and to English when neither answers', async () => {
      await speaks(['ja'])
      const response = await request()
      expect(response.statusCode, response.body).toBe(200)
      expect(emailSender.messages.at(-1)?.subject).toBe(translator('en')('email.deleteSubject'))
    })
  })
})
