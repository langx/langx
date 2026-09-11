import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { recordNotification } from '../modules/notifications/inbox'
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

interface InboxRow {
  _id: string
  kind: string
  read: boolean
  postId?: string
  preview?: string
  count?: number
  actor?: { _id: string; handle: string }
}

describe('notification centre', () => {
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
    if (response.statusCode !== 201) {
      throw new Error(`post failed (${response.statusCode}): ${response.body}`)
    }
    return response.json<{ _id: string }>()._id
  }

  function comment(user: SignedUpUser, postId: string, body: string) {
    return app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { cookie: user.cookie },
      payload: { body },
    })
  }

  function correct(user: SignedUpUser, postId: string, corrected: string) {
    return app.inject({
      method: 'POST',
      url: `/posts/${postId}/corrections`,
      headers: { cookie: user.cookie },
      payload: { corrected },
    })
  }

  function like(user: SignedUpUser, targetId: string, targetType = 'post') {
    return app.inject({
      method: 'PUT',
      url: '/likes',
      headers: { cookie: user.cookie },
      payload: { targetType, targetId },
    })
  }

  function unlike(user: SignedUpUser, targetId: string, targetType = 'post') {
    return app.inject({
      method: 'DELETE',
      url: '/likes',
      headers: { cookie: user.cookie },
      payload: { targetType, targetId },
    })
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

  function block(blocker: SignedUpUser, userId: string) {
    return app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { cookie: blocker.cookie },
      payload: { userId },
    })
  }

  /**
   * The writes above are fire-and-forget by design — the comment is already
   * saved when the row is written — so the response can land first. Polling
   * for the expected count is what makes that honest; a bare `await` on a
   * timer would be flaky in exactly the direction that hides a real bug.
   */
  async function inbox(user: SignedUpUser, expected?: number, qs = ''): Promise<InboxRow[]> {
    for (let attempt = 0; attempt < 40; attempt++) {
      const response = await app.inject({
        method: 'GET',
        url: `/me/notifications${qs ? `?${qs}` : ''}`,
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode).toBe(200)
      const items = response.json<{ items: InboxRow[] }>().items
      if (expected === undefined || items.length >= expected) return items
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error(`inbox never reached ${String(expected)} rows`)
  }

  function unread(user: SignedUpUser) {
    return app.inject({
      method: 'GET',
      url: '/me/notifications/unread',
      headers: { cookie: user.cookie },
    })
  }

  function markRead(user: SignedUpUser) {
    return app.inject({
      method: 'POST',
      url: '/me/notifications/read',
      headers: { cookie: user.cookie },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_notifications_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_notifications_test',
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

  afterEach(async () => {
    await handle.db.collection(COLLECTIONS.notifications).deleteMany({})
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('refuses an unauthenticated read', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/notifications' })
    expect(response.statusCode).toBe(401)
  })

  it('records a follow once, however many times you tap', async () => {
    const author = await newUser('follow-author@example.com')
    const follower = await newUser('follow-actor@example.com')

    await follow(follower, author.userId)
    const first = await inbox(author, 1)
    expect(first).toHaveLength(1)
    expect(first[0]?.kind).toBe('follow')
    expect(first[0]?.actor?._id).toBe(follower.userId)

    // Unfollowing and following again is not news, and the unique index is
    // what says so rather than a check somebody could forget.
    await unfollow(follower, author.userId)
    await follow(follower, author.userId)
    expect(await inbox(author)).toHaveLength(1)
  })

  /**
   * The test that encodes the whole premise.
   *
   * `notifyPostReply` sends at most one push per post per hour, on purpose.
   * If the inbox inherited that throttle it would be a second copy of the
   * push rather than the place the other replies were always said to be
   * waiting — so every one of them has to survive.
   *
   * They survive as a **count** rather than as a row each: ten people
   * commenting on one sentence is ten pieces of one piece of news. The
   * correction stays separate because it is a different thing to have done.
   */
  it('keeps every reply, where the push keeps one an hour', async () => {
    const author = await newUser('replies-author@example.com')
    const a = await newUser('replies-a@example.com')
    const b = await newUser('replies-b@example.com')
    const postId = await post(author, 'Ich habe gestern ein Buch gelesen.')

    await comment(a, postId, 'Nice sentence.')
    await comment(b, postId, 'Agreed.')
    await correct(a, postId, 'Ich habe gestern ein Buch gelesen!')

    const rows = await inbox(author, 2)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.kind).sort()).toEqual(['postComment', 'postCorrection'])

    // Both comments are still there — as "and 1 other", which is `count`.
    const comments = rows.find((row) => row.kind === 'postComment')
    expect(comments?.count).toBe(1)
    // And the correction, which nobody else made, carries no count at all.
    expect(rows.find((row) => row.kind === 'postCorrection')?.count).toBeUndefined()

    // Every row deep-links to the post and carries enough of it to be read.
    expect(rows.every((row) => row.postId === postId)).toBe(true)
    expect(rows[0]?.preview).toContain('Ich habe gestern')
  })

  it('records a like, and only one per person per thing', async () => {
    const author = await newUser('like-author@example.com')
    const liker = await newUser('like-actor@example.com')
    const postId = await post(author, 'A sentence worth liking.')

    await like(liker, postId)
    expect(await inbox(author, 1)).toHaveLength(1)

    // Unliking and liking again is a tap, not news — and `createdAt` stays at
    // the first one, which is when it actually happened.
    await unlike(liker, postId)
    await like(liker, postId)
    const rows = await inbox(author)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('like')
  })

  it('says nothing about what you did to your own post', async () => {
    const author = await newUser('self-actor@example.com')
    const postId = await post(author, 'Talking to myself.')

    await comment(author, postId, 'Replying to myself.')
    await like(author, postId)
    await follow(author, author.userId)

    expect(await inbox(author)).toHaveLength(0)
  })

  it('hides a blocked person from the list', async () => {
    const author = await newUser('block-author@example.com')
    const blocked = await newUser('block-actor@example.com')
    await follow(blocked, author.userId)
    expect(await inbox(author, 1)).toHaveLength(1)

    await block(author, blocked.userId)
    expect(await inbox(author)).toHaveLength(0)
  })

  it('drops a row whose post has since been deleted', async () => {
    const author = await newUser('deleted-post-author@example.com')
    const commenter = await newUser('deleted-post-actor@example.com')
    const postId = await post(author, 'This will not last.')
    await comment(commenter, postId, 'Shame.')
    expect(await inbox(author, 1)).toHaveLength(1)

    await app.inject({
      method: 'DELETE',
      url: `/posts/${postId}`,
      headers: { cookie: author.cookie },
    })
    expect(await inbox(author)).toHaveLength(0)
  })

  /**
   * Written straight into the collection with one `insertMany`, so every row
   * shares a millisecond. Inserting them one at a time would let the clock
   * separate them and the `_id` tiebreak would never be exercised — which is
   * the regression `dateIdCursor` exists to prevent.
   */
  it('pages exactly when every row shares a timestamp', async () => {
    const reader = await newUser('paging@example.com')
    const createdAt = new Date()
    await handle.db.collection(COLLECTIONS.notifications).insertMany(
      Array.from({ length: 25 }, (_unused, index) => ({
        _id: new ObjectId(),
        userId: reader.userId,
        kind: 'badgeEarned' as const,
        refId: `badge-${String(index)}`,
        badgeId: `badge-${String(index)}`,
        createdAt,
      })),
    )

    const seen: string[] = []
    let cursor = ''
    for (let page = 0; page < 10; page++) {
      const response = await app.inject({
        method: 'GET',
        url: `/me/notifications?limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        headers: { cookie: reader.cookie },
      })
      expect(response.statusCode).toBe(200)
      const body = response.json<{ items: InboxRow[]; nextCursor: string | null }>()
      seen.push(...body.items.map((item) => item._id))
      if (!body.nextCursor) break
      cursor = body.nextCursor
    }

    expect(seen).toHaveLength(25)
    expect(new Set(seen).size).toBe(25)
  })

  it('counts the unread, and stops counting once they are read', async () => {
    const author = await newUser('unread-author@example.com')
    const actor = await newUser('unread-actor@example.com')
    const postId = await post(author, 'Count these.')
    await comment(actor, postId, 'One.')
    await like(actor, postId)
    await inbox(author, 2)

    expect((await unread(author)).json<{ total: number }>().total).toBe(2)

    const read = await markRead(author)
    expect(read.statusCode).toBe(200)
    expect(read.json<{ read: number }>().read).toBe(2)
    expect((await unread(author)).json<{ total: number }>().total).toBe(0)
    expect((await inbox(author)).every((row) => row.read)).toBe(true)
  })

  /**
   * The badge counts rows of the list, not documents behind it.
   *
   * Ten comments on one post are one row, and a badge reading 10 over a list
   * with one thing in it sends somebody looking for nine that were never
   * there. This is the test that keeps the two agreeing.
   */
  it('counts what the list shows, not what the collection holds', async () => {
    const author = await newUser('grouped-count-author@example.com')
    const a = await newUser('grouped-count-a@example.com')
    const b = await newUser('grouped-count-b@example.com')
    const postId = await post(author, 'Count the rows, not the rows behind them.')

    await comment(a, postId, 'One.')
    await comment(b, postId, 'Two.')
    await comment(a, postId, 'Three.')
    const rows = await inbox(author, 1)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.count).toBe(2)
    expect((await unread(author)).json<{ total: number }>().total).toBe(1)
    expect(
      await handle.db.collection(COLLECTIONS.notifications).countDocuments({ userId: author.userId }),
    ).toBe(3)
  })

  it('marks only your own rows read', async () => {
    const mine = await newUser('mark-mine@example.com')
    const theirs = await newUser('mark-theirs@example.com')
    const actor = await newUser('mark-actor@example.com')
    await follow(actor, mine.userId)
    await follow(actor, theirs.userId)
    await inbox(mine, 1)
    await inbox(theirs, 1)

    await markRead(mine)

    expect((await unread(mine)).json<{ total: number }>().total).toBe(0)
    expect((await unread(theirs)).json<{ total: number }>().total).toBe(1)
  })

  it('does not throw when the same row is recorded twice', async () => {
    const reader = await newUser('duplicate@example.com')
    const row = { userId: reader.userId, kind: 'badgeEarned' as const, refId: 'first-correction' }

    await recordNotification(handle.db, row)
    await expect(recordNotification(handle.db, row)).resolves.toBeUndefined()
    expect(
      await handle.db
        .collection(COLLECTIONS.notifications)
        .countDocuments({ userId: reader.userId }),
    ).toBe(1)
  })
})
