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
    birthYear: 1995,
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

describe('follows', () => {
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

  function follow(user: SignedUpUser, targetId: string) {
    return app.inject({
      method: 'POST',
      url: `/profiles/${targetId}/follow`,
      headers: { cookie: user.cookie },
    })
  }

  function unfollow(user: SignedUpUser, targetId: string) {
    return app.inject({
      method: 'DELETE',
      url: `/profiles/${targetId}/follow`,
      headers: { cookie: user.cookie },
    })
  }

  function list(user: SignedUpUser, targetId: string, which: 'followers' | 'following', qs = '') {
    return app.inject({
      method: 'GET',
      url: `/profiles/${targetId}/${which}${qs ? `?${qs}` : ''}`,
      headers: { cookie: user.cookie },
    })
  }

  function block(blocker: SignedUpUser, userId: string) {
    return app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { cookie: blocker.cookie },
      payload: { userId },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_follows_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_follows_test',
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

  it('rejects an unauthenticated follow', async () => {
    const response = await app.inject({ method: 'POST', url: '/profiles/someone/follow' })
    expect(response.statusCode).toBe(401)
  })

  it('follows once however many times you tap', async () => {
    const viewer = await newUser('follow-viewer@example.com')
    const target = await newUser('follow-target@example.com')

    const first = await follow(viewer, target.userId)
    expect(first.statusCode).toBe(200)
    expect(first.json<{ followers: number; viewerFollows: boolean }>()).toMatchObject({
      followers: 1,
      viewerFollows: true,
    })

    // Idempotent: the unique index answers "already following" rather than
    // erroring, and a second row would double the count.
    expect((await follow(viewer, target.userId)).json<{ followers: number }>().followers).toBe(1)
    const rows = await handle.db
      .collection(COLLECTIONS.follows)
      .countDocuments({ followerId: viewer.userId, followeeId: target.userId })
    expect(rows).toBe(1)
  })

  it('unfollows twice without complaining', async () => {
    const viewer = await newUser('unfollow-viewer@example.com')
    const target = await newUser('unfollow-target@example.com')
    await follow(viewer, target.userId)

    expect((await unfollow(viewer, target.userId)).json<{ followers: number }>().followers).toBe(0)
    const again = await unfollow(viewer, target.userId)
    expect(again.statusCode).toBe(200)
    expect(again.json<{ viewerFollows: boolean }>().viewerFollows).toBe(false)
  })

  it('refuses a self-follow', async () => {
    const user = await newUser('self-follow@example.com')
    expect((await follow(user, user.userId)).statusCode).toBe(400)
  })

  it('reports a blocked profile as absent, not forbidden', async () => {
    const viewer = await newUser('follow-block-viewer@example.com')
    const target = await newUser('follow-block-target@example.com')
    await block(viewer, target.userId)
    expect((await follow(viewer, target.userId)).statusCode).toBe(404)
  })

  it('keeps the count and the list agreeing after a block', async () => {
    // The reason the counts are block-filtered at all. An unfiltered count
    // beside a filtered list reads "2 followers" over one row, and that
    // discrepancy is itself the leak: it tells the viewer that somebody they
    // blocked follows this person.
    const viewer = await newUser('agree-viewer@example.com')
    const target = await newUser('agree-target@example.com')
    const rude = await newUser('agree-rude@example.com')
    const fine = await newUser('agree-fine@example.com')

    await follow(rude, target.userId)
    await follow(fine, target.userId)
    await block(viewer, rude.userId)

    const profile = await app.inject({
      method: 'GET',
      url: `/profiles/${target.userId}`,
      headers: { cookie: viewer.cookie },
    })
    const follow_ = profile.json<{ follow: { followers: number } }>().follow
    const rows = (await list(viewer, target.userId, 'followers')).json<{
      items: { _id: string }[]
    }>()

    expect(follow_.followers).toBe(1)
    expect(rows.items).toHaveLength(1)
    expect(rows.items.map((item) => item._id)).not.toContain(rude.userId)
  })

  it('pages the follower list', async () => {
    const viewer = await newUser('page-viewer@example.com')
    const target = await newUser('page-target@example.com')
    for (let i = 0; i < 3; i++) {
      const fan = await newUser(`page-fan-${i}@example.com`)
      await follow(fan, target.userId)
    }

    const page1 = (await list(viewer, target.userId, 'followers', 'limit=2')).json<{
      items: { _id: string }[]
      nextCursor: string | null
    }>()
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = (
      await list(
        viewer,
        target.userId,
        'followers',
        `limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      )
    ).json<{ items: { _id: string }[] }>()
    const seen = [...page1.items, ...page2.items].map((item) => item._id)
    expect(new Set(seen).size).toBe(3)
  })

  it('lists who somebody follows, and reports it on their profile', async () => {
    const viewer = await newUser('following-list-viewer@example.com')
    const a = await newUser('following-list-a@example.com')
    const b = await newUser('following-list-b@example.com')
    await follow(viewer, a.userId)
    await follow(viewer, b.userId)

    const rows = (await list(viewer, viewer.userId, 'following')).json<{
      items: { _id: string }[]
    }>()
    expect(rows.items.map((item) => item._id).sort()).toEqual([a.userId, b.userId].sort())

    const profile = await app.inject({
      method: 'GET',
      url: `/profiles/${viewer.userId}`,
      headers: { cookie: viewer.cookie },
    })
    expect(profile.json<{ follow: { following: number } }>().follow.following).toBe(2)
  })
})
