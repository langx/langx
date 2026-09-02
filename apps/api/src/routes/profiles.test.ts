import { CURRENT_TERMS_VERSION, PLAN_LIMITS } from '@langx/shared'
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
import { authId } from '../lib/authId'
import { hashLegacyEmail } from '../modules/handles/legacyEmailHash'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const LEGACY_SALT = 'test-legacy-salt'
const PASSWORD = 'correct horse battery staple'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: 'newuser',
    displayName: 'New User',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

describe('Faz 2 — profiles, username claim, avatar upload', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, name = 'Test User'): Promise<SignedUpUser> {
    return signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_profiles_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_profiles_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: LEGACY_SALT,
    })

    // The real server calls this before serving traffic (index.ts) — without
    // it here, `profiles.handle`'s unique index doesn't exist and the whole
    // point of the handle-claim tests silently stops being tested.
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

    // Same first-transaction warm-up as auth.test.ts — see its comment for why.
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

  it('rejects an unauthenticated onboarding attempt', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      payload: onboardingBody(),
    })
    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('creates a profile for a fresh (non-legacy) handle', async () => {
    const user = await newUser('fresh-handle@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'freshhandle' }),
    })

    expect(response.statusCode, response.body).toBe(201)
    expect(response.json()).toMatchObject({ _id: user.userId, handle: 'freshhandle' })
  })

  it('rejects a second profile for the same account', async () => {
    const user = await newUser('double-onboard@example.com')

    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'doubleonboard' }),
    })

    const second = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'doubleonboardtwo' }),
    })
    expect(second.statusCode).toBe(400)
  })

  /**
   * The country is a fact about the connection, not an answer on a form: the
   * whole reason it moved server-side is that a self-declared country makes
   * the discovery filter meaningless.
   */
  it('takes the country from the edge and ignores what the form claimed', async () => {
    const user = await newUser('edge-country@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie, 'cf-ipcountry': 'de' },
      payload: onboardingBody({ handle: 'edgecountry', country: 'FR' }),
    })

    expect(response.statusCode, response.body).toBe(201)
    expect(response.json<Profile>().country).toBe('DE')
  })

  it('falls back to the form when the edge cannot say where the request came from', async () => {
    const user = await newUser('tor-country@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie, 'cf-ipcountry': 'T1' },
      payload: onboardingBody({ handle: 'torcountry', country: 'FR' }),
    })

    expect(response.statusCode, response.body).toBe(201)
    expect(response.json<Profile>().country).toBe('FR')
  })

  it('lets a location fix overwrite it, and only through its own route', async () => {
    const user = await newUser('located@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie, 'cf-ipcountry': 'DE' },
      payload: onboardingBody({ handle: 'located' }),
    })

    const viaUpdate = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
      payload: { country: 'TR' },
    })
    // `country` is not part of the update schema, so zod drops it: the request
    // succeeds and changes nothing, which is what "cannot be edited" means
    // from the client's side.
    expect(viaUpdate.statusCode, viaUpdate.body).toBe(200)
    expect(viaUpdate.json<Profile>().country).toBe('DE')

    const viaLocation = await app.inject({
      method: 'PATCH',
      url: '/profiles/me/country',
      headers: { cookie: user.cookie },
      payload: { country: 'TR', source: 'location' },
    })
    expect(viaLocation.statusCode, viaLocation.body).toBe(200)
    expect(viaLocation.json<Profile>().country).toBe('TR')
  })

  /**
   * `gender` decides whose discovery results you appear in, so it is not a
   * field to retype — the same reasoning that has always kept `birthDate` out
   * of `PATCH /profiles/me`. The one move still allowed is answering the
   * question if onboarding left it blank, and that is a one-way door.
   */
  describe('gender is set once', () => {
    async function onboard(email: string, handleName: string, gender: string) {
      const user = await newUser(email)
      const created = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: handleName, gender }),
      })
      expect(created.statusCode, created.body).toBe(201)
      return user
    }

    it('drops gender from the update body instead of writing it', async () => {
      const user = await onboard('gender-patch@example.com', 'genderpatch', 'female')

      const response = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: { bio: 'Still me', gender: 'male' },
      })

      // Not a 400: zod strips what the schema does not name, exactly as it
      // does for `country` above. The bio lands, the gender does not.
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json<Profile>().gender).toBe('female')
      expect(response.json<Profile>().bio).toBe('Still me')
    })

    it('lets somebody who skipped the question answer it, once', async () => {
      const user = await onboard('gender-disclose@example.com', 'genderdisclose', 'undisclosed')

      const first = await app.inject({
        method: 'POST',
        url: '/profiles/me/gender',
        headers: { cookie: user.cookie },
        payload: { gender: 'male' },
      })
      expect(first.statusCode, first.body).toBe(200)
      expect(first.json<Profile>().gender).toBe('male')

      const second = await app.inject({
        method: 'POST',
        url: '/profiles/me/gender',
        headers: { cookie: user.cookie },
        payload: { gender: 'female' },
      })
      expect(second.statusCode).toBe(400)
      expect(second.json()).toMatchObject({ code: 'VALIDATION_FAILED' })

      const after = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(after?.gender).toBe('male')
    })

    it('refuses to reopen the question — there is no way back to undisclosed', async () => {
      const user = await onboard('gender-reopen@example.com', 'genderreopen', 'female')

      const response = await app.inject({
        method: 'POST',
        url: '/profiles/me/gender',
        headers: { cookie: user.cookie },
        payload: { gender: 'undisclosed' },
      })
      // Refused by the schema, not by the repository: `undisclosed` is not a
      // member of `discloseGenderSchema`, so it never reaches the filter.
      expect(response.statusCode).toBe(400)
    })

    /**
     * The condition is in the update's filter rather than in a read before it,
     * so two taps that race cannot both win. Without that, the second would
     * overwrite the first and the field would be editable after all — by
     * anyone willing to tap twice quickly.
     */
    it('settles concurrent disclosures on one answer', async () => {
      const user = await onboard('gender-race@example.com', 'genderrace', 'undisclosed')

      const responses = await Promise.all(
        (['female', 'male', 'other'] as const).map((gender) =>
          app.inject({
            method: 'POST',
            url: '/profiles/me/gender',
            headers: { cookie: user.cookie },
            payload: { gender },
          }),
        ),
      )

      expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1)
      expect(responses.filter((r) => r.statusCode === 400)).toHaveLength(2)
    })
  })

  /**
   * The profile screen used to offer a "send a message" box to somebody you
   * were already talking to, and sending from it failed — `startConversation`
   * refuses a second thread. The screen needs to know, and only the viewer's
   * own request can answer it.
   */
  it('tells the viewer about the conversation they already have', async () => {
    const one = await newUser('pair-one@example.com')
    const two = await newUser('pair-two@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: one.cookie },
      payload: onboardingBody({ handle: 'pairone' }),
    })
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: two.cookie },
      payload: onboardingBody({ handle: 'pairtwo' }),
    })

    const before = await app.inject({
      method: 'GET',
      url: '/profiles/pairtwo',
      headers: { cookie: one.cookie },
    })
    expect(before.json<{ conversationId?: string }>().conversationId).toBeUndefined()

    const started = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: one.cookie },
      payload: { toUserId: two.userId, body: 'Merhaba' },
    })
    expect(started.statusCode, started.body).toBe(201)

    const after = await app.inject({
      method: 'GET',
      url: '/profiles/pairtwo',
      headers: { cookie: one.cookie },
    })
    expect(after.json<{ conversationId?: string }>().conversationId).toBe(
      started.json<{ _id: string }>()._id,
    )

    // And the other way round: the same thread, from the other side.
    const mirrored = await app.inject({
      method: 'GET',
      url: '/profiles/pairone',
      headers: { cookie: two.cookie },
    })
    expect(mirrored.json<{ conversationId?: string }>().conversationId).toBe(
      started.json<{ _id: string }>()._id,
    )
  })

  /**
   * Four booleans and the settings screen flips one at a time. Writing
   * `settings` whole — which is what the old single-boolean shape allowed —
   * would clear the other three on every toggle.
   */
  it('changes one notification switch without touching the others', async () => {
    const user = await newUser('prefs@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'prefsuser' }),
    })

    const updated = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
      payload: { settings: { notifications: { streak: false } } },
    })

    expect(updated.statusCode, updated.body).toBe(200)
    const settings = updated.json<{
      settings: { discoverable: boolean; notifications: Record<string, boolean> }
    }>().settings
    expect(settings.notifications.streak).toBe(false)
    expect(settings.notifications.messages).toBe(true)
    expect(settings.notifications.promotions).toBe(false)
    expect(settings.discoverable).toBe(true)
  })

  /**
   * The dotted path is also the migration. A profile still holding the retired
   * `{push, email}` matrix converts that kind to a boolean the first time its
   * owner touches the switch — Mongo allows a `$set` to change a field's type
   * — and the kinds nobody touches stay as they are, for `notificationsAllowed`
   * to read.
   */
  it('replaces a stored push/email matrix with the switch that replaced it', async () => {
    const user = await newUser('matrix-prefs@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'matrixprefs' }),
    })
    await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      { _id: user.userId },
      {
        $set: {
          'settings.notifications': {
            messages: { push: true, email: false },
            streak: { push: true, email: false },
            profileVisits: { push: true, email: false },
            promotions: { push: false, email: false },
          },
        },
      },
    )

    const updated = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
      payload: { settings: { notifications: { streak: false } } },
    })

    expect(updated.statusCode, updated.body).toBe(200)
    const notifications = updated.json<{
      settings: { notifications: Record<string, unknown> }
    }>().settings.notifications
    expect(notifications.streak).toBe(false)
    // Untouched, so still the old shape — and still readable.
    expect(notifications.messages).toEqual({ push: true, email: false })
  })

  describe('handles as public addresses', () => {
    it('refuses a reserved word at onboarding', async () => {
      const user = await newUser('reserved-handle@example.com')
      const response = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: 'settings' }),
      })
      expect(response.statusCode, response.body).toBe(400)
    })

    it('refuses a handle shorter than the new floor', async () => {
      const user = await newUser('short-handle@example.com')
      const response = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: 'ada' }),
      })
      expect(response.statusCode, response.body).toBe(400)
    })

    it('reports both as unavailable rather than as a malformed request', async () => {
      const user = await newUser('availability-rules@example.com')
      for (const handle of ['settings', 'ada']) {
        const response = await app.inject({
          method: 'GET',
          url: `/handles/${handle}/availability`,
          headers: { cookie: user.cookie },
        })
        expect(response.statusCode, handle).toBe(200)
        expect(response.json<{ available: boolean }>().available, handle).toBe(false)
      }
    })

    /**
     * The grandfather case, and the reason `handleSchema` was not simply
     * tightened: a v1 account can hold three characters, and its own profile
     * — and the link it has already shared — has to keep resolving.
     */
    it('still resolves a three-character handle written before the floor', async () => {
      const owner = await newUser('legacy-short@example.com')
      await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: owner.cookie },
        payload: onboardingBody({ handle: 'adalove' }),
      })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: owner.userId }, { $set: { handle: 'ada' } })

      const viewer = await newUser('legacy-short-viewer@example.com')
      await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: viewer.cookie },
        payload: onboardingBody({ handle: 'shortviewer' }),
      })

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/ada',
        headers: { cookie: viewer.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
    })
  })

  describe('GET /public/qr/:handle', () => {
    it('draws an SVG with no session, and caches it', async () => {
      const response = await app.inject({ method: 'GET', url: '/public/qr/behicsakar' })

      expect(response.statusCode, response.body).toBe(200)
      expect(response.headers['content-type']).toContain('image/svg+xml')
      expect(response.headers['cache-control']).toContain('max-age=')
      expect(response.body).toContain('<svg')
      /*
       * The header that made this endpoint useless in production. Helmet sets
       * `same-origin` for everything, which is right for an API and wrong for
       * a picture: the web build is on another host, so the browser blocked
       * the image outright with nothing logged server-side.
       */
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin')
    })

    /**
     * Deliberately not checked against the database. Answering 404 for an
     * unknown handle would turn a picture endpoint into a way to enumerate
     * accounts, and a code that resolves to a "no profile here" page is a
     * harmless thing to have drawn.
     */
    it('draws one for a handle nobody holds', async () => {
      expect((await app.inject({ method: 'GET', url: '/public/qr/nobodyhere' })).statusCode).toBe(
        200,
      )
    })

    it('refuses something that could not be a handle at all', async () => {
      expect((await app.inject({ method: 'GET', url: '/public/qr/a' })).statusCode).toBe(400)
    })

    it('lets the device link code be embedded too', async () => {
      const response = await app.inject({ method: 'GET', url: '/public/qr/link/ABCD1234' })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin')
      // Two minutes of life; caching the picture past that serves the dead.
      expect(response.headers['cache-control']).toBe('no-store')
    })
  })

  describe('GET /public/profiles/:handle', () => {
    async function seed(email: string, handle: string) {
      const user = await newUser(email)
      const created = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle, bio: 'Here to practise.' }),
      })
      expect(created.statusCode, created.body).toBe(201)
      return user
    }

    it('answers with no session at all, which is the point of a shared link', async () => {
      await seed('public-read@example.com', 'publicone')
      const response = await app.inject({ method: 'GET', url: '/profiles/publicone' })
      expect(response.statusCode).toBe(401)

      const shared = await app.inject({ method: 'GET', url: '/public/profiles/publicone' })
      expect(shared.statusCode, shared.body).toBe(200)
      expect(shared.json<{ handle: string }>().handle).toBe('publicone')
    })

    /**
     * A second allow-list rather than a flag on `toPublicProfile`. Age, city
     * and photos are individually mild and together are the set that makes a
     * link somebody shared feel like one they did not mean to.
     */
    it('leaves out everything a member sees that the open internet should not', async () => {
      await seed('public-fields@example.com', 'publictwo')
      const body = (await app.inject({ method: 'GET', url: '/public/profiles/publictwo' })).json<
        Record<string, unknown>
      >()

      expect(Object.keys(body).sort()).toEqual(
        ['bio', 'displayName', 'handle', 'learning', 'nativeLanguages'].sort(),
      )
      for (const absent of ['age', 'photos', 'streak', 'isOnline', 'tier', 'city', '_id']) {
        expect(body[absent], absent).toBeUndefined()
      }
    })

    it('is a 404 for a handle nobody holds', async () => {
      const response = await app.inject({ method: 'GET', url: '/public/profiles/nobodyhere' })
      expect(response.statusCode).toBe(404)
    })
  })

  it('rejects an underage birthDate even though the client already validated it', async () => {
    const user = await newUser('underage-attempt@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({
        handle: 'underageuser',
        birthDate: `${new Date().getUTCFullYear() - 10}-06-15`,
      }),
    })

    // Caught by the shared zod schema before the handler even runs.
    expect(response.statusCode).toBe(400)
  })

  it('rejects two profiles claiming the same fresh handle — the unique index is the real guard', async () => {
    const first = await newUser('handle-race-1@example.com')
    const second = await newUser('handle-race-2@example.com')

    const firstAttempt = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: first.cookie },
      payload: onboardingBody({ handle: 'contestedhandle' }),
    })
    expect(firstAttempt.statusCode, firstAttempt.body).toBe(201)

    const secondAttempt = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: second.cookie },
      payload: onboardingBody({ handle: 'contestedhandle' }),
    })
    expect(secondAttempt.statusCode).toBe(409)
    expect(secondAttempt.json()).toMatchObject({ code: 'HANDLE_TAKEN' })
  })

  it('claims a reserved handle when the verified email matches the legacy reservation', async () => {
    const email = 'returning-v1-user@example.com'
    const legacyEmailHash = hashLegacyEmail(email, LEGACY_SALT)
    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'returninguser',
      legacyEmailHash,
      legacyUserId: 'appwrite-legacy-id-1',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })

    const user = await newUser(email)

    // The onboarding UI's "your old handle is waiting" check.
    const reservationCheck = await app.inject({
      method: 'GET',
      url: '/handle-reservation',
      headers: { cookie: user.cookie },
    })
    expect(reservationCheck.json()).toMatchObject({ reservation: { handle: 'returninguser' } })

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'returninguser' }),
    })
    expect(response.statusCode, response.body).toBe(201)

    const reservation = await handle.db
      .collection(COLLECTIONS.handleReservations)
      .findOne({ handle: 'returninguser' })
    expect(reservation?.claimedBy).toBe(user.userId)
  })

  it('refuses a reserved handle when the verified email does NOT match — the core Faz 2 gate', async () => {
    const ownerEmail = 'rightful-owner@example.com'
    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'protectedhandle',
      legacyEmailHash: hashLegacyEmail(ownerEmail, LEGACY_SALT),
      legacyUserId: 'appwrite-legacy-id-2',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })

    const impostor = await newUser('wrong-email-attempt@example.com')

    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: impostor.cookie },
      payload: onboardingBody({ handle: 'protectedhandle' }),
    })
    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'HANDLE_RESERVED' })

    const reservation = await handle.db
      .collection(COLLECTIONS.handleReservations)
      .findOne({ handle: 'protectedhandle' })
    expect(reservation?.claimedBy).toBeUndefined()
  })

  it('treats an expired reservation as a free handle', async () => {
    const email = 'too-late-to-claim@example.com'
    await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
      handle: 'expiredhandle',
      legacyEmailHash: hashLegacyEmail(email, LEGACY_SALT),
      legacyUserId: 'appwrite-legacy-id-3',
      expiresAt: new Date(Date.now() - 1000),
    })

    const user = await newUser(email)
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'expiredhandle' }),
    })
    expect(response.statusCode, response.body).toBe(201)
  })

  it('reports handle availability correctly', async () => {
    const user = await newUser('availability-checker@example.com')

    const available = await app.inject({
      method: 'GET',
      url: '/handles/somefreehandle/availability',
      headers: { cookie: user.cookie },
    })
    expect(available.json()).toEqual({ available: true })

    const taken = await app.inject({
      method: 'GET',
      url: '/handles/freshhandle/availability', // claimed by an earlier test
      headers: { cookie: user.cookie },
    })
    expect(taken.json()).toEqual({ available: false })
  })

  it('gets and updates the profile it just created', async () => {
    const user = await newUser('crud-flow@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'crudflow' }),
    })

    const got = await app.inject({
      method: 'GET',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
    })
    const gotBody = got.json<Record<string, unknown>>()
    expect(gotBody).toMatchObject({ handle: 'crudflow' })
    expect('bio' in gotBody).toBe(false) // never set, so never written at all

    const updated = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
      payload: { bio: 'Hello from the test suite' },
    })
    expect(updated.statusCode, updated.body).toBe(200)
    expect(updated.json()).toMatchObject({ bio: 'Hello from the test suite', handle: 'crudflow' })
  })

  it('rejects an update that makes a learning language also native', async () => {
    const user = await newUser('overlap-update@example.com')
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody({ handle: 'overlapupdate' }),
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { cookie: user.cookie },
      payload: {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    expect(response.statusCode).toBe(400)
  })

  it('avatar upload-url fails clearly when storage is not configured', async () => {
    const user = await newUser('avatar-unconfigured@example.com')

    const uploadUrl = await app.inject({
      method: 'POST',
      url: '/me/avatar/upload-url',
      headers: { cookie: user.cookie },
      payload: { contentType: 'image/png' },
    })
    expect(uploadUrl.statusCode).toBe(500)
  })

  describe('with storage configured', () => {
    // A presigned URL is pure local signing — @aws-sdk/s3-request-presigner
    // never makes a network call to produce one — so a syntactically valid
    // but fake endpoint exercises the real code path with no live bucket.
    let configuredApp: FastifyInstance

    beforeAll(async () => {
      const env = loadEnv({
        NODE_ENV: 'test',
        MONGODB_URI: replSet.getUri(),
        MONGODB_DB: 'langx_profiles_test',
        LOG_LEVEL: 'silent',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        BETTER_AUTH_URL: 'http://localhost:4000',
        LEGACY_EMAIL_HASH_SALT: LEGACY_SALT,
        STORAGE_ENDPOINT: 'https://fake-r2.example.com',
        STORAGE_BUCKET: 'langx-avatars-test',
        STORAGE_ACCESS_KEY_ID: 'fake-access-key-id',
        STORAGE_SECRET_ACCESS_KEY: 'fake-secret-access-key',
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
      })
      const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
      const storage = createStorageProvider(env)
      const translation = createTranslationProvider(env)
      const revenueCat = createRevenueCatClientFromEnv(env)
      configuredApp = await buildApp({
        env,
        client: handle.client,
        db: handle.db,
        auth,
        storage,
        translation,
        revenueCat,
      })
      await configuredApp.ready()
    })

    afterAll(async () => {
      await configuredApp?.close()
    })

    it('returns a presigned upload URL under the public base, and confirm accepts it', async () => {
      const user = await newUser('avatar-configured@example.com')
      await configuredApp.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: 'avatarconfigured' }),
      })

      const uploadUrl = await configuredApp.inject({
        method: 'POST',
        url: '/me/avatar/upload-url',
        headers: { cookie: user.cookie },
        payload: { contentType: 'image/png' },
      })
      expect(uploadUrl.statusCode, uploadUrl.body).toBe(200)
      const body = uploadUrl.json<{ uploadUrl: string; publicUrl: string }>()
      expect(body.publicUrl).toMatch(
        new RegExp(`^https://cdn\\.example\\.com/avatars/${user.userId}/.+\\.png$`),
      )
      expect(body.uploadUrl).toContain('fake-r2.example.com')

      const confirm = await configuredApp.inject({
        method: 'POST',
        url: '/me/avatar/confirm',
        headers: { cookie: user.cookie },
        payload: { avatarUrl: body.publicUrl },
      })
      expect(confirm.statusCode, confirm.body).toBe(200)
      expect(confirm.json()).toMatchObject({ avatarUrl: body.publicUrl })
    })

    /**
     * Onboarding writes an `avatarUrl` on a path that never calls `confirm`,
     * so it needs its own copy of the bucket check — without it the wizard
     * quietly reopens the hole `confirm` exists to close: a profile picture
     * served from any host on the internet, inside our UI.
     */
    it('accepts an onboarding avatar that lives in our bucket', async () => {
      const user = await newUser('onboarding-avatar-ok@example.com')
      const response = await configuredApp.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({
          handle: 'onboardavatar',
          avatarUrl: `https://cdn.example.com/avatars/${user.userId}/a.png`,
        }),
      })

      expect(response.statusCode, response.body).toBe(201)
      expect(response.json()).toMatchObject({
        avatarUrl: `https://cdn.example.com/avatars/${user.userId}/a.png`,
      })
    })

    it('refuses an onboarding avatar hosted anywhere else, and writes no profile', async () => {
      const user = await newUser('onboarding-avatar-foreign@example.com')
      const response = await configuredApp.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({
          handle: 'onboardforeign',
          avatarUrl: 'https://evil.example.com/pretty.png',
        }),
      })

      expect(response.statusCode).toBe(400)
      // The whole request fails rather than the field being dropped: silently
      // ignoring it would tell the user their picture was set when it was not.
      const profile = await configuredApp.inject({
        method: 'GET',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
      })
      expect(profile.statusCode).toBe(404)
    })

    it('rejects a confirm URL that does not point into our own bucket', async () => {
      const user = await newUser('avatar-foreign-url@example.com')
      await configuredApp.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: 'avatarforeign' }),
      })

      const confirm = await configuredApp.inject({
        method: 'POST',
        url: '/me/avatar/confirm',
        headers: { cookie: user.cookie },
        payload: { avatarUrl: 'https://evil.example.com/not-our-bucket.png' },
      })
      expect(confirm.statusCode).toBe(400)
      expect(confirm.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
    })
  })

  describe('gallery photos', () => {
    const BUCKET = 'https://cdn.example.com'

    /** `newUser` only signs up; the gallery needs a profile to attach to. */
    async function onboarded(email: string, handle: string): Promise<SignedUpUser> {
      const user = await newUser(email)
      const response = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle }),
      })
      if (response.statusCode !== 201) {
        throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
      }
      return user
    }

    async function addPhoto(user: SignedUpUser, url: string) {
      return app.inject({
        method: 'POST',
        url: '/me/photos',
        headers: { cookie: user.cookie },
        payload: { url },
      })
    }

    it('refuses a URL outside our own bucket', async () => {
      const user = await onboarded('photos-foreign@example.com', 'photosforeign')
      // Without this, a profile could point at any host — which breaks the
      // deletion purge and hands us an arbitrary-image-embed surface.
      const response = await addPhoto(user, 'https://evil.example.net/pic.jpg')
      expect([400, 500]).toContain(response.statusCode)
    })

    it('caps the gallery and does not exceed it under concurrent adds', async () => {
      const user = await onboarded('photos-cap@example.com', 'photoscap')
      const max = PLAN_LIMITS.free.maxPhotos

      // Written straight to the document: the presigned upload path needs real
      // storage, and what is under test here is the cap, not the upload.
      const profiles = handle.db.collection(COLLECTIONS.profiles)
      await profiles.updateOne({ _id: user.userId as never }, { $set: { photos: [] } })

      const { addPhoto: addPhotoDirect } = await import('../modules/profiles/profiles')
      const results = await Promise.allSettled(
        Array.from({ length: max + 4 }, (_, i) =>
          addPhotoDirect(handle.db, user.userId, `${BUCKET}/p${i}.jpg`),
        ),
      )
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(max)

      const profile = await profiles.findOne({ _id: user.userId as never })
      expect((profile as { photos?: unknown[] })?.photos).toHaveLength(max)
    })

    it('removes a photo by url', async () => {
      const user = await onboarded('photos-remove@example.com', 'photosremove')
      const { addPhoto: addPhotoDirect, removePhoto } = await import('../modules/profiles/profiles')
      await addPhotoDirect(handle.db, user.userId, `${BUCKET}/keep.jpg`)
      await addPhotoDirect(handle.db, user.userId, `${BUCKET}/drop.jpg`)

      const after = await removePhoto(handle.db, user.userId, `${BUCKET}/drop.jpg`)
      expect(after.photos?.map((p) => p.url)).toEqual([`${BUCKET}/keep.jpg`])
    })
  })

  describe('location sharing', () => {
    /** `newUser` only signs up; location attaches to a profile. */
    async function onboarded(email: string, handle: string): Promise<SignedUpUser> {
      const user = await newUser(email)
      const response = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle }),
      })
      if (response.statusCode !== 201) {
        throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
      }
      return user
    }

    function share(user: SignedUpUser, payload: Record<string, number>) {
      return app.inject({
        method: 'POST',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
        payload,
      })
    }

    it('stores a coarsened point and keeps no precise copy of what the device sent', async () => {
      const user = await onboarded('location-store@example.com', 'locationstore')
      const response = await share(user, { lat: 41.008238, lng: 28.978359 })
      expect(response.statusCode, response.body).toBe(200)

      const stored = await handle.db
        .collection(COLLECTIONS.profiles)
        .findOne<{ location?: { type: string; coordinates: number[] }; locationUpdatedAt?: Date }>({
          _id: user.userId as never,
        })
      // GeoJSON order, and nothing finer than the documented grid — the metre-
      // accurate reading must not exist on the server in any field.
      expect(stored?.location).toEqual({ type: 'Point', coordinates: [28.98, 41.01] })
      expect(stored?.locationUpdatedAt).toBeInstanceOf(Date)
      expect(JSON.stringify(stored)).not.toContain('41.008238')
    })

    it('overwrites rather than accumulating, so an old position cannot be read back', async () => {
      const user = await onboarded('location-move@example.com', 'locationmove')
      await share(user, { lat: 41.0082, lng: 28.9784 })
      await share(user, { lat: 39.9334, lng: 32.8597 })

      const stored = await handle.db
        .collection(COLLECTIONS.profiles)
        .findOne<{ location?: { coordinates: number[] } }>({ _id: user.userId as never })
      expect(stored?.location?.coordinates).toEqual([32.86, 39.93])
    })

    it('removes the field on delete, not merely a flag — absence is what keeps you out of the geo index', async () => {
      const user = await onboarded('location-clear@example.com', 'locationclear')
      await share(user, { lat: 41.0082, lng: 28.9784 })

      const response = await app.inject({
        method: 'DELETE',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)

      const stored = await handle.db
        .collection(COLLECTIONS.profiles)
        .findOne({ _id: user.userId as never })
      expect(stored).not.toHaveProperty('location')
      expect(stored).not.toHaveProperty('locationUpdatedAt')
    })

    it('is idempotent when nothing was shared, so a settings toggle never has to check first', async () => {
      const user = await onboarded('location-clear-twice@example.com', 'locationcleartwice')
      const response = await app.inject({
        method: 'DELETE',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode).toBe(200)
    })

    it('rejects coordinates that are not on the planet', async () => {
      const user = await onboarded('location-invalid@example.com', 'locationinvalid')
      const response = await share(user, { lat: 123, lng: 28.9784 })
      expect(response.statusCode).toBe(400)
      expect(response.json<{ code: string }>().code).toBe('VALIDATION_FAILED')
    })

    it('needs a session — a location is the last thing to accept anonymously', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/profiles/me/location',
        payload: { lat: 41.0082, lng: 28.9784 },
      })
      expect(response.statusCode).toBe(401)
    })

    it('never appears on somebody else profile', async () => {
      const viewed = await onboarded('location-public-viewed@example.com', 'locationviewed')
      await share(viewed, { lat: 41.0082, lng: 28.9784 })
      const viewer = await onboarded('location-public-viewer@example.com', 'locationviewer')

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/locationviewed',
        headers: { cookie: viewer.cookie },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json()).not.toHaveProperty('location')
      expect(response.body).not.toContain('28.98')
    })
  })

  describe('account age and email verification on a public profile', () => {
    async function onboarded(email: string, handle: string): Promise<SignedUpUser> {
      const user = await newUser(email)
      const response = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle }),
      })
      if (response.statusCode !== 201) {
        throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
      }
      return user
    }

    it('carries createdAt and emailVerified, and no raw birthYear or email', async () => {
      await onboarded('public-age-viewed@example.com', 'ageviewed')
      const viewer = await onboarded('public-age-viewer@example.com', 'ageviewer')

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/ageviewed',
        headers: { cookie: viewer.cookie },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ createdAt: string; emailVerified: boolean }>()
      expect(new Date(body.createdAt).getTime()).toBeGreaterThan(0)
      // The account got here through onboarding, which requires a verified
      // email — so `true` here also proves the ObjectId lookup found the
      // Better Auth user at all. A string `_id` would find nothing and
      // report every profile unverified without failing.
      expect(body.emailVerified).toBe(true)
      expect(body).not.toHaveProperty('birthYear')
      expect(response.body).not.toContain('public-age-viewed@example.com')
    })

    it('reports an unverified account as unverified rather than assuming', async () => {
      const viewer = await onboarded('public-unverified-viewer@example.com', 'unverifviewer')
      const target = await onboarded('public-unverified@example.com', 'unverifviewed')

      // Reaching past Better Auth on purpose: nothing in the app can produce
      // this state today, because onboarding is gated on a verified email.
      // The flag is read from `user` rather than assumed for exactly the day
      // that stops being true.
      await handle.db
        .collection(COLLECTIONS.user)
        .updateOne({ _id: authId(target.userId) }, { $set: { emailVerified: false } })

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/unverifviewed',
        headers: { cookie: viewer.cookie },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json<{ emailVerified: boolean }>().emailVerified).toBe(false)
    })
  })

  describe('the language allowance', () => {
    async function onboardedWith(
      email: string,
      userHandle: string,
      learning: { code: string; level: string; priority: number }[],
    ) {
      const user = await newUser(email)
      const created = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: userHandle, learning }),
      })
      return { user, created }
    }

    const patch = (user: SignedUpUser, body: Record<string, unknown>) =>
      app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: body,
      })

    it('caps onboarding at the free allowance', async () => {
      const { created } = await onboardedWith('lang-onboard@example.com', 'langonboard', [
        { code: 'en', level: 'intermediate', priority: 1 },
        { code: 'de', level: 'intermediate', priority: 2 },
      ])
      expect(created.statusCode).toBe(403)
      expect(created.json<{ code: string; limit: string; max: number }>()).toMatchObject({
        code: 'UPGRADE_REQUIRED',
        limit: 'learningLanguages',
        max: PLAN_LIMITS.free.maxLearningLanguages,
      })
    })

    it('refuses a free account a second learning language', async () => {
      const { user, created } = await onboardedWith('lang-second@example.com', 'langsecond', [
        { code: 'en', level: 'intermediate', priority: 1 },
      ])
      expect(created.statusCode).toBe(201)

      const response = await patch(user, {
        learning: [
          { code: 'en', level: 'intermediate', priority: 1 },
          { code: 'de', level: 'beginner', priority: 2 },
        ],
      })
      expect(response.statusCode).toBe(403)
      expect(response.json<{ limit: string }>().limit).toBe('learningLanguages')
    })

    /**
     * The clause that makes grandfathering real. A migrated v1 user is over the
     * free limit by definition; without it every write they make carries an
     * over-limit array and is refused, so the limit reads as "your profile is
     * frozen" rather than "you cannot add another".
     */
    it('lets somebody already over the limit keep editing, but not add more', async () => {
      const { user } = await onboardedWith('lang-legacy@example.com', 'langlegacy', [
        { code: 'en', level: 'intermediate', priority: 1 },
      ])
      const over = [
        { code: 'en', level: 'intermediate', priority: 1 },
        { code: 'de', level: 'beginner', priority: 2 },
        { code: 'fr', level: 'beginner', priority: 3 },
      ]
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { learning: over } })

      // Changing a level, at the same length: allowed.
      const edited = await patch(user, {
        learning: [{ ...over[0]!, level: 'fluent' }, over[1]!, over[2]!],
      })
      expect(edited.statusCode, edited.body).toBe(200)

      // Removing one, still over the limit: allowed.
      const removed = await patch(user, { learning: [over[0]!, over[1]!] })
      expect(removed.statusCode, removed.body).toBe(200)

      // Going back up past where they were: refused.
      const grown = await patch(user, { learning: over })
      expect(grown.statusCode).toBe(403)
    })

    it('gives a paid tier its wider allowance', async () => {
      const { user } = await onboardedWith('lang-paid@example.com', 'langpaid', [
        { code: 'en', level: 'intermediate', priority: 1 },
      ])
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: user.userId },
          { $set: { entitlement: { tier: 'pro_plus', updatedAt: new Date() } } },
        )

      const response = await patch(user, {
        learning: [
          { code: 'en', level: 'intermediate', priority: 1 },
          { code: 'de', level: 'beginner', priority: 2 },
          { code: 'fr', level: 'beginner', priority: 3 },
        ],
      })
      expect(response.statusCode, response.body).toBe(200)
    })
  })

  describe('terms acceptance', () => {
    /**
     * Recorded by the server at account creation, not asserted by the client.
     * The tickbox is what makes somebody read the sentence; it cannot also be
     * the evidence, because a client that never rendered the screen could send
     * the same flag.
     */
    it('stamps the accepted version on every new account', async () => {
      const user = await newUser('terms-stamp@example.com')

      const record = await handle.db
        .collection<{ _id: ObjectId; terms?: { acceptedAt: Date; version: string } }>(
          COLLECTIONS.user,
        )
        .findOne({ _id: new ObjectId(user.userId) })

      expect(record?.terms?.version).toBe(CURRENT_TERMS_VERSION)
      expect(record?.terms?.acceptedAt.getTime()).toBeGreaterThan(Date.now() - 60_000)
    })
  })

  describe('hiding your online status', () => {
    async function onboarded(email: string, userHandle: string): Promise<SignedUpUser> {
      const user = await newUser(email)
      const created = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: userHandle }),
      })
      if (created.statusCode !== 201) throw new Error(`onboarding failed: ${created.body}`)
      return user
    }

    const makePro = (userId: string) =>
      handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: userId },
          { $set: { entitlement: { tier: 'pro', updatedAt: new Date() } } },
        )

    const patchPrivacy = (user: SignedUpUser, privacy: Record<string, boolean>) =>
      app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: { privacy },
      })

    /**
     * Free, and it has to be: the app renders `lastActiveAt` as "last seen",
     * which publishes something about a dormant user that nothing had ever
     * drawn before. Charging for the switch that turns off a disclosure we
     * have just started making is not defensible, so this refused with a 403
     * until presence shipped.
     */
    it('lets a free account turn it on', async () => {
      const free = await onboarded('hide-free@example.com', 'hidefree')
      const response = await patchPrivacy(free, { hideOnlineStatus: true })
      expect(response.statusCode, response.body).toBe(200)

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: free.userId })
      expect(profile?.privacy.hideOnlineStatus).toBe(true)
    })

    /**
     * Never re-checked at read time — unlike incognito. That mattered while the
     * flag was paid (a lapsed subscription would have silently exposed someone
     * as online) and it still holds now that it is free: a privacy setting must
     * not change under someone because of anything except their own tap.
     */
    it('always allows turning it off, on any tier', async () => {
      const user = await onboarded('hide-off@example.com', 'hideoff')
      const response = await patchPrivacy(user, { hideOnlineStatus: false })
      expect(response.statusCode, response.body).toBe(200)
    })

    it('reports a hidden user as offline, and sends no lastActiveAt at all', async () => {
      const hider = await onboarded('hide-pro@example.com', 'hidepro')
      const viewer = await onboarded('hide-viewer@example.com', 'hideviewer')
      // Still exercised on a paid tier: the flag is free now, and the point is
      // that the tier does not enter into it either way.
      await makePro(hider.userId)
      expect((await patchPrivacy(hider, { hideOnlineStatus: true })).statusCode).toBe(200)

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/hidepro',
        headers: { cookie: viewer.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{ isOnline: boolean; lastActiveAt?: string }>()
      expect(body.isOnline).toBe(false)
      // Omitted, not stale: a fresh timestamp beside `isOnline: false` lets
      // any client recompute the truth in one subtraction.
      expect(body).not.toHaveProperty('lastActiveAt')

      // Still recorded server-side; only the answer to other people changes.
      const stored = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: hider.userId })
      expect(stored?.stats.lastActiveAt).toBeInstanceOf(Date)
    })

    /**
     * `$set: { privacy: {...} }` replaces the sub-document, so a request
     * naming one flag used to clear the other. Latent while `privacy` had one
     * field; a live bug the moment it has two.
     */
    it('does not clear the other privacy flag when one is updated', async () => {
      const user = await onboarded('hide-partial@example.com', 'hidepartial')
      await makePro(user.userId)

      expect((await patchPrivacy(user, { hideOnlineStatus: true })).statusCode).toBe(200)
      expect((await patchPrivacy(user, { incognito: true })).statusCode).toBe(200)

      const after = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(after?.privacy).toMatchObject({ incognito: true, hideOnlineStatus: true })

      expect((await patchPrivacy(user, { incognito: false })).statusCode).toBe(200)
      const later = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(later?.privacy).toMatchObject({ incognito: false, hideOnlineStatus: true })
    })

    /** The two flags are independent; incognito never touched presence. */
    it('leaves online status alone when only incognito is on', async () => {
      const hider = await onboarded('incog-only@example.com', 'incogonly')
      const viewer = await onboarded('incog-viewer@example.com', 'incogviewer')
      await makePro(hider.userId)
      await patchPrivacy(hider, { incognito: true })

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/incogonly',
        headers: { cookie: viewer.cookie },
      })
      expect(response.json<{ lastActiveAt?: string }>().lastActiveAt).toBeDefined()
    })
  })

  describe('the city, which nobody types', () => {
    /** Upserted, so each test can ask for it without minding who ran first. */
    async function seedCities(): Promise<void> {
      await handle.db.collection(COLLECTIONS.cities).updateOne(
        { _id: 'geonames:745044' as unknown as never },
        {
          $set: {
            name: 'Istanbul',
            asciiName: 'Istanbul',
            countryCode: 'TR',
            population: 15_000_000,
            location: { type: 'Point', coordinates: [28.9784, 41.0082] },
          },
        },
        { upsert: true },
      )
    }

    /** `newUser` only signs up; a location attaches to a profile. */
    async function onboardedUser(email: string, handleName: string): Promise<SignedUpUser> {
      const user = await newUser(email)
      const response = await app.inject({
        method: 'POST',
        url: '/profiles',
        headers: { cookie: user.cookie },
        payload: onboardingBody({ handle: handleName }),
      })
      if (response.statusCode !== 201) {
        throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
      }
      return user
    }

    async function profileOf(userId: string) {
      return handle.db
        .collection<{ _id: string; cityId?: string; cityName?: string }>(COLLECTIONS.profiles)
        .findOne({ _id: userId })
    }

    it('is worked out from the location, not asked for', async () => {
      await seedCities()
      const user = await onboardedUser('city-derive@example.com', 'cityderive')
      const response = await app.inject({
        method: 'POST',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
        payload: { lat: 41.01, lng: 28.98 },
      })
      expect(response.statusCode).toBe(200)

      const stored = await profileOf(user.userId)
      expect(stored?.cityId).toBe('geonames:745044')
      expect(stored?.cityName).toBe('Istanbul')
    })

    /** The sea. A city hundreds of kilometres away is not where somebody is. */
    it('is left unset when the coordinate is nowhere near a city', async () => {
      await seedCities()
      const user = await onboardedUser('city-nowhere@example.com', 'citynowhere')
      await app.inject({
        method: 'POST',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
        payload: { lat: 30, lng: -30 },
      })
      const stored = await profileOf(user.userId)
      expect(stored?.cityId).toBeUndefined()
      expect(stored?.cityName).toBeUndefined()
    })

    it('goes when the location goes', async () => {
      await seedCities()
      const user = await onboardedUser('city-cleared@example.com', 'citycleared')
      await app.inject({
        method: 'POST',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
        payload: { lat: 41.01, lng: 28.98 },
      })
      expect((await profileOf(user.userId))?.cityId).toBe('geonames:745044')

      const cleared = await app.inject({
        method: 'DELETE',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
      })
      expect(cleared.statusCode).toBe(200)
      expect((await profileOf(user.userId))?.cityId).toBeUndefined()
    })

    it('cannot be set by a client, because there is no longer a field for it', async () => {
      const user = await onboardedUser('city-not-settable@example.com', 'citynotset')
      const response = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: { city: 'Somewhere' },
      })
      // Unknown keys are stripped rather than refused, so the tell is the
      // absence of the field afterwards.
      expect(response.statusCode).toBe(200)
      expect((await profileOf(user.userId)) as { city?: string }).not.toHaveProperty('city')
    })

    describe('showing it', () => {
      async function publicViewOf(target: SignedUpUser, viewer: SignedUpUser) {
        const response = await app.inject({
          method: 'GET',
          url: `/profiles/${target.userId}`,
          headers: { cookie: viewer.cookie },
        })
        expect(response.statusCode).toBe(200)
        return response.json<{ city?: string }>()
      }

      it('is on a public profile by default', async () => {
        await seedCities()
        const them = await onboardedUser('city-shown@example.com', 'cityshown')
        const viewer = await onboardedUser('city-shown-viewer@example.com', 'cityshownv')
        await app.inject({
          method: 'POST',
          url: '/profiles/me/location',
          headers: { cookie: them.cookie },
          payload: { lat: 41.01, lng: 28.98 },
        })
        expect((await publicViewOf(them, viewer)).city).toBe('Istanbul')
      })

      /**
       * The switch this feature exists behind: sharing a location to find
       * people nearby is not agreeing to name the place you live.
       */
      it('is withheld when the switch is on', async () => {
        await seedCities()
        const them = await onboardedUser('city-hidden@example.com', 'cityhidden')
        const viewer = await onboardedUser('city-hidden-viewer@example.com', 'cityhiddenv')
        await app.inject({
          method: 'POST',
          url: '/profiles/me/location',
          headers: { cookie: them.cookie },
          payload: { lat: 41.01, lng: 28.98 },
        })
        await app.inject({
          method: 'PATCH',
          url: '/profiles/me',
          headers: { cookie: them.cookie },
          payload: { privacy: { hideCity: true } },
        })
        expect((await publicViewOf(them, viewer)).city).toBeUndefined()
      })
    })
  })
})
