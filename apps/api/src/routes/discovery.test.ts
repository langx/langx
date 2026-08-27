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
    birthYear: 1995,
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
    it('online filter keeps only recently-active profiles', async () => {
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
      expect(handles).not.toContain(staleActive.handle)
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
        birthYear: 1990,
      })
      const wrongGender = await newUser('pro-wrong-gender@example.com', {
        nativeLanguages: [{ code: 'et' }],
        learning: [{ code: 'fi', level: 'intermediate', priority: 1 }],
        gender: 'male',
        country: 'US',
        birthYear: 1990,
      })
      const wrongAge = await newUser('pro-wrong-age@example.com', {
        nativeLanguages: [{ code: 'et' }],
        learning: [{ code: 'fi', level: 'intermediate', priority: 1 }],
        gender: 'female',
        country: 'US',
        birthYear: 2005,
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
