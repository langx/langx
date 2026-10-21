import { DEFAULT_AVATAR_STYLE, defaultAvatarRev, type DefaultAvatar } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

/*
 * The Notionists answers of the old route, kept for as long as switching
 * `DEFAULT_AVATAR_STYLE` back is the way to undo v3; and the redirect that
 * replaces them while it is `v3`.
 */
const notionistsOnly = it.runIf(DEFAULT_AVATAR_STYLE === 'notionists')
const v3Only = it.runIf(DEFAULT_AVATAR_STYLE === 'v3')

/** Two ids that exist only as strings, for the account-enumeration cases. */
const UNKNOWN = 'a1b2c3d4e5f6a1b2c3d4e5f6'
const OTHER_UNKNOWN = 'f6e5d4c3b2a1f6e5d4c3b2a1'

describe('generated avatars', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let userId: string
  let cookie: string

  function draw(seed: string, headers: Record<string, string> = {}) {
    return app.inject({ method: 'GET', url: `/public/avatar/${seed}`, headers })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_avatar_test')
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_avatar_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      LEGACY_EMAIL_HASH_SALT: 'test-legacy-salt',
    })

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

    const user = await signUpAndSignIn(app, emailSender, {
      email: 'face@example.com',
      password: PASSWORD,
      name: 'Face Haver',
    })
    userId = user.userId
    cookie = user.cookie
    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: 'facehaver',
        displayName: 'Face Haver',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    expect(created.statusCode, created.body).toBe(201)
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  notionistsOnly('draws an SVG a browser on another origin is allowed to load', async () => {
    const response = await draw(userId)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.headers['content-type']).toBe('image/svg+xml')
    // Without this the web build refuses the picture outright, server-side
    // invisible: curl says 200 and the browser draws nothing.
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin')
    expect(response.headers['cache-control']).toContain('max-age=604800')
    // Deliberately not immutable — the one gender disclosure can change it.
    expect(response.headers['cache-control']).not.toContain('immutable')
  })

  notionistsOnly('needs no session, like the QR of a public link', async () => {
    expect((await draw(userId)).statusCode).toBe(200)
  })

  notionistsOnly('is the same face every time, and a different face per account', async () => {
    const first = await draw(userId)
    const again = await draw(userId)
    expect(again.body).toBe(first.body)
    expect((await draw(UNKNOWN)).body).not.toBe(first.body)
  })

  v3Only('sends a build from before v3 to the v3 face, for every id', async () => {
    for (const seed of [userId, UNKNOWN]) {
      const response = await draw(seed)
      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe(`/public/avatar/v3/${seed}?s=160&c=flat`)
      expect(response.headers['cache-control']).toBe('public, max-age=86400')
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin')
      const followed = await app.inject({ method: 'GET', url: response.headers.location ?? '' })
      expect(followed.statusCode).toBe(200)
      expect(followed.headers['content-type']).toBe('image/png')
    }
  })

  it('refuses anything that is not an account id', async () => {
    // Otherwise this is a free SVG generator for any string anybody posts.
    expect((await draw('not-an-id')).statusCode).toBe(400)
    expect((await draw('A1B2C3D4E5F6A1B2C3D4E5F6')).statusCode).toBe(400)
  })

  notionistsOnly('draws a face for an id nobody holds, rather than a 404', async () => {
    // A 404 here would answer "does this account exist", one id at a time.
    const response = await draw(UNKNOWN)
    expect(response.statusCode).toBe(200)
    expect((await draw(UNKNOWN)).body).toBe(response.body)
    expect((await draw(OTHER_UNKNOWN)).body).not.toBe(response.body)
  })

  notionistsOnly(
    'steers on a stated gender, and stays neutral on the two private ones',
    async () => {
      /*
       * A chosen id, inserted directly. The beard is a *probability*, so for
       * most seeds male and female draw the same face and an assertion on a
       * randomly issued account id would pass or fail by luck. This one is known
       * to fall on the side where the option shows.
       */
      const steered = '0da741eb852fc9630da741eb'
      await handle.db
        .collection(COLLECTIONS.profiles)
        .insertOne({ _id: steered, gender: 'undisclosed' } as never)

      const undisclosed = (await draw(steered)).body

      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: steered } as never, { $set: { gender: 'male' } })
      const male = (await draw(steered)).body

      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: steered } as never, { $set: { gender: 'female' } })
      const female = (await draw(steered)).body

      expect(male).not.toBe(female)
      // The steering is real rather than an option name that lands nowhere.
      expect(male).not.toBe(undisclosed)

      /*
       * And the private answers really are neutral: an account that declined to
       * say is drawn from the same pool as one that was never asked, so the
       * picture discloses nothing the account withheld.
       */
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: steered } as never, { $set: { gender: 'other' } })
      expect((await draw(steered)).body).toBe(undisclosed)

      await handle.db.collection(COLLECTIONS.profiles).deleteOne({ _id: steered } as never)
      // With no profile at all, the same id draws the same neutral face.
      expect((await draw(steered)).body).toBe(undisclosed)
    },
  )
  describe('v3 drawn faces', () => {
    function drawV3(seed: string, query: string) {
      return app.inject({ method: 'GET', url: `/public/avatar/v3/${seed}?${query}` })
    }

    it('serves a PNG a browser on another origin may load, cached for a day', async () => {
      const response = await drawV3(userId, 's=96')
      expect(response.statusCode, response.body).toBe(200)
      expect(response.headers['content-type']).toBe('image/png')
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin')
      expect(response.headers['cache-control']).toBe('public, max-age=86400')
      expect(response.rawPayload.readUInt32BE(16)).toBe(96)
    })

    it('is immutable when the URL names the face', async () => {
      const response = await drawV3(userId, 's=48&v=1-W07-3')
      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toBe('public, max-age=86400, immutable')
      // The named face, not the account's: the URL alone decides the bytes.
      expect((await drawV3(UNKNOWN, 's=48&v=1-W07-3')).rawPayload).toEqual(response.rawPayload)
    })

    it('ignores a v it cannot read rather than refusing the picture', async () => {
      const response = await drawV3(userId, 's=48&v=9-Z99-9')
      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).not.toContain('immutable')
      expect(response.rawPayload).toEqual((await drawV3(userId, 's=48')).rawPayload)
    })

    it('draws a face for an id nobody holds, rather than a 404', async () => {
      const response = await drawV3(UNKNOWN, 's=48')
      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toBe('image/png')
    })

    it('renders only the four sizes and the three cuts', async () => {
      expect((await drawV3(userId, 's=50')).statusCode).toBe(400)
      expect((await drawV3(userId, '')).statusCode).toBe(400)
      expect((await drawV3(userId, 's=160&c=huge')).statusCode).toBe(400)
      expect((await drawV3('not-an-id', 's=48')).statusCode).toBe(400)
      for (const size of [48, 96, 160, 480]) {
        expect((await drawV3(userId, `s=${size}&c=small`)).statusCode).toBe(200)
      }
    })

    it('draws the face stored at sign-up, the same one its v names', async () => {
      const row = await handle.db
        .collection<{ _id: string; defaultAvatar?: DefaultAvatar }>(COLLECTIONS.profiles)
        .findOne({ _id: userId })
      // Created with gender `undisclosed`, so the neutral pool.
      expect(row?.defaultAvatar?.pool).toBe('N')
      const rev = defaultAvatarRev(row?.defaultAvatar ?? { pool: 'N', index: 1, ground: 0 })
      const looked = await drawV3(userId, 's=96')
      expect(looked.rawPayload).toEqual((await drawV3(UNKNOWN, `s=96&v=${rev}`)).rawPayload)
    })

    it('lets the owner pick a face, from any pool, and serves it at once', async () => {
      const pick = (
        payload: Record<string, unknown>,
        headers: Record<string, string> = { cookie },
      ) => app.inject({ method: 'POST', url: '/profiles/me/default-avatar', headers, payload })

      expect((await pick({ pool: 'W', index: 3 }, {})).statusCode).toBe(401)
      for (const bad of [{}, { pool: 'W' }, { pool: 'X', index: 3 }, { pool: 'M', index: 0 }]) {
        expect((await pick(bad)).statusCode, JSON.stringify(bad)).toBe(400)
      }
      expect((await pick({ pool: 'M', index: 49 })).statusCode).toBe(400)
      expect((await pick({ pool: 'M', index: 4, ground: 6 })).statusCode).toBe(400)

      const response = await pick({ pool: 'M', index: 12 })
      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{ defaultAvatar: DefaultAvatar; defaultAvatarRev: string }>()
      expect(body.defaultAvatar).toMatchObject({ pool: 'M', index: 12, picked: true })
      expect(body.defaultAvatarRev).toMatch(/^1-M12-\d$/)

      const served = await drawV3(userId, 's=48')
      expect(served.rawPayload).toEqual(
        (await drawV3(UNKNOWN, `s=48&v=${body.defaultAvatarRev}`)).rawPayload,
      )
    })

    notionistsOnly('leaves the Notionists route as it was', async () => {
      const response = await draw(userId)
      expect(response.headers['content-type']).toBe('image/svg+xml')
    })
  })
})
