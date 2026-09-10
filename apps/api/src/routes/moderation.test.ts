import {
  ACCOUNT_DELETION_GRACE_DAYS,
  MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
  REPORTS_TO_FREEZE_XP,
  type AccountDeletionStatus,
  type DataExport,
  type Leaderboard,
  TOKEN_RULES,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import type { Report } from '../modules/moderation/blocks'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { purgeExpiredAccounts } from '../modules/account/deletion'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import { awardTokens } from '../modules/tokens/ledger'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const SUPPORT = 'moderation@example.test'

describe('Faz 10 — blocking, reports, profile views, deletion and export', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(overrides: Record<string, unknown> = {}): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `faz10-${seq}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `faz10user${seq}`,
        displayName: `User ${seq}`,
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
        ...overrides,
      },
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  /** Only the moderation mail: every `newUser()` above sends a verification one. */
  const reportMails = () =>
    emailSender.messages.filter((message) => message.subject.includes('Report: '))

  const get = (user: SignedUpUser, url: string) =>
    app.inject({ method: 'GET', url, headers: { cookie: user.cookie } })
  const post = (user: SignedUpUser, url: string, payload?: unknown) =>
    app.inject({
      method: 'POST',
      url,
      headers: { cookie: user.cookie },
      ...(payload ? { payload } : {}),
    })

  function startConversation(from: SignedUpUser, toUserId: string, body = 'hi') {
    return post(from, '/conversations', { toUserId, body })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_faz10_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_faz10_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      SUPPORT_EMAIL: SUPPORT,
    })
    await ensureIndexes(handle.db)
    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      email: emailSender,
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

  describe('a blocked user is absent from every list', () => {
    it('drops out of discovery, the conversation list, the leaderboard and their profile 404s', async () => {
      // Mutual language fit, so they would otherwise see each other.
      const me = await newUser({
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      })
      const them = await newUser({
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
      })

      await startConversation(me, them.userId, 'before the block')
      await awardTokens(handle.db, {
        userId: them.userId,
        kind: 'adjustment',
        amount: 99_999,
        refId: 'blk',
      })

      // Everything visible first, so the assertions after the block mean something.
      expect(
        (await get(me, '/discovery'))
          .json<{ items: { _id: string }[] }>()
          .items.some((i) => i._id === them.userId),
      ).toBe(true)
      expect((await get(me, '/conversations')).json<{ items: unknown[] }>().items).toHaveLength(1)
      expect(
        (await get(me, '/leaderboard?period=all'))
          .json<Leaderboard>()
          .entries.some((e) => e.userId === them.userId),
      ).toBe(true)
      expect((await get(me, `/profiles/${them.userId}`)).statusCode).toBe(200)

      expect((await post(me, '/blocks', { userId: them.userId })).statusCode).toBe(201)

      expect(
        (await get(me, '/discovery'))
          .json<{ items: { _id: string }[] }>()
          .items.some((i) => i._id === them.userId),
      ).toBe(false)
      expect((await get(me, '/conversations')).json<{ items: unknown[] }>().items).toHaveLength(0)
      expect(
        (await get(me, '/leaderboard?period=all'))
          .json<Leaderboard>()
          .entries.some((e) => e.userId === them.userId),
      ).toBe(false)
      // 404, not 403 — a 403 would confirm the account exists.
      expect((await get(me, `/profiles/${them.userId}`)).statusCode).toBe(404)
    })

    it('hides the blocker from the blocked user too, without telling them', async () => {
      const blocker = await newUser({
        nativeLanguages: [{ code: 'de' }],
        learning: [{ code: 'fr', level: 'intermediate', priority: 1 }],
      })
      const blocked = await newUser({
        nativeLanguages: [{ code: 'fr' }],
        learning: [{ code: 'de', level: 'intermediate', priority: 1 }],
      })

      await post(blocker, '/blocks', { userId: blocked.userId })

      const discovery = await get(blocked, '/discovery')
      expect(
        discovery.json<{ items: { _id: string }[] }>().items.some((i) => i._id === blocker.userId),
      ).toBe(false)
      expect((await get(blocked, `/profiles/${blocker.userId}`)).statusCode).toBe(404)
      // And they cannot start a conversation either.
      const attempt = await startConversation(blocked, blocker.userId, 'hello?')
      expect(attempt.statusCode).toBe(403)
      expect(attempt.json<{ code: string }>().code).toBe('BLOCKED')
    })

    it('is idempotent and reversible', async () => {
      const a = await newUser()
      const b = await newUser()
      expect((await post(a, '/blocks', { userId: b.userId })).statusCode).toBe(201)
      expect((await post(a, '/blocks', { userId: b.userId })).statusCode).toBe(201) // no duplicate-key 500
      const listed = (await get(a, '/blocks')).json<{ items: unknown[]; total: number }>()
      expect(listed.items).toHaveLength(1)
      // The whole list's count, for the settings row — not the page's.
      expect(listed.total).toBe(1)

      const removed = await app.inject({
        method: 'DELETE',
        url: `/blocks/${b.userId}`,
        headers: { cookie: a.cookie },
      })
      expect(removed.statusCode).toBe(204)
      const after = (await get(a, '/blocks')).json<{ items: unknown[]; total: number }>()
      expect(after.items).toHaveLength(0)
      expect(after.total).toBe(0)
    })

    /** Had no limit at all: one query and one response body sized by the list. */
    it('pages the blocked list without repeating or skipping', async () => {
      const blocker = await newUser()
      const blocked = []
      for (let i = 0; i < 5; i++) {
        const target = await newUser()
        expect((await post(blocker, '/blocks', { userId: target.userId })).statusCode).toBe(201)
        blocked.push(target.userId)
      }

      const seen: string[] = []
      let cursor: string | null = null
      let pages = 0
      do {
        const suffix: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
        const page = await get(blocker, `/blocks?limit=2${suffix}`)
        expect(page.statusCode, page.body).toBe(200)
        const body = page.json<{ items: { blockedId: string }[]; nextCursor: string | null }>()
        seen.push(...body.items.map((b) => b.blockedId))
        cursor = body.nextCursor
        pages++
      } while (cursor && pages < 10)

      expect(seen).toHaveLength(5)
      expect(new Set(seen)).toEqual(new Set(blocked))
    })

    it('refuses a self-block', async () => {
      const a = await newUser()
      expect((await post(a, '/blocks', { userId: a.userId })).statusCode).toBe(400)
    })
  })

  describe('reports', () => {
    it('freezes token only once distinct reporters cross the threshold', async () => {
      const target = await newUser()
      const reporters = []
      for (let i = 0; i < REPORTS_TO_FREEZE_XP; i++) reporters.push(await newUser())

      const frozenAfter = async () =>
        (await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: target.userId }))
          ?.tokenFrozenAt

      for (const reporter of reporters.slice(0, REPORTS_TO_FREEZE_XP - 1)) {
        expect(
          (await post(reporter, '/reports', { userId: target.userId, reason: 'spam' })).statusCode,
        ).toBe(201)
      }
      expect(await frozenAfter()).toBeUndefined()

      await post(reporters.at(-1)!, '/reports', { userId: target.userId, reason: 'harassment' })
      expect(await frozenAfter()).toBeInstanceOf(Date)
    })

    it('does not let one person reach the threshold alone', async () => {
      const target = await newUser()
      const reporter = await newUser()
      for (let i = 0; i < REPORTS_TO_FREEZE_XP + 2; i++) {
        await post(reporter, '/reports', { userId: target.userId, reason: 'spam' })
      }
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: target.userId })
      expect(profile?.tokenFrozenAt).toBeUndefined()
    })

    it('stops a frozen user earning while still delivering their messages', async () => {
      const frozen = await newUser({
        nativeLanguages: [{ code: 'es' }],
        learning: [{ code: 'it', level: 'intermediate', priority: 1 }],
      })
      const other = await newUser({
        nativeLanguages: [{ code: 'it' }],
        learning: [{ code: 'es', level: 'intermediate', priority: 1 }],
      })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: frozen.userId }, { $set: { tokenFrozenAt: new Date() } })

      const started = await startConversation(frozen, other.userId, 'still talking')
      expect(started.statusCode).toBe(201) // the message went through

      const summary = await get(frozen, '/me/tokens')
      // Their all-time total still holds the signup grant, which is not an
      // earning — the ranked week is what says they were paid nothing.
      const tokens = summary.json<{ tokens: { all: number; week: number } }>().tokens
      expect(tokens.week).toBe(0)
      expect(tokens.all).toBe(TOKEN_RULES.signupBonus)
      // Activity is still recorded, so a reviewer clearing the freeze can reconcile.
      expect(summary.json<{ today: { messages: number } }>().today.messages).toBe(1)
    })

    /**
     * `hate_speech` is its own reason rather than a shade of `harassment`, and
     * `details` was in the schema long before any screen sent it. Somebody
     * reporting an attack on who they are needs to be able to say so and to
     * say what happened; this is the round trip that proves both arrive.
     */
    it('stores a hate speech report with its details', async () => {
      const target = await newUser()
      const reporter = await newUser()
      const details = 'Called me a slur in the chat and repeated it after I asked them to stop.'

      const response = await post(reporter, '/reports', {
        userId: target.userId,
        reason: 'hate_speech',
        details,
      })
      expect(response.statusCode, response.body).toBe(201)

      const stored = await handle.db
        .collection(COLLECTIONS.reports)
        .findOne({ reporterId: reporter.userId, reportedId: target.userId })
      expect(stored).toMatchObject({ reason: 'hate_speech', details, status: 'open' })
    })

    /**
     * Nothing reads `reports`, so until this the only sign a report existed
     * was the row itself. These check the one thing that now tells a person.
     */
    it('mails the support inbox with both parties, the reason and the details', async () => {
      const reporter = await newUser()
      const target = await newUser()
      const details = 'Sent the same link four times after I asked them to stop.'
      emailSender.messages.length = 0

      const response = await post(reporter, '/reports', {
        userId: target.userId,
        reason: 'spam',
        details,
      })
      expect(response.statusCode, response.body).toBe(201)

      const mail = reportMails().at(-1)
      expect(reportMails()).toHaveLength(1)
      expect(mail?.to).toBe(SUPPORT)
      expect(mail?.subject).toContain('Report: spam')
      expect(mail?.subject).not.toContain('XP FROZEN')
      expect(mail?.text).toContain(details)
      expect(mail?.text).toContain(reporter.userId)
      expect(mail?.text).toContain(target.userId)
    })

    it('says in the subject when this is the report that froze them', async () => {
      const target = await newUser()
      emailSender.messages.length = 0

      for (let i = 0; i < REPORTS_TO_FREEZE_XP; i++) {
        const reporter = await newUser()
        await post(reporter, '/reports', { userId: target.userId, reason: 'harassment' })
      }

      const subjects = reportMails().map((mail) => mail.subject)
      expect(subjects).toHaveLength(REPORTS_TO_FREEZE_XP)
      expect(subjects.slice(0, -1).some((subject) => subject.includes('XP FROZEN'))).toBe(false)
      expect(subjects.at(-1)?.startsWith('[XP FROZEN] ')).toBe(true)
    })

    it('still files the report when the mail fails', async () => {
      const reporter = await newUser()
      const target = await newUser()
      vi.spyOn(emailSender, 'send').mockRejectedValueOnce(new Error('the mail provider is down'))

      const response = await post(reporter, '/reports', {
        userId: target.userId,
        reason: 'fake_profile',
      })

      expect(response.statusCode, response.body).toBe(201)
      const stored = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ reporterId: reporter.userId, reportedId: target.userId })
      expect(stored?.status).toBe('open')
      vi.restoreAllMocks()
    })

    it('refuses a self-report', async () => {
      const a = await newUser()
      expect((await post(a, '/reports', { userId: a.userId, reason: 'spam' })).statusCode).toBe(400)
    })

    /**
     * Reports raised from the chat menu point at one message. A reviewer
     * opening a report of "harassment" against someone with two hundred
     * messages otherwise has nowhere to start.
     */
    it('keeps the message a report was raised from', async () => {
      const reporter = await newUser()
      const target = await newUser()
      const started = await startConversation(reporter, target.userId, 'hello there')
      const conversationId = started.json<{ _id: string }>()._id
      const messages = await get(reporter, `/conversations/${conversationId}/messages`)
      const messageId = messages.json<{ items: { _id: string }[] }>().items[0]?._id

      const response = await post(reporter, '/reports', {
        userId: target.userId,
        reason: 'harassment',
        conversationId,
        messageId,
      })
      expect(response.statusCode, response.body).toBe(201)

      const stored = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ reporterId: reporter.userId, reportedId: target.userId })
      expect(stored?.messageId?.toString()).toBe(messageId)
      expect(stored?.conversationId?.toString()).toBe(conversationId)
    })

    it('keeps the post a report was raised from', async () => {
      const reporter = await newUser()
      const target = await newUser()
      // Existence is not checked, as it is not for a message: a post deleted
      // between reading and reporting is still worth the reviewer's look.
      const postId = new ObjectId().toString()

      const response = await post(reporter, '/reports', {
        userId: target.userId,
        reason: 'inappropriate_content',
        postId,
      })
      expect(response.statusCode, response.body).toBe(201)

      const stored = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ reporterId: reporter.userId, reportedId: target.userId })
      expect(stored?.postId?.toString()).toBe(postId)
      expect(stored?.conversationId).toBeUndefined()
    })

    it('still accepts a report raised from a profile, with neither pointer', async () => {
      const reporter = await newUser()
      const target = await newUser()
      const response = await post(reporter, '/reports', { userId: target.userId, reason: 'spam' })
      expect(response.statusCode, response.body).toBe(201)

      const stored = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ reporterId: reporter.userId, reportedId: target.userId })
      expect(stored?.messageId).toBeUndefined()
      expect(stored?.conversationId).toBeUndefined()
    })
  })

  describe('profile views and incognito', () => {
    /**
     * The question Behic asked of the existing toggle: it works, and it only
     * ever did this. Hiding your online status is `privacy.hideOnlineStatus`
     * and has no effect here — pinned so neither flag quietly grows into the
     * other's job.
     */
    it('records a profile view even when the viewer hides their online status', async () => {
      const viewer = await newUser()
      const viewed = await newUser()
      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: viewer.userId },
        {
          $set: {
            entitlement: { tier: 'pro_plus', updatedAt: new Date() },
            'privacy.hideOnlineStatus': true,
          },
        },
      )

      await get(viewer, `/profiles/${viewed.userId}`)
      const views = await handle.db
        .collection(COLLECTIONS.profileViews)
        .countDocuments({ viewedId: viewed.userId })
      expect(views).toBe(1)
    })

    it('records one row per viewer however many times they look', async () => {
      const viewer = await newUser()
      const viewed = await newUser()
      await get(viewer, `/profiles/${viewed.userId}`)
      await get(viewer, `/profiles/${viewed.userId}`)
      await get(viewer, `/profiles/${viewed.userId}`)

      const viewers = (await get(viewed, '/me/viewers')).json<{ total: number; locked: boolean }>()
      expect(viewers.total).toBe(1)
    })

    /**
     * The new tier boundary, pinned. Seeing who looked moved from Fluent to
     * Polyglot, and a Fluent subscriber getting identities would be the guard
     * silently not applying rather than the boundary working.
     */
    it('gives a Fluent subscriber the count but not the identities', async () => {
      const viewer = await newUser()
      const viewed = await newUser()
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: viewed.userId },
          { $set: { entitlement: { tier: 'pro', updatedAt: new Date() } } },
        )

      await app.inject({
        method: 'GET',
        url: `/profiles/${viewed.userId}`,
        headers: { cookie: viewer.cookie },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/me/viewers',
        headers: { cookie: viewed.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{
        total: number
        locked: boolean
        viewers: { userId: string; handle?: string; displayName?: string; viewCount: number }[]
      }>()
      // The count is the paywall's argument, so it is still real.
      expect(body.total).toBe(1)
      expect(body.locked).toBe(true)
      /*
       * The row is returned so the list can be drawn and blurred; the identity
       * is not in it. This is the assertion that keeps the paid feature out of
       * the response body — blurring on the client would leave it readable to
       * anyone who opens the JSON.
       */
      expect(body.viewers).toHaveLength(1)
      expect(body.viewers[0]?.handle).toBeUndefined()
      expect(body.viewers[0]?.displayName).toBeUndefined()
      expect(body.viewers[0]?.viewCount).toBe(1)
    })

    it('counts a returning viewer as one row per day, and a burst of views as one visit', async () => {
      const viewer = await newUser()
      const viewed = await newUser()
      // Three views inside a minute, one pair, one day: `viewer_viewed_day_unique`
      // makes this one row, and the session gap makes it one visit.
      await get(viewer, `/profiles/${viewed.userId}`)
      await get(viewer, `/profiles/${viewed.userId}`)
      await get(viewer, `/profiles/${viewed.userId}`)

      const body = (await get(viewed, '/me/viewers')).json<{
        total: number
        viewers: { viewCount: number; day: string }[]
        week?: { day: string; visits: number }[]
      }>()
      expect(body.total).toBe(1)
      expect(body.viewers).toHaveLength(1)
      expect(body.viewers[0]?.viewCount).toBe(1)
      expect(body.viewers[0]?.day).toBe(new Date().toISOString().slice(0, 10))
      // The week chart on the first page: today has the one visit.
      expect(body.week).toHaveLength(7)
      expect(body.week?.at(-1)?.visits).toBe(1)
    })

    it('gives free users the count and Pro users the identities', async () => {
      const viewer = await newUser()
      const viewed = await newUser()
      await get(viewer, `/profiles/${viewed.userId}`)

      const free = (await get(viewed, '/me/viewers')).json<{
        total: number
        viewers: { handle?: string; displayName?: string; avatarUrl?: string }[]
        locked: boolean
      }>()
      expect(free.total).toBe(1)
      expect(free.locked).toBe(true)
      expect(free.viewers).toHaveLength(1)
      expect(free.viewers[0]).not.toHaveProperty('handle')
      expect(free.viewers[0]).not.toHaveProperty('displayName')
      expect(free.viewers[0]).not.toHaveProperty('avatarUrl')

      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: viewed.userId },
        {
          $set: {
            entitlement: {
              tier: 'pro_plus',
              expiresAt: new Date(Date.now() + 86_400_000),
              updatedAt: new Date(),
            },
          },
        },
      )
      const pro = (await get(viewed, '/me/viewers')).json<{
        viewers: { userId: string }[]
        locked: boolean
      }>()
      expect(pro.locked).toBe(false)
      expect(pro.viewers[0]?.userId).toBe(viewer.userId)
    })

    it('leaves no trace when a Pro user browses incognito', async () => {
      const ghost = await newUser()
      const viewed = await newUser()
      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: ghost.userId },
        {
          $set: {
            entitlement: {
              tier: 'pro_plus',
              expiresAt: new Date(Date.now() + 86_400_000),
              updatedAt: new Date(),
            },
            'privacy.incognito': true,
          },
        },
      )

      await get(ghost, `/profiles/${viewed.userId}`)
      expect((await get(viewed, '/me/viewers')).json<{ total: number }>().total).toBe(0)
    })

    /**
     * Was a hard `.limit(100)` with no way past it, beside a `total` counting
     * everyone — so a Pro user with 150 viewers saw a list that contradicted
     * the number printed above it.
     */
    it('pages the viewer list without repeating or skipping, and counts everyone', async () => {
      const viewed = await newUser()
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: viewed.userId },
          { $set: { entitlement: { tier: 'pro_plus', updatedAt: new Date() } } },
        )

      const lookers = []
      for (let i = 0; i < 5; i++) {
        const looker = await newUser()
        await get(looker, `/profiles/${viewed.userId}`)
        lookers.push(looker.userId)
      }

      const seen: string[] = []
      let cursor: string | null = null
      let pages = 0
      do {
        const suffix: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
        const page = await get(viewed, `/me/viewers?limit=2${suffix}`)
        expect(page.statusCode, page.body).toBe(200)
        const body = page.json<{
          total: number
          viewers: { userId: string }[]
          nextCursor: string | null
        }>()
        // The count is over everyone, not over the page — it is what the free
        // tier is shown and what the paywall argues about.
        expect(body.total).toBe(5)
        seen.push(...body.viewers.map((v) => v.userId))
        cursor = body.nextCursor
        pages++
      } while (cursor && pages < 10)

      expect(seen).toHaveLength(5)
      expect(new Set(seen)).toEqual(new Set(lookers))
    })

    it('never hands a free user a cursor to page with', async () => {
      const viewed = await newUser()
      const looker = await newUser()
      await get(looker, `/profiles/${viewed.userId}`)

      const body = (await get(viewed, '/me/viewers')).json<{
        locked: boolean
        nextCursor: string | null
      }>()
      expect(body.locked).toBe(true)
      expect(body.nextCursor).toBeNull()
    })

    it('does not honour incognito for a free user — it is a Pro capability', async () => {
      const pretender = await newUser()
      const viewed = await newUser()
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: pretender.userId }, { $set: { 'privacy.incognito': true } })

      await get(pretender, `/profiles/${viewed.userId}`)
      expect((await get(viewed, '/me/viewers')).json<{ total: number }>().total).toBe(1)
    })
  })

  describe('account deletion and export', () => {
    it('hides the account immediately and kills every session', async () => {
      const leaving = await newUser({
        nativeLanguages: [{ code: 'pt' }],
        learning: [{ code: 'nl', level: 'intermediate', priority: 1 }],
      })
      const observer = await newUser({
        nativeLanguages: [{ code: 'nl' }],
        learning: [{ code: 'pt', level: 'intermediate', priority: 1 }],
      })
      expect((await get(observer, `/profiles/${leaving.userId}`)).statusCode).toBe(200)

      const deleted = await post(leaving, '/me/delete', { confirm: 'DELETE' })
      expect(deleted.statusCode, deleted.body).toBe(200)
      const status = deleted.json<AccountDeletionStatus>()
      expect(status.pending).toBe(true)
      expect(new Date(status.purgeAt!).getTime() - new Date(status.deletedAt!).getTime()).toBe(
        ACCOUNT_DELETION_GRACE_DAYS * 86_400_000,
      )

      // Gone from the product at once...
      expect((await get(observer, `/profiles/${leaving.userId}`)).statusCode).toBe(404)
      // ...and the session no longer works.
      expect((await get(leaving, '/profiles/me')).statusCode).toBe(401)
    })

    it('keeps the data through the grace period and removes it after', async () => {
      const leaving = await newUser()
      const partner = await newUser()
      await startConversation(leaving, partner.userId, 'last words')
      await awardTokens(handle.db, {
        userId: leaving.userId,
        kind: 'adjustment',
        amount: 10,
        refId: 'bye',
      })
      const userId = leaving.userId

      await post(leaving, '/me/delete', { confirm: 'DELETE' })

      // Day 29: still recoverable.
      const almost = await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS - 1) * 86_400_000),
      })
      expect(almost.userIds).not.toContain(userId)
      expect(
        await handle.db.collection(COLLECTIONS.profiles).countDocuments({ _id: userId as never }),
      ).toBe(1)

      // Day 31: gone.
      const purged = await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
      })
      expect(purged.userIds).toContain(userId)

      for (const collection of [
        COLLECTIONS.profiles,
        COLLECTIONS.tokenLedger,
        COLLECTIONS.tokenAggregates,
        COLLECTIONS.devices,
        COLLECTIONS.user,
        COLLECTIONS.session,
      ]) {
        // Better Auth's collections key on ObjectId, ours on the string form —
        // see lib/authId.ts for why that distinction is load-bearing here.
        const filter =
          collection === COLLECTIONS.profiles
            ? { _id: userId as never }
            : collection === COLLECTIONS.user
              ? { _id: new ObjectId(userId) as never }
              : collection === COLLECTIONS.session
                ? { userId: new ObjectId(userId) }
                : { userId }
        expect(
          await handle.db.collection(collection).countDocuments(filter),
          `${collection} still holds the purged user`,
        ).toBe(0)
      }

      // The other party's conversation survives, with the body cleared.
      const message = await handle.db
        .collection<{ body: string; deletedWithAccount?: boolean }>(COLLECTIONS.messages)
        .findOne({ senderId: userId })
      expect(message?.body).toBe('')
      expect(message?.deletedWithAccount).toBe(true)

      /*
       * The one thing the purge leaves behind on purpose: what it still owes
       * PostHog. Every row above is gone, so this is now the only record that
       * the account existed at all — and it holds the *string* id, which is
       * the distinct id the app identified with. The ObjectId form would match
       * nothing at PostHog and report success doing it.
       */
      const owed = await handle.db
        .collection(COLLECTIONS.analyticsDeletions)
        .findOne({ _id: userId as never })
      expect(owed, 'the purge recorded no analytics deletion').not.toBeNull()
    })

    /**
     * The chat list reads `lastMessage.body` verbatim and nothing ever
     * recomputed it, so blanking a purged user's messages used to leave their
     * last sentence sitting in the other person's list — the exact text the
     * purge exists to remove.
     */
    it('clears the purged user last sentence out of the other person chat list', async () => {
      const leaving = await newUser()
      const staying = await newUser()

      const started = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { cookie: leaving.cookie },
        payload: { toUserId: staying.userId, body: 'something they should not keep seeing' },
      })
      expect(started.statusCode, started.body).toBe(201)

      await post(leaving, '/me/delete', { confirm: 'DELETE' })
      await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
      })

      const conversation = await handle.db
        .collection<{ lastMessage: { body: string; deleted?: boolean } }>(COLLECTIONS.conversations)
        .findOne({ participants: staying.userId })
      expect(conversation?.lastMessage.body).toBe('')
      expect(conversation?.lastMessage.deleted).toBe(true)
    })

    it('removes the images from storage, and never touches an object it does not own', async () => {
      const user = await newUser()
      const deleted: string[] = []
      // A storage double: the real provider needs credentials, and what is
      // under test is which keys the purge asks for, not S3 itself.
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('unused')),
        putObject: () => Promise.resolve(''),
        deleteObject: (key: string) => {
          deleted.push(key)
          return Promise.resolve()
        },
        keyFromPublicUrl: (url: string) =>
          url.startsWith('https://cdn.example.com/')
            ? url.slice('https://cdn.example.com/'.length)
            : null,
      }

      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: user.userId },
        {
          $set: {
            avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
            photos: [
              { url: 'https://cdn.example.com/photos/1.jpg', createdAt: new Date() },
              // Not ours. The purge must leave it alone rather than guess a key.
              { url: 'https://someone-else.example.net/2.jpg', createdAt: new Date() },
            ],
          },
        },
      )

      await post(user, '/me/delete', { confirm: 'DELETE' })
      const result = await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
        storage,
      })

      expect(result.userIds).toContain(user.userId)
      expect(deleted).toEqual(['avatars/a.jpg', 'photos/1.jpg'])
      expect(result.objectsDeleted).toBe(2)
    })

    it('deletes attachments they sent, and clears the reference so nothing renders broken', async () => {
      const me = await newUser()
      const partner = await newUser()
      const started = await startConversation(me, partner.userId, 'here is a photo')
      const conversationId = started.json<{ _id: string }>()._id

      // An attachment needs the other person to have written back — see
      // `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES`. This test is about the purge,
      // not the gate, so the partner talks the gate open first.
      const { sendMediaMessage, sendTextMessage } = await import('../modules/chat/messages')
      for (let sent = 1; sent <= MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES; sent++) {
        await sendTextMessage(handle.db, partner.userId, { conversationId, body: `filler ${sent}` })
      }

      await sendMediaMessage(
        handle.db,
        me.userId,
        {
          conversationId,
          attachments: [
            {
              url: 'https://cdn.example.com/messages/c/x.jpg',
              contentType: 'image/jpeg',
              sizeBytes: 500,
            },
          ],
        },
        'https://cdn.example.com',
      )

      const deleted: string[] = []
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('unused')),
        putObject: () => Promise.resolve(''),
        deleteObject: (key: string) => {
          deleted.push(key)
          return Promise.resolve()
        },
        keyFromPublicUrl: (url: string) =>
          url.startsWith('https://cdn.example.com/')
            ? url.slice('https://cdn.example.com/'.length)
            : null,
      }

      await post(me, '/me/delete', { confirm: 'DELETE' })
      await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
        storage,
      })

      expect(deleted).toContain('messages/c/x.jpg')
      // The row survives — it is half of the other person's conversation —
      // but with no reference to an object that no longer exists.
      const row = await handle.db
        .collection<{ media?: unknown; deletedWithAccount?: boolean }>(COLLECTIONS.messages)
        .findOne({ senderId: me.userId, type: 'image' })
      expect(row?.deletedWithAccount).toBe(true)
      expect(row?.media).toBeUndefined()
    })

    it('purges even when storage is unavailable, leaving an orphaned file rather than an account', async () => {
      const user = await newUser()
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('unused')),
        putObject: () => Promise.resolve(''),
        deleteObject: () => Promise.reject(new Error('bucket unreachable')),
        deleteByPrefix: () => Promise.reject(new Error('bucket unreachable')),
        keyFromPublicUrl: () => 'avatars/x.jpg',
      }
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: user.userId },
          { $set: { avatarUrl: 'https://cdn.example.com/avatars/x.jpg' } },
        )

      await post(user, '/me/delete', { confirm: 'DELETE' })
      const result = await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
        storage,
      })

      // The account is gone even though the file could not be removed — an
      // account that can never be purged is the worse failure.
      expect(result.userIds).toContain(user.userId)
      expect(result.objectsDeleted).toBe(0)
      expect(
        await handle.db
          .collection(COLLECTIONS.profiles)
          .countDocuments({ _id: user.userId as never }),
      ).toBe(0)
    })

    /**
     * The one kind of file no row points at. A bug report is written to no
     * collection of ours, so the URL-by-URL sweep the rest of this describe
     * exercises cannot reach its attachments — the prefix the upload chose is
     * the only handle left, and until now nothing used it.
     */
    it("sweeps the bug reports nothing else can find, and only the purged account's", async () => {
      const user = await newUser()
      const objects = new Set([
        `feedback/${user.userId}/report.jpg`,
        `feedback/${user.userId}/second.png`,
        'feedback/somebody-else/theirs.jpg',
      ])
      const prefixes: string[] = []
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('unused')),
        putObject: () => Promise.resolve(''),
        deleteObject: () => Promise.resolve(),
        deleteByPrefix: (prefix: string) => {
          prefixes.push(prefix)
          let deleted = 0
          for (const key of objects) {
            if (!key.startsWith(prefix)) continue
            objects.delete(key)
            deleted++
          }
          return Promise.resolve(deleted)
        },
        keyFromPublicUrl: () => null,
      }

      await post(user, '/me/delete', { confirm: 'DELETE' })
      const result = await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
        storage,
      })

      // `toContain`, not `toEqual`: another account expiring in the same run
      // is a legitimate second prefix. What must be exact is which objects
      // survive.
      expect(prefixes).toContain(`feedback/${user.userId}/`)
      expect(result.objectsDeleted).toBe(2)
      // Somebody else's report is not swept by a prefix that ends in a slash.
      expect([...objects]).toEqual(['feedback/somebody-else/theirs.jpg'])
    })

    /**
     * A share card is a public `/s/<id>` page about a person. The image was
     * always reachable by URL and the row always answered for it, so leaving
     * either behind keeps a profile fragment up after the profile is gone.
     */
    it('deletes the share cards, both the image and the row', async () => {
      const user = await newUser()
      await handle.db.collection(COLLECTIONS.shareCards).insertOne({
        _id: 'cardid' as never,
        userId: user.userId,
        kind: 'streak',
        shape: 'story',
        imageUrl: `https://cdn.example.com/cards/${user.userId}/cardid.png`,
        headline: 'a hundred days',
        caption: 'on LangX',
        handle: 'someone',
        createdAt: new Date(),
      })

      const deleted: string[] = []
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('unused')),
        putObject: () => Promise.resolve(''),
        deleteObject: (key: string) => {
          deleted.push(key)
          return Promise.resolve()
        },
        keyFromPublicUrl: (url: string) =>
          url.startsWith('https://cdn.example.com/')
            ? url.slice('https://cdn.example.com/'.length)
            : null,
      }

      await post(user, '/me/delete', { confirm: 'DELETE' })
      await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
        storage,
      })

      expect(deleted).toContain(`cards/${user.userId}/cardid.png`)
      expect(
        await handle.db.collection(COLLECTIONS.shareCards).countDocuments({ userId: user.userId }),
      ).toBe(0)
    })

    /**
     * Listing objects is a capability a provider may not have — the
     * unconfigured one has none at all. The purge asks before it calls, and
     * an account whose reports outlive it is still better than one that
     * cannot be deleted.
     */
    it('purges with a provider that cannot list objects', async () => {
      const user = await newUser()
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('unused')),
        putObject: () => Promise.resolve(''),
        deleteObject: () => Promise.resolve(),
        keyFromPublicUrl: () => null,
      }

      await post(user, '/me/delete', { confirm: 'DELETE' })
      const result = await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
        storage,
      })

      expect(result.userIds).toContain(user.userId)
    })

    it('keeps the token ledger as an anonymous audit trail but drops the aggregates', async () => {
      const user = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 42,
        refId: 'audit-me',
      })
      const userId = user.userId

      await post(user, '/me/delete', { confirm: 'DELETE' })
      await purgeExpiredAccounts(handle.db, {
        now: new Date(Date.now() + (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
      })

      // Nothing left under their id...
      expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({ userId })).toBe(0)
      // ...but the row itself survives, re-keyed to an id stored nowhere else,
      // so the economy still reconciles and the row identifies no one.
      const row = await handle.db
        .collection<{ userId: string; amount: number }>(COLLECTIONS.tokenLedger)
        .findOne({ refId: 'audit-me' })
      expect(row?.amount).toBe(42)
      expect(row?.userId).toMatch(/^deleted:/)
      expect(row?.userId).not.toContain(userId)

      // The aggregates go, which is what removes them from every leaderboard.
      expect(
        await handle.db.collection(COLLECTIONS.tokenAggregates).countDocuments({ userId }),
      ).toBe(0)
    })

    it('cancels a pending deletion', async () => {
      const user = await newUser()
      await post(user, '/me/delete', { confirm: 'DELETE' })
      // The session died with the request, so sign in again — which is exactly
      // the gesture the product treats as "I changed my mind".
      const signIn = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: `faz10-${seq}@example.com`, password: PASSWORD },
      })
      expect(signIn.statusCode).toBe(200)
      const cookie = (signIn.headers['set-cookie'] as string[] | string).toString().split(';')[0]!

      const cancelled = await app.inject({
        method: 'POST',
        url: '/me/delete/cancel',
        headers: { cookie },
      })
      expect(cancelled.statusCode, cancelled.body).toBe(200)
      expect(cancelled.json<AccountDeletionStatus>().pending).toBe(false)
    })

    it('refuses a delete without the typed confirmation', async () => {
      const user = await newUser()
      expect((await post(user, '/me/delete', { confirm: 'yes' })).statusCode).toBe(400)
    })

    it('exports the user own data and nobody else messages', async () => {
      const me = await newUser()
      const partner = await newUser()
      const conversation = await startConversation(me, partner.userId, 'mine')
      const conversationId = conversation.json<{ _id: string }>()._id
      // The partner replies — their words must not be in my export.
      const { sendTextMessage } = await import('../modules/chat/messages')
      await sendTextMessage(handle.db, partner.userId, { conversationId, body: 'theirs' })

      const response = await get(me, '/me/export')
      expect(response.statusCode).toBe(200)
      expect(response.headers['content-disposition']).toContain('langx-export.json')

      const data = response.json<DataExport>()
      const bodies = (data.messages as { body: string }[]).map((m) => m.body)
      expect(bodies).toContain('mine')
      expect(bodies).not.toContain('theirs')
      expect(data.conversations).toHaveLength(1)
      expect(data.profile).toBeTruthy()
    })
  })

  /**
   * Suspension, end to end from the link in the report email.
   *
   * There is no admin route to drive here, which is the design: the decision
   * happens in the mailbox the report already arrives in.
   */
  describe('suspension', () => {
    /** The `Review:` line the report mail carries, as a path this app can be injected with. */
    function reviewPathFrom(text: string): string {
      const match = /Review: (\S+)/.exec(text)
      if (!match?.[1]) throw new Error(`no review link in mail:\n${text}`)
      const url = new URL(match[1])
      return `${url.pathname}${url.search}`
    }

    function appealPathFrom(text: string): string {
      const match = /Decide: (\S+)/.exec(text)
      if (!match?.[1]) throw new Error(`no appeal link in mail:\n${text}`)
      const url = new URL(match[1])
      return `${url.pathname}${url.search}`
    }

    /** The review page's own form post — no session, only the token in the URL. */
    function decide(path: string, fields: Record<string, string>) {
      return app.inject({
        method: 'POST',
        url: path,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams(fields).toString(),
      })
    }

    /** Reports `target`, and hands back the link the mail carries. */
    async function reportAndReviewPath(target: SignedUpUser, reason = 'harassment') {
      const reporter = await newUser()
      emailSender.messages.length = 0
      const response = await post(reporter, '/reports', { userId: target.userId, reason })
      expect(response.statusCode, response.body).toBe(201)
      const mail = reportMails().at(-1)
      if (!mail) throw new Error('no report mail')
      return { path: reviewPathFrom(mail.text), reporter }
    }

    /** Someone a `tr`-native viewer learning `en` is a mutual fit for. */
    const mirrored = () => ({
      nativeLanguages: [{ code: 'en' }],
      learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
    })

    async function handleOf(userId: string): Promise<string> {
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: userId })
      if (!profile) throw new Error('no profile')
      return profile.handle
    }

    it('suspends for a number of days, and closes every door but two', async () => {
      const viewer = await newUser()
      const target = await newUser(mirrored())
      // Paid, so the boosted strip would otherwise carry them.
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: target.userId }, { $set: { 'entitlement.tier': 'pro_plus' } })
      const targetHandle = await handleOf(target.userId)

      const before = await get(viewer, `/discovery/handles?q=${targetHandle}`)
      expect(before.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)).toContain(
        targetHandle,
      )

      const { path } = await reportAndReviewPath(target)
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(200)
      const decided = await decide(path, { action: 'suspend', days: '3' })
      expect(decided.statusCode, decided.body).toBe(200)

      const report = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ reportedId: target.userId })
      expect(report?.status).toBe('actioned')

      // Every ordinary route, refused with the end date on the body.
      const me = await get(target, '/profiles/me')
      expect(me.statusCode).toBe(403)
      const body = me.json<{ code: string; until: string; permanent: boolean }>()
      expect(body.code).toBe('ACCOUNT_SUSPENDED')
      expect(body.permanent).toBe(false)
      expect(new Date(body.until).getTime()).toBeGreaterThan(Date.now())

      // The two that stay open.
      const status = await get(target, '/me/suspension')
      expect(status.statusCode, status.body).toBe(200)
      expect(status.json()).toMatchObject({
        suspended: true,
        permanent: false,
        reason: 'harassment',
        appealedAt: null,
        until: body.until,
      })

      // And they are gone from everywhere anybody browses.
      const search = await get(viewer, `/discovery/handles?q=${targetHandle}`)
      expect(
        search.json<{ items: { handle: string }[] }>().items.map((i) => i.handle),
      ).not.toContain(targetHandle)
      const list = await get(viewer, '/discovery')
      expect(list.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)).not.toContain(
        targetHandle,
      )
      const strip = await get(viewer, '/discovery/boosted')
      expect(
        strip.json<{ items: { handle: string }[] }>().items.map((i) => i.handle),
      ).not.toContain(targetHandle)
      // The signed-out link is closed too.
      expect(
        (await app.inject({ method: 'GET', url: `/public/profiles/${targetHandle}` })).statusCode,
      ).toBe(404)
    })

    it('suspends permanently, and says so rather than printing the sentinel', async () => {
      const target = await newUser()
      const { path } = await reportAndReviewPath(target, 'hate_speech')
      expect((await decide(path, { action: 'permanent' })).statusCode).toBe(200)

      const status = await get(target, '/me/suspension')
      expect(status.json()).toMatchObject({ suspended: true, permanent: true, until: null })

      const refused = await get(target, '/profiles/me')
      expect(refused.json<{ permanent: boolean; until: string | null }>()).toMatchObject({
        code: 'ACCOUNT_SUSPENDED',
        permanent: true,
        until: null,
      })

      const stored = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: target.userId })
      expect(stored?.suspension?.until.getUTCFullYear()).toBe(9999)
    })

    /**
     * The whole reason expiry needs no cron: nothing runs, nothing is unset,
     * and the account simply works again the moment the date passes.
     */
    it('lets an expired suspension lapse with nothing unset', async () => {
      const viewer = await newUser()
      const target = await newUser(mirrored())
      const targetHandle = await handleOf(target.userId)
      const { path } = await reportAndReviewPath(target)
      expect((await decide(path, { action: 'suspend', days: '3' })).statusCode).toBe(200)
      expect((await get(target, '/profiles/me')).statusCode).toBe(403)

      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: target.userId },
          { $set: { 'suspension.until': new Date(Date.now() - 1000) } },
        )

      expect((await get(target, '/profiles/me')).statusCode).toBe(200)
      expect((await get(target, '/me/suspension')).json()).toMatchObject({ suspended: false })
      const search = await get(viewer, `/discovery/handles?q=${targetHandle}`)
      expect(search.json<{ items: { handle: string }[] }>().items.map((i) => i.handle)).toContain(
        targetHandle,
      )
      // Still on the document — nothing swept it, and nothing had to.
      const stored = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: target.userId })
      expect(stored?.suspension).toBeDefined()
    })

    it('dismisses a report without touching the account', async () => {
      const target = await newUser()
      const { path } = await reportAndReviewPath(target)
      expect((await decide(path, { action: 'dismiss' })).statusCode).toBe(200)

      const report = await handle.db
        .collection<Report>(COLLECTIONS.reports)
        .findOne({ reportedId: target.userId })
      expect(report?.status).toBe('dismissed')
      const stored = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: target.userId })
      expect(stored?.suspension).toBeUndefined()
      expect((await get(target, '/profiles/me')).statusCode).toBe(200)
    })

    it('takes one appeal, refuses the second, and lets the answer lift it', async () => {
      const target = await newUser()
      const { path } = await reportAndReviewPath(target)
      expect((await decide(path, { action: 'suspend', days: '30' })).statusCode).toBe(200)

      emailSender.messages.length = 0
      const text = 'I was reported for a screenshot that is not mine. Please look again.'
      const first = await post(target, '/me/suspension/appeal', { text })
      expect(first.statusCode, first.body).toBe(202)

      const appealMail = emailSender.messages.find((m) => m.subject.startsWith('Appeal from'))
      expect(appealMail?.to).toBe(SUPPORT)
      expect(appealMail?.text).toContain(text)

      const second = await post(target, '/me/suspension/appeal', { text })
      expect(second.statusCode).toBe(400)
      expect(second.json<{ code: string }>().code).toBe('VALIDATION_FAILED')
      expect(
        (await get(target, '/me/suspension')).json<{ appealedAt: string | null }>().appealedAt,
      ).not.toBeNull()

      const appealPath = appealPathFrom(appealMail?.text ?? '')
      expect((await app.inject({ method: 'GET', url: appealPath })).statusCode).toBe(200)

      // Shorten first, then lift, so both halves of the appeal link are exercised.
      expect((await decide(appealPath, { action: 'shorten', days: '1' })).statusCode).toBe(200)
      const shortened = await get(target, '/me/suspension')
      const until = shortened.json<{ until: string }>().until
      expect(new Date(until).getTime()).toBeLessThan(Date.now() + 2 * 24 * 60 * 60 * 1000)

      expect((await decide(appealPath, { action: 'lift' })).statusCode).toBe(200)
      expect((await get(target, '/profiles/me')).statusCode).toBe(200)
      const stored = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: target.userId })
      expect(stored?.suspension).toBeUndefined()
    })

    it('refuses a bad token, and a report link that reaches for an appeal action', async () => {
      const target = await newUser()
      const { path } = await reportAndReviewPath(target)

      expect(
        (await app.inject({ method: 'GET', url: '/moderation/review?token=nonsense' })).statusCode,
      ).toBe(400)
      expect(
        (await decide('/moderation/review?token=nonsense', { action: 'dismiss' })).statusCode,
      ).toBe(400)

      /*
       * The token names the report; the kind names what may be done with it.
       * Both are checked, so the link in a report mail cannot lift a
       * suspension it was never shown.
       */
      const crossed = await decide(path, { action: 'lift' })
      expect(crossed.statusCode).toBe(400)
      const stored = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: target.userId })
      expect(stored?.suspension).toBeUndefined()
    })

    it('requires a number of days for a suspension that is not permanent', async () => {
      const target = await newUser()
      const { path } = await reportAndReviewPath(target)
      expect((await decide(path, { action: 'suspend' })).statusCode).toBe(400)
      expect((await decide(path, { action: 'suspend', days: '400' })).statusCode).toBe(400)
    })
  })

  describe('push registration', () => {
    it('moves a token to whoever registered it last', async () => {
      const first = await newUser()
      const second = await newUser()
      const token = 'ExponentPushToken[shared-device]'

      expect(
        (await post(first, '/me/devices', { pushToken: token, platform: 'ios' })).statusCode,
      ).toBe(204)
      expect(
        (await post(second, '/me/devices', { pushToken: token, platform: 'ios' })).statusCode,
      ).toBe(204)

      const devices = await handle.db
        .collection<{ userId: string }>(COLLECTIONS.devices)
        .find({ pushToken: token })
        .toArray()
      expect(devices).toHaveLength(1)
      expect(devices[0]?.userId).toBe(second.userId)
    })
  })
})
