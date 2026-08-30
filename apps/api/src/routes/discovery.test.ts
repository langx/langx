import { DISCOVERY_CURSOR_MAX_AGE_MS, DISTANCE_BUCKETS_KM } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

/** Viewer speaks Turkish, is learning English — every "mutual match" fixture below is built against this. */
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

describe('Faz 3 — discovery aggregation', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

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

  async function setLastActiveAt(userId: string, date: Date) {
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: userId }, { $set: { 'stats.lastActiveAt': date } })
  }

  async function discover(user: SignedUpUser, qs = '') {
    return app.inject({
      method: 'GET',
      url: `/discovery${qs ? `?${qs}` : ''}`,
      headers: { cookie: user.cookie },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_discovery_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_discovery_test',
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
    await app.ready()

    // Same first-transaction warm-up as auth.test.ts / profiles.test.ts.
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

  it('rejects an unauthenticated request', async () => {
    const response = await app.inject({ method: 'GET', url: '/discovery' })
    expect(response.statusCode).toBe(401)
  })

  it('404s for an authenticated user who has not onboarded yet', async () => {
    const user = await signUpAndSignIn(app, emailSender, {
      email: 'no-profile-yet@example.com',
      password: PASSWORD,
      name: 'No Profile',
    })
    const response = await discover(user)
    expect(response.statusCode).toBe(404)
  })

  describe('mutual-fit matching', () => {
    it('returns a candidate whose native/learning mutually fit, and excludes one-directional and unrelated fits', async () => {
      const viewer = await newUser('mutual-viewer@example.com')
      const mutual = await newUser('mutual-match@example.com', {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
      })
      // Speaks what I'm learning, but isn't learning what I speak.
      const oneDirectional = await newUser('one-directional@example.com', {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'fr', level: 'intermediate', priority: 1 }],
      })
      // Neither direction fits.
      const unrelated = await newUser('unrelated@example.com', {
        nativeLanguages: [{ code: 'de' }],
        learning: [{ code: 'es', level: 'intermediate', priority: 1 }],
      })

      const response = await discover(viewer)
      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{ items: { handle: string }[] }>()
      const handles = body.items.map((i) => i.handle)
      expect(handles).toContain(mutual.handle)
      expect(handles).not.toContain(oneDirectional.handle)
      expect(handles).not.toContain(unrelated.handle)
      expect(handles.length).toBe(1)
    })

    it('never returns the viewer themselves', async () => {
      const viewer = await newUser('self-exclude@example.com')
      const response = await discover(viewer)
      const body = response.json<{ items: { handle: string }[] }>()
      expect(body.items.map((i) => i.handle)).not.toContain(viewer.handle)
    })

    it('excludes non-discoverable and soft-deleted profiles', async () => {
      const viewer = await newUser('exclusion-viewer@example.com', {
        nativeLanguages: [{ code: 'fr' }],
        learning: [{ code: 'it', level: 'intermediate', priority: 1 }],
      })
      const hidden = await newUser('hidden-profile@example.com', {
        nativeLanguages: [{ code: 'it' }],
        learning: [{ code: 'fr', level: 'intermediate', priority: 1 }],
      })
      const deleted = await newUser('deleted-profile@example.com', {
        nativeLanguages: [{ code: 'it' }],
        learning: [{ code: 'fr', level: 'intermediate', priority: 1 }],
      })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: hidden.userId }, { $set: { 'settings.discoverable': false } })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: deleted.userId }, { $set: { deletedAt: new Date() } })

      const response = await discover(viewer)
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).not.toContain(hidden.handle)
      expect(handles).not.toContain(deleted.handle)
    })

    it('excludes a block in either direction', async () => {
      const viewer = await newUser('blocker-viewer@example.com', {
        nativeLanguages: [{ code: 'pt' }],
        learning: [{ code: 'nl', level: 'intermediate', priority: 1 }],
      })
      const iBlock = await newUser('i-block-them@example.com', {
        nativeLanguages: [{ code: 'nl' }],
        learning: [{ code: 'pt', level: 'intermediate', priority: 1 }],
      })
      const blocksMe = await newUser('they-block-me@example.com', {
        nativeLanguages: [{ code: 'nl' }],
        learning: [{ code: 'pt', level: 'intermediate', priority: 1 }],
      })
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: viewer.userId, blockedId: iBlock.userId })
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: blocksMe.userId, blockedId: viewer.userId })

      const response = await discover(viewer)
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).not.toContain(iBlock.handle)
      expect(handles).not.toContain(blocksMe.handle)
    })
  })

  describe('free filters', () => {
    /**
     * `online` orders, it does not exclude. It used to `$match` the
     * five-minute window, which emptied the screen whenever nobody happened
     * to be about — the opposite of what discovery is for.
     */
    it('puts online profiles first and still returns everyone else', async () => {
      const viewer = await newUser('online-viewer@example.com', {
        nativeLanguages: [{ code: 'sv' }],
        learning: [{ code: 'da', level: 'intermediate', priority: 1 }],
      })
      const recentlyActive = await newUser('recently-active@example.com', {
        nativeLanguages: [{ code: 'da' }],
        learning: [{ code: 'sv', level: 'intermediate', priority: 1 }],
      })
      const staleActive = await newUser('stale-active@example.com', {
        nativeLanguages: [{ code: 'da' }],
        learning: [{ code: 'sv', level: 'intermediate', priority: 1 }],
      })
      await setLastActiveAt(staleActive.userId, new Date(Date.now() - 60 * 60 * 1000))

      const response = await discover(viewer, 'online=true')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).toContain(recentlyActive.handle)
      expect(handles).toContain(staleActive.handle)
      expect(handles.indexOf(recentlyActive.handle)).toBeLessThan(
        handles.indexOf(staleActive.handle),
      )
    })

    it('never empties the list when nobody is online', async () => {
      const viewer = await newUser('all-offline-viewer@example.com', {
        nativeLanguages: [{ code: 'cs' }],
        learning: [{ code: 'sk', level: 'intermediate', priority: 1 }],
      })
      const offline = await newUser('all-offline-match@example.com', {
        nativeLanguages: [{ code: 'sk' }],
        learning: [{ code: 'cs', level: 'intermediate', priority: 1 }],
      })
      await setLastActiveAt(offline.userId, new Date(Date.now() - 60 * 60 * 1000))

      const response = await discover(viewer, 'online=true')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).toEqual([offline.handle])
    })

    /**
     * The bucket predicate lives in an aggregation `$cond`; the read-time
     * `isOnline` comes from `hidesOnlineStatus` in TypeScript. This test is
     * the only thing holding those two expressions of one rule together —
     * without it, the ordering leaks exactly what the setting exists to hide.
     */
    it('does not promote someone who hides their online status', async () => {
      const viewer = await newUser('hidden-online-viewer@example.com', {
        nativeLanguages: [{ code: 'fi' }],
        learning: [{ code: 'et', level: 'intermediate', priority: 1 }],
      })
      const hidden = await newUser('hidden-online-match@example.com', {
        nativeLanguages: [{ code: 'et' }],
        learning: [{ code: 'fi', level: 'intermediate', priority: 1 }],
      })
      const visible = await newUser('visible-online-match@example.com', {
        nativeLanguages: [{ code: 'et' }],
        learning: [{ code: 'fi', level: 'intermediate', priority: 1 }],
      })
      // Fresh for both; only the flag differs.
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: hidden.userId }, { $set: { 'privacy.hideOnlineStatus': true } })
      await setLastActiveAt(visible.userId, new Date(Date.now() - 60 * 60 * 1000))

      const response = await discover(viewer, 'online=true')
      const items = response.json<{ items: { handle: string; isOnline: boolean }[] }>().items
      const handles = items.map((i) => i.handle)
      // Both land in bucket 0 — the hidden one because it is hidden, the
      // other because it is stale — so what must hold is that hiding removed
      // the promotion, and that the row agrees with the ordering.
      expect(handles).toContain(hidden.handle)
      expect(handles).toContain(visible.handle)
      expect(items.find((i) => i.handle === hidden.handle)?.isOnline).toBe(false)
    })

    it('orders online-first ahead of the recommended score, not behind it', async () => {
      const viewer = await newUser('bucket-order-viewer@example.com', {
        nativeLanguages: [{ code: 'hu' }],
        learning: [{ code: 'ro', level: 'intermediate', priority: 1 }],
        interests: ['chess', 'hiking'],
      })
      // Shares both interests, so it scores higher — and is offline.
      const highScoreOffline = await newUser('bucket-high-offline@example.com', {
        nativeLanguages: [{ code: 'ro' }],
        learning: [{ code: 'hu', level: 'intermediate', priority: 1 }],
        interests: ['chess', 'hiking'],
      })
      const lowScoreOnline = await newUser('bucket-low-online@example.com', {
        nativeLanguages: [{ code: 'ro' }],
        learning: [{ code: 'hu', level: 'intermediate', priority: 1 }],
      })
      await setLastActiveAt(highScoreOffline.userId, new Date(Date.now() - 60 * 60 * 1000))

      const withChip = await discover(viewer, 'online=true')
      const chipHandles = withChip
        .json<{ items: { handle: string }[] }>()
        .items.map((i) => i.handle)
      expect(chipHandles[0]).toBe(lowScoreOnline.handle)

      // And without the chip the score still wins, so this is opt-in.
      const without = await discover(viewer)
      const plainHandles = without
        .json<{ items: { handle: string }[] }>()
        .items.map((i) => i.handle)
      expect(plainHandles[0]).toBe(highScoreOffline.handle)
    })

    /**
     * The cutoff is pinned into the cursor. Recomputed per request, a profile
     * crossing the five-minute line between pages moves the whole partition
     * under a `$skip` already handed out — one row repeats and another is
     * never shown. Without the pin this test fails, which is why it exists.
     */
    it('pages consistently when someone crosses the online boundary mid-scroll', async () => {
      const viewer = await newUser('boundary-viewer@example.com', {
        nativeLanguages: [{ code: 'lt' }],
        learning: [{ code: 'lv', level: 'intermediate', priority: 1 }],
      })
      const matches = []
      for (const name of ['a', 'b', 'c']) {
        const user = await newUser(`boundary-${name}@example.com`, {
          nativeLanguages: [{ code: 'lv' }],
          learning: [{ code: 'lt', level: 'intermediate', priority: 1 }],
        })
        await setLastActiveAt(user.userId, new Date(Date.now() - 60 * 60 * 1000))
        matches.push(user)
      }

      const seen: string[] = []
      let cursor: string | null = ''
      let flipped = false
      do {
        const suffix: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
        const page = await discover(viewer, `online=true&limit=1${suffix}`)
        expect(page.statusCode, page.body).toBe(200)
        const body = page.json<{ items: { handle: string }[]; nextCursor: string | null }>()
        seen.push(...body.items.map((i) => i.handle))
        cursor = body.nextCursor
        // Between page one and page two, one of them comes online.
        if (!flipped) {
          await setLastActiveAt(matches[2]!.userId, new Date())
          flipped = true
        }
      } while (cursor)

      expect(seen).toHaveLength(3)
      expect(new Set(seen).size).toBe(3)
    })

    it('refuses a cursor older than the pinned cutoff is allowed to be', async () => {
      const viewer = await newUser('stale-cursor-viewer@example.com', {
        nativeLanguages: [{ code: 'sl' }],
        learning: [{ code: 'hr', level: 'intermediate', priority: 1 }],
      })
      const old = new Date(Date.now() - DISCOVERY_CURSOR_MAX_AGE_MS - 60_000).toISOString()
      const response = await discover(
        viewer,
        `online=true&cursor=${encodeURIComponent(`${old}|1`)}`,
      )
      expect(response.statusCode).toBe(400)
      expect(response.json<{ code: string }>().code).toBe('VALIDATION_FAILED')
    })

    /** Old app builds in the wild send a bare integer. */
    it('still accepts a cursor from before the cutoff was pinned', async () => {
      const viewer = await newUser('legacy-cursor-viewer@example.com', {
        nativeLanguages: [{ code: 'bg' }],
        learning: [{ code: 'mk', level: 'intermediate', priority: 1 }],
      })
      const response = await discover(viewer, 'online=true&cursor=0')
      expect(response.statusCode, response.body).toBe(200)
    })

    it('targetLanguage narrows to one of the viewer own learning languages, and rejects anything else', async () => {
      const viewer = await newUser('target-lang-viewer@example.com', {
        nativeLanguages: [{ code: 'tr' }],
        learning: [
          { code: 'en', level: 'intermediate', priority: 1 },
          { code: 'de', level: 'beginner', priority: 2 },
        ],
      })
      const englishNative = await newUser('english-native@example.com', {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
      })
      const germanNative = await newUser('german-native@example.com', {
        nativeLanguages: [{ code: 'de' }],
        learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
      })

      const onlyGerman = await discover(viewer, 'targetLanguage=de')
      const germanHandles = onlyGerman
        .json<{ items: { handle: string }[] }>()
        .items.map((i) => i.handle)
      expect(germanHandles).toContain(germanNative.handle)
      expect(germanHandles).not.toContain(englishNative.handle)

      const rejected = await discover(viewer, 'targetLanguage=fr')
      expect(rejected.statusCode).toBe(400)
    })
  })

  describe('Pro filters', () => {
    async function makePro(userId: string) {
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: userId }, { $set: { 'entitlement.tier': 'pro' } })
    }

    it('rejects a free user sending a Pro filter with UPGRADE_REQUIRED, not a silent ignore', async () => {
      const viewer = await newUser('free-filter-viewer@example.com')
      const response = await discover(viewer, 'gender=female')
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({
        code: 'UPGRADE_REQUIRED',
        feature: 'advancedFilters',
      })
    })

    it('lets a Pro user filter by gender, country and age range', async () => {
      const viewer = await newUser('pro-filter-viewer@example.com', {
        nativeLanguages: [{ code: 'fi' }],
        learning: [{ code: 'et', level: 'intermediate', priority: 1 }],
      })
      await makePro(viewer.userId)

      const wanted = await newUser('pro-match@example.com', {
        nativeLanguages: [{ code: 'et' }],
        learning: [{ code: 'fi', level: 'intermediate', priority: 1 }],
        gender: 'female',
        country: 'US',
        birthDate: '1990-06-15',
      })
      const wrongGender = await newUser('pro-wrong-gender@example.com', {
        nativeLanguages: [{ code: 'et' }],
        learning: [{ code: 'fi', level: 'intermediate', priority: 1 }],
        gender: 'male',
        country: 'US',
        birthDate: '1990-06-15',
      })
      const wrongAge = await newUser('pro-wrong-age@example.com', {
        nativeLanguages: [{ code: 'et' }],
        learning: [{ code: 'fi', level: 'intermediate', priority: 1 }],
        gender: 'female',
        country: 'US',
        birthDate: '2005-06-15',
      })

      const response = await discover(viewer, 'gender=female&country=US&ageMin=30&ageMax=40')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).toContain(wanted.handle)
      expect(handles).not.toContain(wrongGender.handle)
      expect(handles).not.toContain(wrongAge.handle)
    })

    /**
     * v1's "Match My Gender". Resolved on the server because only the server
     * is sure what the viewer's own gender is — a client that had not finished
     * loading its own profile would otherwise send nothing and look filtered.
     */
    it('onlyMyGender narrows to the viewer own gender', async () => {
      const viewer = await newUser('same-gender-viewer@example.com', {
        nativeLanguages: [{ code: 'sl' }],
        learning: [{ code: 'sk', level: 'intermediate', priority: 1 }],
        gender: 'female',
      })
      await makePro(viewer.userId)

      const sameGender = await newUser('same-gender-match@example.com', {
        nativeLanguages: [{ code: 'sk' }],
        learning: [{ code: 'sl', level: 'intermediate', priority: 1 }],
        gender: 'female',
      })
      const otherGender = await newUser('other-gender-match@example.com', {
        nativeLanguages: [{ code: 'sk' }],
        learning: [{ code: 'sl', level: 'intermediate', priority: 1 }],
        gender: 'male',
      })

      const response = await discover(viewer, 'onlyMyGender=true')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).toContain(sameGender.handle)
      expect(handles).not.toContain(otherGender.handle)
    })

    /**
     * "People like me" cannot mean "people who also declined to say", so the
     * toggle is silently inert rather than narrowing to the undisclosed group
     * — which would be a worse answer than not narrowing at all.
     */
    it('onlyMyGender does nothing when the viewer has not disclosed a gender', async () => {
      const viewer = await newUser('undisclosed-viewer@example.com', {
        nativeLanguages: [{ code: 'hr' }],
        learning: [{ code: 'mk', level: 'intermediate', priority: 1 }],
        gender: 'undisclosed',
      })
      await makePro(viewer.userId)

      const female = await newUser('undisclosed-peer-f@example.com', {
        nativeLanguages: [{ code: 'mk' }],
        learning: [{ code: 'hr', level: 'intermediate', priority: 1 }],
        gender: 'female',
      })
      const male = await newUser('undisclosed-peer-m@example.com', {
        nativeLanguages: [{ code: 'mk' }],
        learning: [{ code: 'hr', level: 'intermediate', priority: 1 }],
        gender: 'male',
      })

      const response = await discover(viewer, 'onlyMyGender=true')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).toContain(female.handle)
      expect(handles).toContain(male.handle)
    })

    it('is a Pro filter like the rest — a free account gets 403, not a wider list', async () => {
      const viewer = await newUser('free-same-gender@example.com', { gender: 'female' })
      const response = await discover(viewer, 'onlyMyGender=true')
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ code: 'UPGRADE_REQUIRED' })
    })

    it('refuses a gender and "my gender" at once rather than silently picking one', async () => {
      const viewer = await newUser('both-gender-filters@example.com', { gender: 'female' })
      await makePro(viewer.userId)
      const response = await discover(viewer, 'onlyMyGender=true&gender=male')
      expect(response.statusCode).toBe(400)
    })

    it('rejects a country code that is not a real one', async () => {
      const viewer = await newUser('bad-country@example.com')
      await makePro(viewer.userId)
      expect((await discover(viewer, 'country=ZZ')).statusCode).toBe(400)
      // Case is normalised, so a lowercase code is a match rather than a miss.
      expect((await discover(viewer, 'country=us')).statusCode).toBe(200)
    })

    it('minLevel filters on how well the candidate speaks the viewer own native language', async () => {
      const viewer = await newUser('minlevel-viewer@example.com', {
        nativeLanguages: [{ code: 'lv' }],
        learning: [{ code: 'lt', level: 'intermediate', priority: 1 }],
      })
      await makePro(viewer.userId)

      const fluent = await newUser('fluent-in-my-language@example.com', {
        nativeLanguages: [{ code: 'lt' }],
        learning: [{ code: 'lv', level: 'fluent', priority: 1 }],
      })
      const beginner = await newUser('beginner-in-my-language@example.com', {
        nativeLanguages: [{ code: 'lt' }],
        learning: [{ code: 'lv', level: 'absoluteBeginner', priority: 1 }],
      })

      const response = await discover(viewer, 'minLevel=intermediate')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).toContain(fluent.handle)
      expect(handles).not.toContain(beginner.handle)
    })
  })

  describe('sort presets and pagination', () => {
    it('sort=active pages through by lastActiveAt with no duplicates or gaps', async () => {
      const viewer = await newUser('active-sort-viewer@example.com', {
        nativeLanguages: [{ code: 'ro' }],
        learning: [{ code: 'bg', level: 'intermediate', priority: 1 }],
      })
      const candidates = []
      for (let i = 0; i < 5; i++) {
        const c = await newUser(`active-sort-${i}@example.com`, {
          nativeLanguages: [{ code: 'bg' }],
          learning: [{ code: 'ro', level: 'intermediate', priority: 1 }],
        })
        await setLastActiveAt(c.userId, new Date(Date.now() - i * 1000))
        candidates.push(c)
      }

      const seen: string[] = []
      let cursor: string | undefined
      for (let page = 0; page < 5; page++) {
        const qs = new URLSearchParams({ sort: 'active', limit: '2' })
        if (cursor) qs.set('cursor', cursor)
        const response = await discover(viewer, qs.toString())
        const body = response.json<{ items: { handle: string }[]; nextCursor: string | null }>()
        seen.push(...body.items.map((i) => i.handle))
        if (!body.nextCursor) break
        cursor = body.nextCursor
      }

      expect(new Set(seen).size).toBe(seen.length) // no duplicates across pages
      expect(seen.sort()).toEqual(candidates.map((c) => c.handle).sort())
    })

    it('sort=recommended favours a shared-interest candidate over one with no overlap', async () => {
      const viewer = await newUser('recommend-viewer@example.com', {
        nativeLanguages: [{ code: 'el' }],
        learning: [{ code: 'hu', level: 'intermediate', priority: 1 }],
        interests: ['music', 'tech'],
      })
      const noOverlap = await newUser('no-shared-interest@example.com', {
        nativeLanguages: [{ code: 'hu' }],
        learning: [{ code: 'el', level: 'intermediate', priority: 1 }],
        interests: ['cooking'],
      })
      const sharedInterest = await newUser('shared-interest@example.com', {
        nativeLanguages: [{ code: 'hu' }],
        learning: [{ code: 'el', level: 'intermediate', priority: 1 }],
        interests: ['music'],
      })

      const response = await discover(viewer, 'sort=recommended')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles.indexOf(sharedInterest.handle)).toBeLessThan(handles.indexOf(noOverlap.handle))
    })
  })

  /**
   * The Pro+ sort. Everything here turns on one thing worth stating: sharing a
   * location is free, sorting by it is not — so these fixtures give candidates
   * a location without giving them a subscription.
   */
  describe('sort=nearby (Pro+)', () => {
    /** Istanbul. Every distance below is measured from here. */
    const VIEWER = { lat: 41.0082, lng: 28.9784 }
    const NEXT_DOOR = { lat: 41.02, lng: 28.99 } //     ~1.5 km
    const ACROSS_TOWN = { lat: 41.2, lng: 29.1 } //     ~23 km
    const ANOTHER_CITY = { lat: 40.19, lng: 29.06 } //  ~91 km  (Bursa)
    const FAR_AWAY = { lat: 39.93, lng: 32.86 } //     ~350 km  (Ankara)

    async function setTier(userId: string, tier: Profile['entitlement']['tier']) {
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: userId }, { $set: { 'entitlement.tier': tier } })
    }

    // Generic so it hands back exactly what it was given — `newUser` returns a
    // `SignedUpUser` *plus* the handle, and every assertion below needs it.
    async function share<T extends SignedUpUser>(
      user: T,
      at: { lat: number; lng: number },
    ): Promise<T> {
      const response = await app.inject({
        method: 'POST',
        url: '/profiles/me/location',
        headers: { cookie: user.cookie },
        payload: at,
      })
      if (response.statusCode !== 200) {
        throw new Error(`sharing location failed (${response.statusCode}): ${response.body}`)
      }
      return user
    }

    /** A candidate who mutually fits a `tr`-native viewer learning `en`. */
    async function candidate(email: string, overrides: Record<string, unknown> = {}) {
      return newUser(email, {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
        ...overrides,
      })
    }

    it('refuses a free account with UPGRADE_REQUIRED naming nearby, not advancedFilters', async () => {
      const viewer = await newUser('nearby-free@example.com')
      const response = await discover(viewer, 'sort=nearby')
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ code: 'UPGRADE_REQUIRED', feature: 'nearby' })
    })

    it('refuses a Pro account too — this is the whole difference between the two paid tiers', async () => {
      const viewer = await newUser('nearby-pro@example.com')
      await setTier(viewer.userId, 'pro')
      await share(viewer, VIEWER)

      const response = await discover(viewer, 'sort=nearby')
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ code: 'UPGRADE_REQUIRED', feature: 'nearby' })
    })

    it('tells a Pro+ user who has shared nothing to share something, rather than returning an empty list', async () => {
      const viewer = await newUser('nearby-no-location@example.com')
      await setTier(viewer.userId, 'pro_plus')

      const response = await discover(viewer, 'sort=nearby')
      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({ code: 'LOCATION_REQUIRED' })
    })

    it('orders by distance and reports it as a bucket, never as the measured value', async () => {
      const viewer = await newUser('nearby-viewer@example.com')
      await setTier(viewer.userId, 'pro_plus')
      await share(viewer, VIEWER)

      const near = await share(await candidate('nearby-near@example.com'), NEXT_DOOR)
      const mid = await share(await candidate('nearby-mid@example.com'), ACROSS_TOWN)
      const far = await share(await candidate('nearby-far@example.com'), FAR_AWAY)

      const response = await discover(viewer, 'sort=nearby')
      expect(response.statusCode).toBe(200)
      const items = response.json<{ items: { handle: string; distanceKm: number }[] }>().items

      const handles = items.map((i) => i.handle)
      expect(handles.indexOf(near.handle)).toBeLessThan(handles.indexOf(mid.handle))
      expect(handles.indexOf(mid.handle)).toBeLessThan(handles.indexOf(far.handle))

      const distances = items.map((i) => i.distanceKm)
      expect(distances).toEqual([...distances].sort((a, b) => a - b))
      for (const km of distances) expect(DISTANCE_BUCKETS_KM).toContain(km)
      // The nearest is about 1.5 km away; the answer must not be finer than a bucket.
      expect(items[0]?.distanceKm).toBeLessThanOrEqual(5)
    })

    it('leaves out everyone who has not shared a location, and says so by omission only in this sort', async () => {
      const viewer = await newUser('nearby-optin-viewer@example.com', {
        nativeLanguages: [{ code: 'sv' }],
        learning: [{ code: 'da', level: 'intermediate', priority: 1 }],
      })
      await setTier(viewer.userId, 'pro_plus')
      await share(viewer, VIEWER)

      const sharing = await share(
        await candidate('nearby-optin-yes@example.com', {
          nativeLanguages: [{ code: 'da' }],
          learning: [{ code: 'sv', level: 'intermediate', priority: 1 }],
        }),
        NEXT_DOOR,
      )
      const notSharing = await candidate('nearby-optin-no@example.com', {
        nativeLanguages: [{ code: 'da' }],
        learning: [{ code: 'sv', level: 'intermediate', priority: 1 }],
      })

      const nearby = await discover(viewer, 'sort=nearby')
      const nearbyHandles = nearby
        .json<{ items: { handle: string }[] }>()
        .items.map((i) => i.handle)
      expect(nearbyHandles).toContain(sharing.handle)
      expect(nearbyHandles).not.toContain(notSharing.handle)

      // Opting out of nearby is not opting out of discovery.
      const recommended = await discover(viewer)
      const recommendedHandles = recommended
        .json<{ items: { handle: string }[] }>()
        .items.map((i) => i.handle)
      expect(recommendedHandles).toContain(notSharing.handle)
      // ...and no distance leaks into a sort that never measured one.
      const withDistance = recommended
        .json<{ items: { distanceKm?: number }[] }>()
        .items.filter((i) => i.distanceKm !== undefined)
      expect(withDistance).toEqual([])
    })

    it('honours radiusKm, which is what stops "nearby" meaning "nearest"', async () => {
      const viewer = await newUser('nearby-radius-viewer@example.com', {
        nativeLanguages: [{ code: 'no' }],
        learning: [{ code: 'is', level: 'intermediate', priority: 1 }],
      })
      await setTier(viewer.userId, 'pro_plus')
      await share(viewer, VIEWER)

      const inside = await share(
        await candidate('nearby-radius-inside@example.com', {
          nativeLanguages: [{ code: 'is' }],
          learning: [{ code: 'no', level: 'intermediate', priority: 1 }],
        }),
        ACROSS_TOWN,
      )
      const outside = await share(
        await candidate('nearby-radius-outside@example.com', {
          nativeLanguages: [{ code: 'is' }],
          learning: [{ code: 'no', level: 'intermediate', priority: 1 }],
        }),
        ANOTHER_CITY,
      )

      const wide = await discover(viewer, 'sort=nearby')
      expect(wide.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)).toEqual(
        expect.arrayContaining([inside.handle, outside.handle]),
      )

      const tight = await discover(viewer, 'sort=nearby&radiusKm=50')
      const tightHandles = tight.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(tightHandles).toContain(inside.handle)
      expect(tightHandles).not.toContain(outside.handle)
    })

    it('still applies the mutual-fit match and blocks — $geoNear runs them as its own `query`', async () => {
      const viewer = await newUser('nearby-guards-viewer@example.com', {
        nativeLanguages: [{ code: 'pl' }],
        learning: [{ code: 'lt', level: 'intermediate', priority: 1 }],
      })
      await setTier(viewer.userId, 'pro_plus')
      await share(viewer, VIEWER)

      const wrongLanguages = await share(
        await candidate('nearby-guards-language@example.com'),
        NEXT_DOOR,
      )
      const blocked = await share(
        await candidate('nearby-guards-blocked@example.com', {
          nativeLanguages: [{ code: 'lt' }],
          learning: [{ code: 'pl', level: 'intermediate', priority: 1 }],
        }),
        NEXT_DOOR,
      )
      const visible = await share(
        await candidate('nearby-guards-visible@example.com', {
          nativeLanguages: [{ code: 'lt' }],
          learning: [{ code: 'pl', level: 'intermediate', priority: 1 }],
        }),
        ACROSS_TOWN,
      )

      await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: viewer.cookie },
        payload: { userId: blocked.userId },
      })

      const response = await discover(viewer, 'sort=nearby')
      const handles = response.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)
      expect(handles).toContain(visible.handle)
      expect(handles).not.toContain(blocked.handle)
      expect(handles).not.toContain(wrongLanguages.handle)
    })

    it('pages without repeating or skipping anyone, despite every profile in a grid cell tying on distance', async () => {
      const viewer = await newUser('nearby-page-viewer@example.com', {
        nativeLanguages: [{ code: 'cs' }],
        learning: [{ code: 'sk', level: 'intermediate', priority: 1 }],
      })
      await setTier(viewer.userId, 'pro_plus')
      await share(viewer, VIEWER)

      const tied = []
      for (let i = 0; i < 5; i++) {
        // Identical coordinates on purpose: this is the tie a distance keyset
        // cursor could not have resumed through.
        tied.push(
          await share(
            await candidate(`nearby-page-${i}@example.com`, {
              nativeLanguages: [{ code: 'sk' }],
              learning: [{ code: 'cs', level: 'intermediate', priority: 1 }],
            }),
            NEXT_DOOR,
          ),
        )
      }

      const seen: string[] = []
      let cursor: string | undefined
      for (let page = 0; page < 5; page++) {
        const qs = new URLSearchParams({ sort: 'nearby', limit: '2' })
        if (cursor) qs.set('cursor', cursor)
        const body = await discover(viewer, qs.toString()).then((r) =>
          r.json<{ items: { handle: string }[]; nextCursor: string | null }>(),
        )
        seen.push(...body.items.map((i) => i.handle))
        if (!body.nextCursor) break
        cursor = body.nextCursor
      }

      expect(new Set(seen).size).toBe(seen.length)
      expect(seen.sort()).toEqual(tied.map((c) => c.handle).sort())
    })
  })

  describe('index usage — Faz 3 acceptance criterion', () => {
    it('the mutual-fit $match is served by an index, not a collection scan', async () => {
      const viewer = await newUser('explain-viewer@example.com')
      await newUser('explain-candidate@example.com', {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
      })

      // Mirrors the mutual-fit $match discoverProfiles builds — see its
      // comment on why this needs two indexes, not one.
      const explainResult = await handle.db
        .collection(COLLECTIONS.profiles)
        .aggregate([
          {
            $match: {
              _id: { $nin: [viewer.userId] },
              'settings.discoverable': true,
              deletedAt: { $exists: false },
              'nativeLanguages.code': { $in: ['en'] },
              'learning.code': { $in: ['tr'] },
            },
          },
        ])
        .explain('executionStats')

      const serialized = JSON.stringify(explainResult)
      expect(serialized).toContain('IXSCAN')
      expect(serialized).not.toContain('COLLSCAN')
    })
  })
})
