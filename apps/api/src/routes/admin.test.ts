import { ERROR_CODES, SUSPENSION_FOREVER } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { withJobHealth, type JobHealth } from '../modules/admin/jobHealth'
import { forgetAdminStats, type AdminStats } from '../modules/admin/stats'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

describe('the operator panel', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `admin-${seq}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `adminuser${seq}`,
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

  async function makeAdmin(user: SignedUpUser): Promise<void> {
    await profiles().updateOne({ _id: user.userId }, { $set: { admin: true } })
  }

  const get = (user: SignedUpUser | null, url: string) =>
    app.inject({
      method: 'GET',
      url,
      ...(user ? { headers: { cookie: user.cookie } } : {}),
    })

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_admin_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_admin_test',
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

  // The stats endpoint memoises for a minute, which is right in production and
  // wrong inside a test that has just written the thing it is about to read.
  beforeEach(() => {
    forgetAdminStats()
  })

  describe('the guard', () => {
    it('refuses in the right order: unauthenticated, then suspended, then not an admin', async () => {
      expect((await get(null, '/admin/stats')).statusCode).toBe(401)

      const member = await newUser()
      const refused = await get(member, '/admin/stats')
      expect(refused.statusCode).toBe(403)
      expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.ADMIN_REQUIRED)

      const admin = await newUser()
      await makeAdmin(admin)
      expect((await get(admin, '/admin/stats')).statusCode).toBe(200)

      /*
       * A suspended moderator is told they are suspended rather than being let
       * in to moderate their way out of it. This is the assertion that pins the
       * order of the two 403s; without it either arrangement passes.
       */
      await profiles().updateOne(
        { _id: admin.userId },
        {
          $set: {
            suspension: {
              at: new Date(),
              until: new Date(SUSPENSION_FOREVER),
              permanent: true,
              reason: 'spam',
            },
          },
        },
      )
      const suspended = await get(admin, '/admin/stats')
      expect(suspended.statusCode).toBe(403)
      expect(suspended.json<{ code: string }>().code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED)

      await profiles().updateOne({ _id: admin.userId }, { $unset: { suspension: '' } })
    })

    it('answers a guest with ADMIN_REQUIRED, not the offer to create an account', async () => {
      const guest = await app.inject({ method: 'POST', url: '/api/auth/sign-in/anonymous' })
      const cookie = guest.headers['set-cookie']
      const refused = await app.inject({
        method: 'GET',
        url: '/admin/stats',
        headers: { cookie: Array.isArray(cookie) ? cookie.join('; ') : (cookie ?? '') },
      })
      expect(refused.statusCode).toBe(403)
      expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.ADMIN_REQUIRED)
    })
  })

  describe('the flag', () => {
    it('reaches its owner and nobody else', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const other = await newUser()

      expect((await get(admin, '/profiles/me')).json<{ admin?: true }>().admin).toBe(true)

      const asMember = await get(other, `/profiles/${admin.userId}`)
      expect(asMember.statusCode).toBe(200)
      expect(asMember.json()).not.toHaveProperty('admin')

      const adminProfile = await profiles().findOne({ _id: admin.userId })
      const signedOut = await get(null, `/public/profiles/${adminProfile?.handle}`)
      expect(signedOut.statusCode).toBe(200)
      expect(signedOut.json()).not.toHaveProperty('admin')
    })
  })

  describe('the dashboard', () => {
    it('counts what it says it counts, and survives a database with nothing in it', async () => {
      const admin = await newUser()
      await makeAdmin(admin)

      const stats = (await get(admin, '/admin/stats')).json<AdminStats>()

      // Every profile made in this file joined today, so the two agree.
      expect(stats.audience.joinedToday).toBeGreaterThan(0)
      expect(stats.audience.joinedToday).toBe(stats.audience.joinedLastWeek)
      expect(stats.audience.profiles).toBeGreaterThan(0)
      expect(stats.audience.seenLastWeek).toBeGreaterThan(0)

      // Seven days of strip, oldest first, zeros included rather than absent —
      // a missing day in a chart reads as missing data, not as a quiet one.
      expect(stats.audience.activeDaily).toHaveLength(7)
      expect(stats.money.tokensDaily).toHaveLength(7)
      expect(stats.audience.activeDaily.at(-1)!.day > stats.audience.activeDaily[0]!.day).toBe(true)

      // Nothing has been reported, appealed, sent, suspended or paid here.
      expect(stats.queue).toEqual({ reports: 0, appeals: 0, feedback: 0 })
      expect(stats.money.pool).toBeNull()
      expect(stats.system.suppressions.total).toBe(0)
      expect(stats.system.campaigns).toEqual([])

      // The plan mix adds up, which is the only thing that can be asserted
      // about it without pinning the tier of every fixture in the file.
      const { total, pro, proPlus, free } = stats.money.tiers
      expect(pro + proPlus + free).toBe(total)

      // Read from the public module rather than recomputed beside it.
      expect(stats.public.totals.members).toBeGreaterThan(0)
    })
  })

  describe('job health', () => {
    it('records a pass that worked, a pass that threw, and clears the error after', async () => {
      const health = () =>
        handle.db.collection<JobHealth>(COLLECTIONS.jobHealth).findOne({ _id: 'test pass' })

      await withJobHealth(handle.db, 'test pass', () => Promise.resolve({ sent: 3 }))
      expect(await health()).toMatchObject({ lastResult: { sent: 3 }, lastError: null, runs: 1 })

      // It rethrows: every scheduler already catches and carries on, and this
      // must not take that over.
      await expect(
        withJobHealth(handle.db, 'test pass', () =>
          Promise.reject(new Error('the pass fell over')),
        ),
      ).rejects.toThrow('the pass fell over')
      expect(await health()).toMatchObject({
        lastError: 'the pass fell over',
        runs: 2,
        failures: 1,
      })

      // A stale error beside a fresh success would read as a job still broken.
      await withJobHealth(handle.db, 'test pass', () => Promise.resolve({ sent: 0 }))
      expect(await health()).toMatchObject({ lastError: null, runs: 3, failures: 1 })

      forgetAdminStats()
      const admin = await newUser()
      await makeAdmin(admin)
      const jobs = (await get(admin, '/admin/stats')).json<AdminStats>().system.jobs
      expect(jobs.map((job) => job._id)).toContain('test pass')
    })
  })
})
