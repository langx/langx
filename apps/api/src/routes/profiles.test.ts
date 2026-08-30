import { PLAN_LIMITS } from '@langx/shared'
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
   * The matrix is eight booleans and the settings screen flips one at a time.
   * Writing `settings` whole — which is what the old single-boolean shape
   * allowed — would clear the other seven on every toggle.
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
      payload: { settings: { notifications: { streak: { push: false } } } },
    })

    expect(updated.statusCode, updated.body).toBe(200)
    const settings = updated.json<{
      settings: { discoverable: boolean; notifications: Record<string, Record<string, boolean>> }
    }>().settings
    expect(settings.notifications.streak).toEqual({ push: false, email: false })
    expect(settings.notifications.messages).toEqual({ push: true, email: false })
    expect(settings.notifications.promotions).toEqual({ push: false, email: false })
    expect(settings.discoverable).toBe(true)
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

    it('refuses to turn it on without a paid tier, naming the feature', async () => {
      const free = await onboarded('hide-free@example.com', 'hidefree')
      const response = await patchPrivacy(free, { hideOnlineStatus: true })

      expect(response.statusCode).toBe(403)
      expect(response.json<{ code: string; feature: string }>()).toMatchObject({
        code: 'UPGRADE_REQUIRED',
        feature: 'hideOnlineStatus',
      })
    })

    /**
     * Gated on write, not on read — unlike incognito. Re-checking at read time
     * would make a lapsed subscription silently expose someone as online, so
     * turning it *off* has to work on any tier or people get stuck hidden.
     */
    it('always allows turning it off, on any tier', async () => {
      const user = await onboarded('hide-off@example.com', 'hideoff')
      const response = await patchPrivacy(user, { hideOnlineStatus: false })
      expect(response.statusCode, response.body).toBe(200)
    })

    it('reports a hidden Pro user as offline, and sends no lastActiveAt at all', async () => {
      const hider = await onboarded('hide-pro@example.com', 'hidepro')
      const viewer = await onboarded('hide-viewer@example.com', 'hideviewer')
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
})
