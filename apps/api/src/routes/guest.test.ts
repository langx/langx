import { GUEST_TTL_MS } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { authId } from '../lib/authId'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import type { Profile } from '../modules/profiles/profiles'
import { purgeStaleGuests } from '../modules/profiles/purgeGuests'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const MEMBER_PASSWORD = 'correct horse battery staple'

describe('guests', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_guest_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
    await ensureIndexes(handle.db)
    const revenueCat = createRevenueCatClientFromEnv(env)
    emailSender = new CapturingEmailSender()
    app = await buildApp({
      env,
      db: handle.db,
      client: handle.client,
      auth: await createAuth({
        env,
        db: handle.db,
        client: handle.client,
        emailSender,
        revenueCat,
      }),
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat,
    })
    await app.ready()

    /*
     * The same warm-up `follows.test.ts` does, and for the same reason: the
     * first sign-up against an empty database creates `account` from inside
     * Better Auth's transaction, and MongoDB answers that catalog change with
     * a transient write conflict. Retried rather than asserted, because the
     * point is only to get the collection made.
     */
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: {
          email: `warmup-${attempt}@example.com`,
          password: MEMBER_PASSWORD,
          name: 'Warm Up',
        },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    emailSender.messages.length = 0
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.client.close()
    await replSet?.stop()
  })

  /** The plugin's own endpoint; the cookie it returns is an ordinary session. */
  async function signInAsGuest(): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/api/auth/sign-in/anonymous' })
    if (response.statusCode !== 200) {
      throw new Error(`anonymous sign-in failed (${response.statusCode}): ${response.body}`)
    }
    const cookie = response.headers['set-cookie']
    return Array.isArray(cookie) ? cookie.join('; ') : String(cookie)
  }

  /** The guest's own user id, for the rows that outlive the profile. */
  async function guestUserId(cookie: string): Promise<string> {
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie },
    })
    return session.json<{ user: { id: string } }>().user.id
  }

  /** What Better Auth holds for one user, across its three collections. */
  async function authRowsFor(userId: string): Promise<number> {
    const id = authId(userId)
    const counts = await Promise.all([
      handle.db.collection(COLLECTIONS.user).countDocuments({ _id: id }),
      handle.db.collection(COLLECTIONS.session).countDocuments({ userId: id }),
      handle.db.collection(COLLECTIONS.account).countDocuments({ userId: id }),
    ])
    return counts.reduce((total, count) => total + count, 0)
  }

  const guestBody = {
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
  }

  it('can create a profile with only languages', async () => {
    const cookie = await signInAsGuest()
    const created = await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })
    expect(created.statusCode, created.body).toBe(201)

    const profile = created.json<Profile>()
    expect(profile.guest).toBe(true)
    // The two things that keep a guest out of everybody else's way.
    expect(profile.settings.discoverable).toBe(false)
    expect(profile.handle.startsWith('guest:')).toBe(true)
  })

  /**
   * A guest has not signed up, and paying the bonus here would pay it twice
   * when they do — the ledger's unique is keyed on the *user id*, and
   * registering mints a new one.
   */
  it('is not paid the signup bonus', async () => {
    const cookie = await signInAsGuest()
    const created = await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })
    const userId = created.json<Profile>()._id

    const ledger = await handle.db
      .collection(COLLECTIONS.tokenLedger)
      .countDocuments({ userId, kind: 'signupBonus' })
    expect(ledger).toBe(0)
  })

  it('can browse', async () => {
    const cookie = await signInAsGuest()
    await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })

    for (const url of ['/discovery', '/feed']) {
      const response = await app.inject({ method: 'GET', url, headers: { cookie } })
      expect(response.statusCode, `${url}: ${response.body}`).toBe(200)
    }
  })

  /**
   * Iterated over a table rather than written out one by one, so a write route
   * added later without `requireMember` fails here rather than shipping.
   */
  it('is refused every write', async () => {
    const cookie = await signInAsGuest()
    await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })

    const writes: InjectOptions[] = [
      { method: 'PATCH', url: '/profiles/me', payload: { bio: 'hello' } },
      { method: 'POST', url: '/profiles/me/location', payload: { lat: 41, lng: 29 } },
      { method: 'DELETE', url: '/profiles/me/location' },
      { method: 'POST', url: '/billing/refresh' },
      {
        method: 'POST',
        url: '/me/devices',
        payload: { pushToken: 'ExponentPushToken[x]', platform: 'ios' },
      },
      { method: 'PATCH', url: '/me/devices/phone-a', payload: { pushEnabled: false } },
      { method: 'POST', url: '/blocks', payload: { userId: 'someone' } },
      { method: 'POST', url: '/reports', payload: { userId: 'someone', reason: 'spam' } },

      /*
       * Behind `requireVerifiedEmail` rather than `requireMember`, and in the
       * table for that reason. They were already closed to a guest — an
       * anonymous user is never `emailVerified` — but they answered with
       * `EMAIL_NOT_VERIFIED`, and a guest has no email to verify, so the
       * client had nowhere to send them and fell through to a generic toast.
       * Found on `Follow`, which is the primary button on a profile.
       */
      { method: 'POST', url: '/profiles/someone/follow' },
      { method: 'POST', url: '/posts', payload: { body: 'hello', language: 'tr' } },
      { method: 'PUT', url: '/likes', payload: { targetType: 'post', targetId: 'x' } },
      { method: 'POST', url: '/conversations', payload: { toUserId: 'someone', body: 'hi' } },
      { method: 'POST', url: '/translate', payload: { text: 'merhaba', targetLang: 'en' } },
    ]

    for (const write of writes) {
      const where = `${String(write.method)} ${JSON.stringify(write.url)}`
      const response = await app.inject({ ...write, headers: { cookie } })
      expect(response.statusCode, `${where} -> ${response.body}`).toBe(403)
      expect(response.json<{ code: string }>().code, where).toBe('GUEST_ACCOUNT')
    }
  })

  it('never appears in anybody else discovery', async () => {
    const cookie = await signInAsGuest()
    await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })

    const guests = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .countDocuments({ guest: true, 'settings.discoverable': true })
    expect(guests).toBe(0)
  })
  /**
   * A guest session is not meant to survive the app being closed — while one
   * does, the app mounts both halves of its router and `/` stops resolving to
   * one screen. The app ends it on the next launch through this route.
   */
  it('deletes the guest, the profile and every Better Auth row', async () => {
    const cookie = await signInAsGuest()
    const userId = await guestUserId(cookie)
    await app.inject({
      method: 'POST',
      url: '/profiles/guest',
      headers: { cookie },
      payload: guestBody,
    })

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/profiles/guest',
      headers: { cookie },
    })
    expect(deleted.statusCode, deleted.body).toBe(204)

    expect(
      await handle.db.collection<Profile>(COLLECTIONS.profiles).countDocuments({ _id: userId }),
    ).toBe(0)
    expect(await authRowsFor(userId)).toBe(0)

    // The cookie in hand is worth nothing now, which is the half a plain
    // sign-out would have got right and a profile-only delete would not.
    const after = await app.inject({ method: 'GET', url: '/profiles/me', headers: { cookie } })
    expect(after.statusCode).toBe(401)
  })

  /**
   * The case the hourly sweep could not see: it looks for `profiles.guest`,
   * and somebody who tapped "look around" and closed the app has no profile
   * at all. Their user row used to stay forever.
   */
  it('deletes a guest who never picked a language', async () => {
    const cookie = await signInAsGuest()
    const userId = await guestUserId(cookie)

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/profiles/guest',
      headers: { cookie },
    })
    expect(deleted.statusCode, deleted.body).toBe(204)
    expect(await authRowsFor(userId)).toBe(0)
  })

  it('refuses to delete a real account', async () => {
    const member = await signUpAndSignIn(app, emailSender, {
      email: 'not-a-guest@example.com',
      password: MEMBER_PASSWORD,
      name: 'Not A Guest',
    })

    const refused = await app.inject({
      method: 'DELETE',
      url: '/profiles/guest',
      headers: { cookie: member.cookie },
    })
    expect(refused.statusCode, refused.body).toBe(400)
    expect(refused.json<{ code: string }>().code).toBe('VALIDATION_FAILED')
    expect(await authRowsFor(member.userId)).toBeGreaterThan(0)
  })
  /**
   * The safety net behind the delete above, for the guests the app never gets
   * to end — killed mid-launch, or offline when it tried. Keyed on
   * `isAnonymous` rather than on a profile, which is the whole point: this
   * guest has no profile to be found by.
   *
   * Last in the file: it sweeps every guest in the database.
   */
  it('sweeps a profile-less guest once it is past its TTL', async () => {
    const cookie = await signInAsGuest()
    const userId = await guestUserId(cookie)
    expect(await authRowsFor(userId)).toBeGreaterThan(0)

    const swept = await purgeStaleGuests(handle.db, new Date(Date.now() + GUEST_TTL_MS + 1000))
    expect(swept.purged).toBeGreaterThan(0)
    expect(await authRowsFor(userId)).toBe(0)
  })
})
