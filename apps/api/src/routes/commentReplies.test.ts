import { COMMENT_REPLY_PREVIEW } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { purgeCommentsBy } from '../modules/feed/comments'
import type { PostCommentDoc } from '../modules/feed/documents'
import type { Report } from '../modules/moderation/blocks'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { COMMENT_REPLY_INBOX_ROWS } from './feed'

/**
 * One level of replies under a post's comments, and reporting a comment.
 *
 * Its own suite rather than more of `feed.test.ts`: the flat list installed
 * builds read is pinned there and stays untouched, and everything here is
 * about the shape a new client opts into, the old one it must not disturb,
 * and who hears about a reply.
 */

const PASSWORD = 'correct horse battery staple'

interface Row {
  _id: string
  author: { _id: string; handle: string }
  body: string
  createdAt: string
  parentId?: string
  replyTo?: { _id: string }
  deleted?: true
  replyCount?: number
  replies?: Row[]
}

interface Page {
  items: Row[]
  nextCursor: string | null
}

describe('comment replies', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(): Promise<SignedUpUser> {
    seq++
    const email = `replies-${seq}@example.com`
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `reply${seq}${Math.random().toString(36).slice(2, 7)}`,
        displayName: `Replier ${seq}`,
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  const inject = (
    user: SignedUpUser,
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: { cookie: user.cookie },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    })

  async function post(user: SignedUpUser, body = 'I has a pen.'): Promise<string> {
    const response = await inject(user, 'POST', '/posts', { body, language: 'en' })
    expect(response.statusCode, response.body).toBe(201)
    return response.json<{ _id: string }>()._id
  }

  async function comment(
    user: SignedUpUser,
    postId: string,
    body: string,
    parentId?: string,
  ): Promise<string> {
    const response = await inject(user, 'POST', `/posts/${postId}/comments`, {
      body,
      ...(parentId ? { parentId } : {}),
    })
    expect(response.statusCode, response.body).toBe(201)
    return response.json<{ _id: string }>()._id
  }

  async function list(user: SignedUpUser, postId: string, qs = ''): Promise<Page> {
    const response = await inject(user, 'GET', `/posts/${postId}/comments${qs ? `?${qs}` : ''}`)
    expect(response.statusCode, response.body).toBe(200)
    return response.json<Page>()
  }

  async function replies(user: SignedUpUser, postId: string, commentId: string, qs = '') {
    const response = await inject(
      user,
      'GET',
      `/posts/${postId}/comments/${commentId}/replies${qs ? `?${qs}` : ''}`,
    )
    expect(response.statusCode, response.body).toBe(200)
    return response.json<Page>()
  }

  /** The card's count, read from the author's own list. */
  async function commentCount(author: SignedUpUser, postId: string): Promise<number | undefined> {
    const response = await inject(author, 'GET', '/me/posts')
    return response
      .json<{ items: { _id: string; commentCount: number }[] }>()
      .items.find((item) => item._id === postId)?.commentCount
  }

  const stored = (id: string) =>
    handle.db
      .collection<PostCommentDoc>(COLLECTIONS.postComments)
      .findOne({ _id: new ObjectId(id) })

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_comment_replies_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_comment_replies_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
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

    // Same first-transaction warm-up as the other route suites.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  })

  afterAll(async () => {
    await app.close()
    await handle.close()
    await replSet.stop()
  })

  describe('the flat list installed builds read', () => {
    it('is the shape it always was on a post nobody replied in', async () => {
      const author = await newUser()
      const reader = await newUser()
      const postId = await post(author)
      await comment(reader, postId, 'Nearly!')

      const [row] = (await list(reader, postId)).items
      // Exactly the four fields, so a build that predates replies reads the
      // same bytes it was written against.
      expect(Object.keys(row ?? {}).sort()).toEqual(['_id', 'author', 'body', 'createdAt'])
    })

    it('carries replies inline, oldest first, with who they answer', async () => {
      const author = await newUser()
      const a = await newUser()
      const b = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      const reply = await comment(b, postId, 'Reply.', root)
      await comment(a, postId, 'Reply to the reply.', reply)

      const items = (await list(author, postId)).items
      expect(items.map((row) => row.body)).toEqual(['Root.', 'Reply.', 'Reply to the reply.'])
      expect(items[1]?.parentId).toBe(root)
      expect(items[1]?.replyTo).toBeUndefined()
      expect(items[2]?.parentId).toBe(root)
      expect(items[2]?.replyTo?._id).toBe(b.userId)
    })
  })

  describe('writing a reply', () => {
    it('files a reply to a reply under the same root, answering its author', async () => {
      const author = await newUser()
      const a = await newUser()
      const b = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      const reply = await comment(b, postId, 'First reply.', root)
      const nested = await comment(a, postId, 'Answer to the reply.', reply)

      const doc = await stored(nested)
      expect(doc?.parentId?.toHexString()).toBe(root)
      expect(doc?.replyToAuthorId).toBe(b.userId)
      // A reply straight to the root answers nobody in particular.
      expect((await stored(reply))?.replyToAuthorId).toBeUndefined()
    })

    it('refuses a parent on another post, or by somebody blocked', async () => {
      const author = await newUser()
      const a = await newUser()
      const b = await newUser()
      const postId = await post(author)
      const elsewhere = await post(author, 'Another sentence.')
      const root = await comment(a, elsewhere, 'Somewhere else.')

      const wrongPost = await inject(b, 'POST', `/posts/${postId}/comments`, {
        body: 'Hm.',
        parentId: root,
      })
      expect(wrongPost.statusCode).toBe(404)

      const here = await comment(a, postId, 'Here.')
      expect((await inject(b, 'POST', '/blocks', { userId: a.userId })).statusCode).toBe(201)
      const blocked = await inject(b, 'POST', `/posts/${postId}/comments`, {
        body: 'Hm.',
        parentId: here,
      })
      expect(blocked.statusCode).toBe(404)
      const malformed = await inject(b, 'POST', `/posts/${postId}/comments`, {
        body: 'Hm.',
        parentId: 'not-an-id',
      })
      expect(malformed.statusCode).toBe(404)
    })
  })

  describe('the threaded read', () => {
    it('answers roots with a count and the first replies, and pages the rest', async () => {
      const author = await newUser()
      const a = await newUser()
      const b = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      const other = await comment(b, postId, 'Another root.')
      const written: string[] = []
      for (let i = 1; i <= 5; i++) {
        written.push(await comment(i % 2 ? b : author, postId, `Reply ${i}.`, root))
      }

      const page = await list(author, postId, 'threaded=1')
      expect(page.items.map((row) => row._id)).toEqual([root, other])
      const [first, second] = page.items
      expect(first?.replyCount).toBe(5)
      expect(first?.replies?.map((row) => row.body)).toEqual(
        ['Reply 1.', 'Reply 2.'].slice(0, COMMENT_REPLY_PREVIEW),
      )
      expect(second?.replyCount).toBe(0)
      expect(second?.replies).toEqual([])

      // Every reply once, in order, however the pages fall.
      const seen: string[] = []
      let cursor: string | null = null
      do {
        const next: Page = await replies(
          author,
          postId,
          root,
          `limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        )
        seen.push(...next.items.map((row) => row._id))
        cursor = next.nextCursor
      } while (cursor)
      expect(seen).toEqual(written)

      // A reply's id names its thread as well as the root's does.
      expect((await replies(author, postId, written[2] ?? '')).items).toHaveLength(5)
    })

    it('leaves out replies from somebody blocked, and counts without them', async () => {
      const author = await newUser()
      const a = await newUser()
      const pest = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      await comment(pest, postId, 'Unwelcome.', root)
      await comment(a, postId, 'Welcome.', root)
      expect((await inject(author, 'POST', '/blocks', { userId: pest.userId })).statusCode).toBe(
        201,
      )

      const [thread] = (await list(author, postId, 'threaded=1')).items
      expect(thread?.replyCount).toBe(1)
      expect(thread?.replies?.map((row) => row.body)).toEqual(['Welcome.'])
      expect((await replies(author, postId, root)).items.map((row) => row.body)).toEqual([
        'Welcome.',
      ])
      expect((await list(author, postId)).items.map((row) => row.body)).toEqual([
        'Root.',
        'Welcome.',
      ])
    })

    it('reads both thread shapes off post_parent_created_id, never a scan', async () => {
      const author = await newUser()
      const a = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      await comment(author, postId, 'Reply.', root)

      const comments = handle.db.collection(COLLECTIONS.postComments)
      const plans = [
        comments.find({ postId: new ObjectId(postId), parentId: null }),
        comments.find({ postId: new ObjectId(postId), parentId: new ObjectId(root) }),
      ]
      for (const [index, cursor] of plans.entries()) {
        const plan = await cursor.sort({ createdAt: 1, _id: 1 }).explain('queryPlanner')
        // The winning plan only — see the same note in `messages.test.ts`.
        const shape = JSON.stringify(
          (plan as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan,
        )
        expect(shape).toContain('IXSCAN')
        expect(shape).not.toContain('COLLSCAN')
        expect(shape).not.toContain('"stage":"SORT"')
        // The replies read names a parent, which only the new index bounds.
        if (index === 1) expect(shape).toContain('post_parent_created_id')
      }
    })
  })

  describe('deleting', () => {
    it('keeps a root with replies as a tombstone, and sweeps it with its last reply', async () => {
      const author = await newUser()
      const a = await newUser()
      const b = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      const reply = await comment(b, postId, 'Reply.', root)
      expect(await commentCount(author, postId)).toBe(2)

      expect((await inject(a, 'DELETE', `/posts/${postId}/comments/${root}`)).statusCode).toBe(204)
      const tomb = await stored(root)
      expect(tomb?.deletedAt).toBeInstanceOf(Date)
      expect(tomb?.body).toBeUndefined()

      const [thread] = (await list(author, postId, 'threaded=1')).items
      expect(thread).toMatchObject({ _id: root, body: '', deleted: true, replyCount: 1 })
      // An installed build has only ever seen a deleted comment disappear.
      expect((await list(author, postId)).items.map((row) => row.body)).toEqual(['Reply.'])
      expect(await commentCount(author, postId)).toBe(1)
      // Deleting it again is deleting something already gone.
      expect((await inject(a, 'DELETE', `/posts/${postId}/comments/${root}`)).statusCode).toBe(404)

      expect((await inject(b, 'DELETE', `/posts/${postId}/comments/${reply}`)).statusCode).toBe(204)
      expect(await stored(root)).toBeNull()
      expect((await list(author, postId, 'threaded=1')).items).toEqual([])
      expect(await commentCount(author, postId)).toBe(0)
    })

    it('still takes replies under a tombstone', async () => {
      const author = await newUser()
      const a = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      await comment(author, postId, 'Reply.', root)
      await inject(a, 'DELETE', `/posts/${postId}/comments/${root}`)

      await comment(author, postId, 'Another.', root)
      const [thread] = (await list(author, postId, 'threaded=1')).items
      expect(thread?.replyCount).toBe(2)
    })

    it('tombstones an answered root at the purge, and sweeps what only it held up', async () => {
      const author = await newUser()
      const leaving = await newUser()
      const other = await newUser()
      const postId = await post(author)
      const answered = await comment(leaving, postId, 'Answered.')
      await comment(other, postId, 'Reply.', answered)
      const lonely = await comment(leaving, postId, 'Nobody answered.')
      const othersRoot = await comment(other, postId, 'Other root.')
      await comment(leaving, postId, 'My only reply.', othersRoot)
      await inject(other, 'DELETE', `/posts/${postId}/comments/${othersRoot}`)
      expect((await stored(othersRoot))?.deletedAt).toBeInstanceOf(Date)

      await purgeCommentsBy(handle.db, leaving.userId)

      expect((await stored(answered))?.deletedAt).toBeInstanceOf(Date)
      expect((await stored(answered))?.body).toBeUndefined()
      expect(await stored(lonely)).toBeNull()
      // `other`'s tombstone stood only for the reply the purge just took.
      expect(await stored(othersRoot)).toBeNull()
      expect((await list(author, postId)).items.map((row) => row.body)).toEqual(['Reply.'])
    })
  })

  describe('who hears about a reply', () => {
    /** The pushes are claimed in the ledger before they are sent. Polled: the write is unawaited. */
    async function claims(prefix: string, userId: string, expected: number): Promise<number> {
      for (let attempt = 0; attempt < 40; attempt++) {
        const count = await handle.db
          .collection(COLLECTIONS.notificationLedger)
          .countDocuments({ _id: { $regex: `^${prefix}:${userId}:` } as never })
        if (count >= expected) return count
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return handle.db
        .collection(COLLECTIONS.notificationLedger)
        .countDocuments({ _id: { $regex: `^${prefix}:${userId}:` } as never })
    }

    const rowsFor = (userId: string) =>
      handle.db
        .collection<{ userId: string; kind: string }>(COLLECTIONS.notifications)
        .find({ userId })
        .toArray()

    it('tells the thread and the answered person, and the post author once', async () => {
      const author = await newUser()
      const a = await newUser()
      const b = await newUser()
      const c = await newUser()
      const postId = await post(author)
      const root = await comment(a, postId, 'Root.')
      const reply = await comment(b, postId, 'Reply.', root)
      await comment(c, postId, 'Reply to b.', reply)

      // The root's author, and the person answered, each hear the reply push.
      expect(await claims('social.commentReply', a.userId, 1)).toBe(1)
      expect(await claims('social.commentReply', b.userId, 1)).toBe(1)
      // The post's author hears as they always did — and never the reply push.
      expect(await claims('social.postReply', author.userId, 1)).toBe(1)
      expect(await claims('social.commentReply', author.userId, 0)).toBe(0)

      // Push-only for now: no reply rows, and the author's rows are postComment.
      expect(COMMENT_REPLY_INBOX_ROWS).toBe(false)
      for (let attempt = 0; attempt < 40; attempt++) {
        if ((await rowsFor(author.userId)).length >= 3) break
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      expect((await rowsFor(author.userId)).map((row) => row.kind)).toEqual([
        'postComment',
        'postComment',
        'postComment',
      ])
      expect(await rowsFor(a.userId)).toHaveLength(0)
      expect(await rowsFor(b.userId)).toHaveLength(0)
    })

    it('sends a post author in the thread the reply push instead of the comment one', async () => {
      const author = await newUser()
      const a = await newUser()
      const postId = await post(author)
      const root = await comment(author, postId, 'My own comment.')
      await comment(a, postId, 'Answering it.', root)

      expect(await claims('social.commentReply', author.userId, 1)).toBe(1)
      expect(await claims('social.postReply', author.userId, 0)).toBe(0)
      // One row, the kind every installed build can draw.
      for (let attempt = 0; attempt < 40; attempt++) {
        if ((await rowsFor(author.userId)).length > 0) break
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      expect((await rowsFor(author.userId)).map((row) => row.kind)).toEqual(['postComment'])
    })
  })

  describe('reporting a comment', () => {
    const reportMails = () =>
      emailSender.messages.filter((message) => message.subject.includes('Report: '))

    function reviewPathFrom(text: string): string {
      const match = /Review: (\S+)/.exec(text)
      if (!match?.[1]) throw new Error(`no review link in mail:\n${text}`)
      const url = new URL(match[1])
      return `${url.pathname}${url.search}`
    }

    const decide = (path: string, action: string) =>
      app.inject({
        method: 'POST',
        url: path,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams({ action }).toString(),
      })

    it('must name the reported person’s own comment', async () => {
      const author = await newUser()
      const a = await newUser()
      const reporter = await newUser()
      const postId = await post(author)
      const commentId = await comment(a, postId, 'Rude.')

      const wrong = await inject(reporter, 'POST', '/reports', {
        userId: author.userId,
        reason: 'harassment',
        commentId,
      })
      expect(wrong.statusCode).toBe(404)
    })

    it('quotes it, hides it from every read, and keeps its thread', async () => {
      const author = await newUser()
      const rude = await newUser()
      const other = await newUser()
      const reporter = await newUser()
      const postId = await post(author, 'The sentence under it.')
      const root = await comment(rude, postId, 'Something rude.')
      await comment(other, postId, 'Please don’t.', root)

      emailSender.messages.length = 0
      const filed = await inject(reporter, 'POST', '/reports', {
        userId: rude.userId,
        reason: 'harassment',
        commentId: root,
        // Ignored beside a comment: the post was not what was reported.
        postId,
      })
      expect(filed.statusCode, filed.body).toBe(201)
      const report = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ commentId: new ObjectId(root) })
      expect(report?.postId).toBeUndefined()

      const mail = reportMails().at(-1)
      expect(mail?.text).toContain('Something rude.')
      const path = reviewPathFrom(mail?.text ?? '')
      const page = await app.inject({ method: 'GET', url: path })
      expect(page.body).toContain('Something rude.')
      expect(page.body).toContain('Hide this comment')
      expect(page.body).not.toContain('Hide this post')

      expect((await decide(path, 'hide_comment')).statusCode).toBe(200)
      expect((await app.inject({ method: 'GET', url: path })).body).toContain('Show it again')

      // Gone from the flat list, a placeholder over its surviving thread.
      expect((await list(other, postId)).items.map((row) => row.body)).toEqual(['Please don’t.'])
      const [thread] = (await list(other, postId, 'threaded=1')).items
      expect(thread).toMatchObject({ _id: root, body: '', deleted: true, replyCount: 1 })
      expect(await commentCount(author, postId)).toBe(1)
      // Nobody replies to a hidden comment directly.
      const replying = await inject(other, 'POST', `/posts/${postId}/comments`, {
        body: 'Again.',
        parentId: root,
      })
      expect(replying.statusCode).toBe(404)
      const decided = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ commentId: new ObjectId(root) })
      expect(decided?.status).toBe('actioned')

      expect((await decide(path, 'unhide_comment')).statusCode).toBe(200)
      expect((await list(other, postId)).items.map((row) => row.body)).toEqual([
        'Something rude.',
        'Please don’t.',
      ])
    })

    it('will not hide a comment from a report that names none', async () => {
      const target = await newUser()
      const reporter = await newUser()
      emailSender.messages.length = 0
      await inject(reporter, 'POST', '/reports', { userId: target.userId, reason: 'spam' })
      const path = reviewPathFrom(reportMails().at(-1)?.text ?? '')
      expect((await decide(path, 'hide_comment')).statusCode).toBe(400)
    })
  })
})
