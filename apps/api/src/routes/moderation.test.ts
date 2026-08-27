import {
  ACCOUNT_DELETION_GRACE_DAYS,
  REPORTS_TO_FREEZE_XP,
  type AccountDeletionStatus,
  type DataExport,
  type Leaderboard,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
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
        birthYear: 1995,
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'B1', priority: 1 }],
        ...overrides,
      },
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

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

  describe('a blocked user is absent from every list', () => {
    it('drops out of discovery, the conversation list, the leaderboard and their profile 404s', async () => {
      // Mutual language fit, so they would otherwise see each other.
      const me = await newUser({
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'B1', priority: 1 }],
      })
      const them = await newUser({
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'B1', priority: 1 }],
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
        learning: [{ code: 'fr', level: 'B1', priority: 1 }],
      })
      const blocked = await newUser({
        nativeLanguages: [{ code: 'fr' }],
        learning: [{ code: 'de', level: 'B1', priority: 1 }],
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
      expect((await get(a, '/blocks')).json<{ items: unknown[] }>().items).toHaveLength(1)

      const removed = await app.inject({
        method: 'DELETE',
        url: `/blocks/${b.userId}`,
        headers: { cookie: a.cookie },
      })
      expect(removed.statusCode).toBe(204)
      expect((await get(a, '/blocks')).json<{ items: unknown[] }>().items).toHaveLength(0)
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
        learning: [{ code: 'it', level: 'B1', priority: 1 }],
      })
      const other = await newUser({
        nativeLanguages: [{ code: 'it' }],
        learning: [{ code: 'es', level: 'B1', priority: 1 }],
      })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: frozen.userId }, { $set: { tokenFrozenAt: new Date() } })

      const started = await startConversation(frozen, other.userId, 'still talking')
      expect(started.statusCode).toBe(201) // the message went through

      const summary = await get(frozen, '/me/tokens')
      expect(summary.json<{ tokens: { all: number } }>().tokens.all).toBe(0) // but paid nothing
      // Activity is still recorded, so a reviewer clearing the freeze can reconcile.
      expect(summary.json<{ today: { messages: number } }>().today.messages).toBe(1)
    })

    it('refuses a self-report', async () => {
      const a = await newUser()
      expect((await post(a, '/reports', { userId: a.userId, reason: 'spam' })).statusCode).toBe(400)
    })
  })

  describe('profile views and incognito', () => {
    it('records one row per viewer however many times they look', async () => {
      const viewer = await newUser()
      const viewed = await newUser()
      await get(viewer, `/profiles/${viewed.userId}`)
      await get(viewer, `/profiles/${viewed.userId}`)
      await get(viewer, `/profiles/${viewed.userId}`)

      const viewers = (await get(viewed, '/me/viewers')).json<{ total: number; locked: boolean }>()
      expect(viewers.total).toBe(1)
    })

    it('gives free users the count and Pro users the identities', async () => {
      const viewer = await newUser()
      const viewed = await newUser()
      await get(viewer, `/profiles/${viewed.userId}`)

      const free = (await get(viewed, '/me/viewers')).json<{
        total: number
        viewers: unknown[]
        locked: boolean
      }>()
      expect(free.total).toBe(1)
      expect(free.locked).toBe(true)
      expect(free.viewers).toHaveLength(0)

      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: viewed.userId },
        {
          $set: {
            entitlement: {
              tier: 'pro',
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
              tier: 'pro',
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
        learning: [{ code: 'nl', level: 'B1', priority: 1 }],
      })
      const observer = await newUser({
        nativeLanguages: [{ code: 'nl' }],
        learning: [{ code: 'pt', level: 'B1', priority: 1 }],
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

    it('purges even when storage is unavailable, leaving an orphaned file rather than an account', async () => {
      const user = await newUser()
      const storage = {
        getUploadUrl: () => Promise.reject(new Error('unused')),
        putObject: () => Promise.resolve(''),
        deleteObject: () => Promise.reject(new Error('bucket unreachable')),
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
