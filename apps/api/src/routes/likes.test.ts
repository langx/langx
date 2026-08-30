import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
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
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

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

describe('likes', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string) {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  async function post(user: SignedUpUser, body: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { cookie: user.cookie },
      payload: { body, language: 'en' },
    })
    return response.json<{ _id: string }>()._id
  }

  async function correct(user: SignedUpUser, postId: string, corrected: string) {
    const response = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/corrections`,
      headers: { cookie: user.cookie },
      payload: { corrected },
    })
    return response.json<{ _id: string }>()._id
  }

  function like(user: SignedUpUser, targetType: string, targetId: string) {
    return app.inject({
      method: 'PUT',
      url: '/likes',
      headers: { cookie: user.cookie },
      payload: { targetType, targetId },
    })
  }

  function unlike(user: SignedUpUser, targetType: string, targetId: string) {
    return app.inject({
      method: 'DELETE',
      url: '/likes',
      headers: { cookie: user.cookie },
      payload: { targetType, targetId },
    })
  }

  function likers(user: SignedUpUser, targetType: string, targetId: string, qs = '') {
    return app.inject({
      method: 'GET',
      url: `/likes?targetType=${targetType}&targetId=${targetId}${qs ? `&${qs}` : ''}`,
      headers: { cookie: user.cookie },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_likes_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_likes_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
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
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('rejects an unauthenticated like', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/likes',
      payload: { targetType: 'post', targetId: '65f0000000000000000000ff' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('is idempotent in both directions', async () => {
    // The reason this is PUT/DELETE rather than one toggling POST. Over HTTP a
    // lost response is retried, and a retried toggle undoes the like the first
    // attempt applied.
    const author = await newUser('idem-author@example.com')
    const viewer = await newUser('idem-viewer@example.com')
    const postId = await post(author, 'I has a question.')

    const first = await like(viewer, 'post', postId)
    expect(first.statusCode).toBe(200)
    expect(first.json<{ likeCount: number; likedByViewer: boolean }>()).toEqual({
      likeCount: 1,
      likedByViewer: true,
    })

    const again = await like(viewer, 'post', postId)
    expect(again.json<{ likeCount: number }>().likeCount).toBe(1)

    expect((await unlike(viewer, 'post', postId)).json<{ likeCount: number }>().likeCount).toBe(0)
    const undoneTwice = await unlike(viewer, 'post', postId)
    expect(undoneTwice.statusCode).toBe(200)
    expect(undoneTwice.json<{ likedByViewer: boolean }>().likedByViewer).toBe(false)
  })

  it('writes one row when two taps race', async () => {
    // The unique index is the guard, not a prior read.
    const author = await newUser('race-author@example.com')
    const viewer = await newUser('race-viewer@example.com')
    const postId = await post(author, 'I has raced.')

    await Promise.all([like(viewer, 'post', postId), like(viewer, 'post', postId)])
    const rows = await handle.db
      .collection(COLLECTIONS.likes)
      .countDocuments({ targetId: { $exists: true }, userId: viewer.userId })
    expect(rows).toBe(1)
  })

  it('keeps a post and a correction apart', async () => {
    const author = await newUser('kind-author@example.com')
    const helper = await newUser('kind-helper@example.com')
    const viewer = await newUser('kind-viewer@example.com')
    const postId = await post(author, 'I has two thing.')
    const correctionId = await correct(helper, postId, 'I have two things.')

    await like(viewer, 'post', postId)
    const onCorrection = await like(viewer, 'correction', correctionId)
    expect(onCorrection.json<{ likeCount: number }>().likeCount).toBe(1)

    // Liking the correction must not have touched the post, and vice versa.
    expect((await likers(viewer, 'post', postId)).json<{ items: unknown[] }>().items).toHaveLength(
      1,
    )
    expect(
      (await likers(viewer, 'correction', correctionId)).json<{ items: unknown[] }>().items,
    ).toHaveLength(1)
  })

  it('pays nothing', async () => {
    // A like costs one tap, and anything that pays for one tap is a farm —
    // worse than a reaction, because two accounts liking each other is a
    // reciprocal one.
    const author = await newUser('free-author@example.com')
    const viewer = await newUser('free-viewer@example.com')
    const postId = await post(author, 'I has no tokens.')

    const before = await handle.db
      .collection(COLLECTIONS.tokenLedger)
      .countDocuments({ userId: viewer.userId })
    await like(viewer, 'post', postId)
    const after = await handle.db
      .collection(COLLECTIONS.tokenLedger)
      .countDocuments({ userId: viewer.userId })
    expect(after).toBe(before)

    const activity = await handle.db
      .collection(COLLECTIONS.dailyActivity)
      .countDocuments({ userId: viewer.userId })
    expect(activity).toBe(0)
  })

  it('refuses a self-like', async () => {
    const author = await newUser('self-like@example.com')
    const postId = await post(author, 'I has praised myself.')
    expect((await like(author, 'post', postId)).statusCode).toBe(400)
  })

  it("reports a blocked author's post as absent, not forbidden", async () => {
    const author = await newUser('like-block-author@example.com')
    const viewer = await newUser('like-block-viewer@example.com')
    const postId = await post(author, 'I has been blocked.')

    await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { cookie: viewer.cookie },
      payload: { userId: author.userId },
    })

    expect((await like(viewer, 'post', postId)).statusCode).toBe(404)
  })

  it('carries like state on the feed, for the post and its top correction', async () => {
    const author = await newUser('state-author@example.com')
    const helper = await newUser('state-helper@example.com')
    const viewer = await newUser('state-viewer@example.com')
    const postId = await post(author, 'I has state.')
    const correctionId = await correct(helper, postId, 'I have state.')

    await like(viewer, 'post', postId)
    await like(helper, 'post', postId)
    await like(viewer, 'correction', correctionId)

    const feed = await app.inject({
      method: 'GET',
      url: '/feed',
      headers: { cookie: viewer.cookie },
    })
    const item = feed
      .json<{
        items: {
          _id: string
          likeCount: number
          likedByViewer: boolean
          topCorrection: { likeCount: number; likedByViewer: boolean } | null
        }[]
      }>()
      .items.find((i) => i._id === postId)

    expect(item?.likeCount).toBe(2)
    expect(item?.likedByViewer).toBe(true)
    expect(item?.topCorrection?.likeCount).toBe(1)
    expect(item?.topCorrection?.likedByViewer).toBe(true)
  })

  it('pages the likers list and leaves out blocked people', async () => {
    const author = await newUser('likers-author@example.com')
    const viewer = await newUser('likers-viewer@example.com')
    const postId = await post(author, 'I has many admirer.')

    const fans: SignedUpUser[] = []
    for (let i = 0; i < 3; i++) {
      const fan = await newUser(`likers-fan-${i}@example.com`)
      await like(fan, 'post', postId)
      fans.push(fan)
    }

    const page1 = (await likers(viewer, 'post', postId, 'limit=2')).json<{
      items: { _id: string }[]
      nextCursor: string | null
    }>()
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = (
      await likers(
        viewer,
        'post',
        postId,
        `limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      )
    ).json<{ items: { _id: string }[] }>()
    const seen = [...page1.items, ...page2.items].map((item) => item._id)
    expect(new Set(seen).size).toBe(3)

    await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { cookie: viewer.cookie },
      payload: { userId: fans[0]!.userId },
    })
    const filtered = (await likers(viewer, 'post', postId)).json<{ items: { _id: string }[] }>()
    expect(filtered.items.map((item) => item._id)).not.toContain(fans[0]!.userId)
    expect(filtered.items).toHaveLength(2)
  })
})
