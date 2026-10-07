import {
  ADMIN_LINKED_MAX,
  ERROR_CODES,
  SUSPENSION_FOREVER,
  type AdminBulkSuspendResponse,
  type AdminLinkedAccounts,
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
import { authId } from '../lib/authId'
import type { AdminAction } from '../modules/admin/auditLog'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { ensureOfficialAccounts } from '../modules/official/accounts'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const DAY = 24 * 60 * 60 * 1000

/**
 * The operator panel's "linked accounts" and the bulk suspension beside it.
 *
 * Its own file rather than another block in `admin.test.ts`, which is long
 * enough already; the setup is that file's, unchanged.
 */
describe('linked accounts', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `linked-${seq}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `linkeduser${seq}`,
        displayName: `User ${seq}`,
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

  const profiles = () => handle.db.collection<Profile>(COLLECTIONS.profiles)

  async function newAdmin(): Promise<SignedUpUser> {
    const admin = await newUser()
    await profiles().updateOne({ _id: admin.userId }, { $set: { admin: true } })
    return admin
  }

  /** A session as Better Auth writes one: ObjectId user id, address stamped at creation. */
  async function sessionFrom(user: SignedUpUser, ipAddress: string, daysAgo: number) {
    const createdAt = new Date(Date.now() - daysAgo * DAY)
    await handle.db.collection(COLLECTIONS.session).insertOne({
      userId: authId(user.userId),
      token: new ObjectId().toHexString(),
      ipAddress,
      userAgent: 'test',
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(Date.now() + 30 * DAY),
    })
  }

  async function deviceOf(user: SignedUpUser, deviceId: string) {
    const now = new Date()
    await handle.db.collection(COLLECTIONS.devices).insertOne({
      userId: user.userId,
      pushToken: `ExponentPushToken[${new ObjectId().toHexString()}]`,
      platform: 'ios',
      deviceId,
      createdAt: now,
      updatedAt: now,
    })
  }

  const get = (user: SignedUpUser, url: string) =>
    app.inject({ method: 'GET', url, headers: { cookie: user.cookie } })

  const post = (user: SignedUpUser, url: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url, headers: { cookie: user.cookie }, payload })

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_admin_linked_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_admin_linked_test',
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
      email: emailSender,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
    })
    await app.ready()
    await ensureOfficialAccounts(handle.db, 'http://localhost:4000')
    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  describe('the lookup', () => {
    it('links a network shared in the last 30 days, a device, and never the person themself', async () => {
      const admin = await newAdmin()
      const subject = await newUser()
      const recent = await newUser()
      const stale = await newUser()
      const phone = await newUser()
      const both = await newUser()
      const stranger = await newUser()

      // The subject's own two sessions on one address must not make them their own link.
      await sessionFrom(subject, '203.0.113.7', 2)
      await sessionFrom(subject, '203.0.113.7', 5)
      await sessionFrom(subject, '198.51.100.20', 3)

      await sessionFrom(recent, '203.0.113.7', 10)
      // The same address, but seen 40 days ago: outside the window.
      await sessionFrom(stale, '198.51.100.20', 40)
      await sessionFrom(stranger, '192.0.2.99', 1)

      await deviceOf(subject, 'install-a')
      await deviceOf(phone, 'install-a')
      await deviceOf(both, 'install-a')
      await sessionFrom(both, '198.51.100.20', 1)

      // One open report and one already decided: only the first counts.
      await handle.db.collection(COLLECTIONS.reports).insertMany([
        {
          reporterId: stranger.userId,
          reportedId: recent.userId,
          reason: 'spam',
          status: 'open',
          createdAt: new Date(),
        },
        {
          reporterId: stranger.userId,
          reportedId: recent.userId,
          reason: 'spam',
          status: 'dismissed',
          createdAt: new Date(),
        },
      ])
      await profiles().updateOne(
        { _id: phone.userId },
        {
          $set: {
            suspension: {
              at: new Date(),
              until: new Date(Date.now() + 7 * DAY),
              permanent: false,
              reason: 'spam',
            },
          },
        },
      )

      const response = await get(admin, `/admin/users/${subject.userId}/linked`)
      expect(response.statusCode).toBe(200)
      const body = response.json<AdminLinkedAccounts>()
      const byId = new Map(body.items.map((item) => [item.userId, item]))

      expect(byId.get(recent.userId)).toMatchObject({
        via: ['network'],
        sharedNetworks: 1,
        sharedDevices: 0,
        openReports: 1,
        suspended: false,
      })
      expect(byId.get(phone.userId)).toMatchObject({
        via: ['device'],
        sharedDevices: 1,
        suspended: true,
      })
      expect(byId.get(both.userId)?.via).toEqual(['network', 'device'])
      expect(byId.has(stale.userId)).toBe(false)
      expect(byId.has(stranger.userId)).toBe(false)
      expect(byId.has(subject.userId)).toBe(false)
      expect(body.truncated).toBe(false)

      // A device outranks a network, so the two phone-sharers come first.
      expect(body.items.slice(0, 2).map((item) => item.userId)).toEqual(
        expect.arrayContaining([phone.userId, both.userId]),
      )

      // The addresses stay on the server.
      expect(response.body).not.toContain('203.0.113')
      expect(response.body).not.toContain('198.51.100')
    })

    it('is empty for somebody who shares nothing, and 404 for nobody', async () => {
      const admin = await newAdmin()
      const loner = await newUser()
      await sessionFrom(loner, '192.0.2.200', 1)
      await deviceOf(loner, 'install-alone')

      const empty = await get(admin, `/admin/users/${loner.userId}/linked`)
      expect(empty.json<AdminLinkedAccounts>()).toEqual({ items: [], truncated: false })

      const missing = await get(admin, `/admin/users/${new ObjectId().toHexString()}/linked`)
      expect(missing.statusCode).toBe(404)
    })

    it('is the operator’s alone', async () => {
      const member = await newUser()
      const other = await newUser()
      const refused = await get(member, `/admin/users/${other.userId}/linked`)
      expect(refused.statusCode).toBe(403)
      expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.ADMIN_REQUIRED)
    })
  })

  describe('suspending several at once', () => {
    it('suspends each, logs each, and says per account why one was left alone', async () => {
      const admin = await newAdmin()
      const otherAdmin = await newAdmin()
      const first = await newUser()
      const second = await newUser()
      const banned = await newUser()
      await profiles().updateOne(
        { _id: banned.userId },
        {
          $set: {
            suspension: {
              at: new Date(),
              until: new Date(SUSPENSION_FOREVER),
              permanent: true,
              reason: 'scam',
            },
          },
        },
      )
      const official = await profiles().findOne({ handle: 'langx' })
      const nobody = new ObjectId().toHexString()

      const response = await post(admin, '/admin/users/suspend-bulk', {
        userIds: [
          first.userId,
          second.userId,
          first.userId,
          admin.userId,
          otherAdmin.userId,
          official!._id,
          banned.userId,
          nobody,
        ],
        reason: 'scam',
        days: 14,
      })
      expect(response.statusCode).toBe(200)
      const { results } = response.json<AdminBulkSuspendResponse>()

      // The repeated id is suspended once, not twice.
      expect(results).toEqual([
        { userId: first.userId, suspended: true },
        { userId: second.userId, suspended: true },
        { userId: admin.userId, suspended: false, skipped: 'self' },
        { userId: otherAdmin.userId, suspended: false, skipped: 'admin' },
        { userId: official!._id, suspended: false, skipped: 'official' },
        // Already permanent: a bulk "14 days" must not shorten it.
        { userId: banned.userId, suspended: false, skipped: 'suspended' },
        { userId: nobody, suspended: false, skipped: 'not_found' },
      ])

      for (const user of [first, second]) {
        const profile = await profiles().findOne({ _id: user.userId })
        expect(profile?.suspension).toMatchObject({ reason: 'scam', by: admin.userId })
        const days = (new Date(profile!.suspension!.until).getTime() - Date.now()) / DAY
        expect(Math.round(days)).toBe(14)
      }
      for (const id of [admin.userId, otherAdmin.userId, official!._id]) {
        expect((await profiles().findOne({ _id: id }))?.suspension).toBeUndefined()
      }

      const logged = await handle.db
        .collection<AdminAction>(COLLECTIONS.adminActions)
        .find({ adminId: admin.userId, action: 'user.suspend' })
        .toArray()
      expect(logged.map((row) => row.subjectUserId).sort()).toEqual(
        [first.userId, second.userId].sort(),
      )
      expect((await profiles().findOne({ _id: banned.userId }))?.suspension?.permanent).toBe(true)
      expect(logged[0]?.payload).toMatchObject({ reason: 'scam', days: 14, bulk: true })
    })

    it('refuses more than the cap, and anything permanent', async () => {
      const admin = await newAdmin()
      const tooMany = Array.from({ length: ADMIN_LINKED_MAX + 1 }, () =>
        new ObjectId().toHexString(),
      )
      const capped = await post(admin, '/admin/users/suspend-bulk', {
        userIds: tooMany,
        reason: 'scam',
        days: 7,
      })
      expect(capped.statusCode).toBe(400)

      const target = await newUser()
      const noDays = await post(admin, '/admin/users/suspend-bulk', {
        userIds: [target.userId],
        reason: 'scam',
        permanent: true,
      })
      expect(noDays.statusCode).toBe(400)
      expect((await profiles().findOne({ _id: target.userId }))?.suspension).toBeUndefined()
    })

    it('is the operator’s alone', async () => {
      const member = await newUser()
      const target = await newUser()
      const refused = await post(member, '/admin/users/suspend-bulk', {
        userIds: [target.userId],
        reason: 'scam',
        days: 7,
      })
      expect(refused.statusCode).toBe(403)
      expect((await profiles().findOne({ _id: target.userId }))?.suspension).toBeUndefined()
    })
  })
})
