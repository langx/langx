import {
  BOUNTY_MIN,
  ERROR_CODES,
  MOD_SUSPENSION_MAX_DAYS,
  REPORT_WARNINGS,
  SUSPENSION_FOREVER,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Message } from '../modules/chat/conversations'
import type { ModeratorAction } from '../modules/moderation/moderatorActions'
import { ensureOfficialAccounts } from '../modules/official/accounts'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const NOTE = 'Sent the same link to five people in an hour.'

describe('moderators', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `mod-${seq}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `moduser${seq}`,
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
  const modActions = () => handle.db.collection<ModeratorAction>(COLLECTIONS.moderatorActions)

  const post = (user: SignedUpUser, url: string, payload: unknown = {}) =>
    app.inject({
      method: 'POST',
      url,
      headers: { cookie: user.cookie },
      payload: payload as Record<string, unknown>,
    })
  const get = (user: SignedUpUser, url: string) =>
    app.inject({ method: 'GET', url, headers: { cookie: user.cookie } })
  const del = (user: SignedUpUser, url: string) =>
    app.inject({ method: 'DELETE', url, headers: { cookie: user.cookie } })

  let admin: SignedUpUser

  async function newModerator(): Promise<SignedUpUser> {
    const mod = await newUser()
    const granted = await post(admin, `/admin/users/${mod.userId}/moderator`)
    expect(granted.statusCode).toBe(200)
    return mod
  }

  /** A fresh report against a fresh account, and its id. */
  async function newReport(reason = 'spam') {
    const target = await newUser()
    const reporter = await newUser()
    expect((await post(reporter, '/reports', { userId: target.userId, reason })).statusCode).toBe(
      201,
    )
    const report = await handle.db
      .collection(COLLECTIONS.reports)
      .findOne({ reportedId: target.userId })
    return { target, reporter, id: report!._id.toHexString() }
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_moderator_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_moderator_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      REVENUECAT_FAKE_STORE: 'true',
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
    admin = await newUser()
    await profiles().updateOne({ _id: admin.userId }, { $set: { admin: true } })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  describe('the role', () => {
    it('is handed out by an operator, shown to everybody, and taken back', async () => {
      const member = await newUser()
      const refused = await get(member, '/mod/reports')
      expect(refused.statusCode).toBe(403)
      expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.MODERATOR_REQUIRED)

      // Nobody but an operator can make somebody a moderator.
      expect((await post(member, `/admin/users/${member.userId}/moderator`)).statusCode).toBe(403)
      // An operator may wear the chip too; the role adds nothing they lack.
      expect((await post(admin, `/admin/users/${admin.userId}/moderator`)).statusCode).toBe(200)
      expect((await del(admin, `/admin/users/${admin.userId}/moderator`)).statusCode).toBe(200)

      const mod = await newModerator()
      expect((await get(mod, '/mod/reports')).statusCode).toBe(200)

      // The chip is public; the admin flag beside it never was.
      const asMember = (await get(member, `/profiles/${mod.userId}`)).json<{ moderator?: true }>()
      expect(asMember.moderator).toBe(true)
      // And on the page a shared link opens, which needs no session.
      const modHandle = (await profiles().findOne({ _id: mod.userId }))!.handle
      const shared = await app.inject({ method: 'GET', url: `/public/profiles/${modHandle}` })
      expect(shared.json<{ moderator?: true }>().moderator).toBe(true)
      expect(shared.json()).not.toHaveProperty('admin')
      expect((await get(member, `/profiles/${member.userId}`)).json()).not.toHaveProperty(
        'moderator',
      )

      const listed = (await get(member, '/moderators')).json<{ items: { userId: string }[] }>()
      expect(listed.items.map((item) => item.userId)).toContain(mod.userId)

      const audit = (await get(admin, `/admin/users/${mod.userId}`)).json<{
        user: { moderatorSince: string | null; actions: { action: string }[] }
      }>()
      expect(audit.user.moderatorSince).not.toBeNull()
      expect(audit.user.actions[0]?.action).toBe('moderator.grant')

      expect((await del(admin, `/admin/users/${mod.userId}/moderator`)).statusCode).toBe(200)
      expect((await get(mod, '/mod/reports')).statusCode).toBe(403)
    })

    it('cannot give Pro, tokens, or review itself', async () => {
      const mod = await newModerator()
      const { id } = await newReport()
      const refusals = await Promise.all([
        post(mod, `/admin/users/${mod.userId}/gift`, { months: 1 }),
        post(mod, `/admin/reports/${id}/reward`, { amount: BOUNTY_MIN }),
        get(mod, '/admin/mod-actions'),
        post(mod, `/admin/users/${mod.userId}/moderator`),
      ])
      for (const refused of refusals) {
        expect(refused.statusCode).toBe(403)
        expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.ADMIN_REQUIRED)
      }
    })

    it('tells a suspended moderator they are suspended', async () => {
      const mod = await newModerator()
      await profiles().updateOne(
        { _id: mod.userId },
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
      const refused = await get(mod, '/mod/reports')
      expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED)
    })
  })

  describe('the queue', () => {
    it('leaves out reports about protected accounts and never names a reporter', async () => {
      const mod = await newModerator()
      const otherMod = await newModerator()
      const { id: visible } = await newReport()
      const reporter = await newUser()
      await post(reporter, '/reports', { userId: otherMod.userId, reason: 'spam' })
      await post(reporter, '/reports', { userId: admin.userId, reason: 'spam' })
      await post(mod, '/reports', { userId: reporter.userId, reason: 'spam' })

      const queue = (await get(mod, '/mod/reports?limit=50')).json<{
        items: { id: string; reported: { userId: string } }[]
      }>()
      const ids = queue.items.map((item) => item.id)
      expect(ids).toContain(visible)
      const reported = queue.items.map((item) => item.reported.userId)
      expect(reported).not.toContain(otherMod.userId)
      expect(reported).not.toContain(admin.userId)
      // Their own report is not theirs to decide.
      expect(reported).not.toContain(reporter.userId)
      for (const item of queue.items) expect(item).not.toHaveProperty('reporter')

      const detail = await get(mod, `/mod/reports/${visible}`)
      expect(detail.statusCode).toBe(200)
      expect(detail.json()).not.toHaveProperty('reporter')
      expect(detail.json()).not.toHaveProperty('reward')
    })
  })

  describe('a decision', () => {
    it('suspends only with a reason, for at most a month, and never for good', async () => {
      const mod = await newModerator()
      const { target, id } = await newReport()
      const decide = (payload: unknown) => post(mod, `/mod/reports/${id}/decision`, payload)

      expect((await decide({ action: 'suspend', days: 3 })).statusCode).toBe(400)
      expect((await decide({ action: 'suspend', days: 3, note: 'spam' })).statusCode).toBe(400)
      expect(
        (await decide({ action: 'suspend', days: MOD_SUSPENSION_MAX_DAYS + 1, note: NOTE }))
          .statusCode,
      ).toBe(400)
      expect((await decide({ action: 'permanent', note: NOTE })).statusCode).toBe(400)

      expect((await decide({ action: 'suspend', days: 3, note: NOTE })).statusCode).toBe(200)
      const suspended = await profiles().findOne({ _id: target.userId })
      expect(suspended?.suspension).toMatchObject({
        by: mod.userId,
        byModerator: true,
        note: NOTE,
        permanent: false,
      })

      // Decided, so it has left this moderator's queue.
      expect((await decide({ action: 'dismiss' })).statusCode).toBe(404)
      expect(await modActions().countDocuments({ moderatorId: mod.userId })).toBe(1)
    })

    it('warns in our words only', async () => {
      const mod = await newModerator()
      const { target, id } = await newReport('scam')
      expect(
        (await post(mod, `/mod/reports/${id}/warn`, { body: 'Pay me or else' })).statusCode,
      ).toBe(400)

      const warned = await post(mod, `/mod/reports/${id}/warn`, { reason: 'scam' })
      expect(warned.statusCode).toBe(200)
      expect(warned.json<{ warned: boolean }>().warned).toBe(true)

      const sent = await handle.db
        .collection<Message>(COLLECTIONS.messages)
        .findOne({ clientId: `reportWarning:${id}` })
      expect(sent?.body).toBe(REPORT_WARNINGS.scam)
      expect(
        await modActions().findOne({ subjectUserId: target.userId, action: 'warn' }),
      ).toMatchObject({ warningReason: 'scam' })
    })
  })

  describe('the review', () => {
    it('lists what a moderator did, thanks them once, and can undo it', async () => {
      const mod = await newModerator()
      const { target, id } = await newReport()
      await post(mod, `/mod/reports/${id}/decision`, { action: 'suspend', days: 3, note: NOTE })

      const pending = (await get(admin, `/admin/mod-actions?moderatorId=${mod.userId}`)).json<{
        items: { id: string; note: string; reportId: string; review: unknown }[]
      }>()
      expect(pending.items).toHaveLength(1)
      const row = pending.items[0]!
      expect(row).toMatchObject({ note: NOTE, reportId: id, review: null })

      const paid = await post(admin, `/admin/mod-actions/${row.id}/reward`, { amount: BOUNTY_MIN })
      expect(paid.json()).toEqual({ awarded: true, amount: BOUNTY_MIN })
      const again = await post(admin, `/admin/mod-actions/${row.id}/reward`, {
        amount: BOUNTY_MIN,
      })
      expect(again.json<{ awarded: boolean }>().awarded).toBe(false)
      const ledger = await handle.db
        .collection(COLLECTIONS.tokenLedger)
        .find({ userId: mod.userId, kind: 'moderatorReward' })
        .toArray()
      expect(ledger).toHaveLength(1)
      const thanks = await handle.db
        .collection<Message>(COLLECTIONS.messages)
        .countDocuments({ clientId: `moderatorReward:${row.id}` })
      expect(thanks).toBe(1)

      const reverted = await post(admin, `/admin/mod-actions/${row.id}/revert`)
      expect(reverted.json()).toEqual({ reverted: true })
      expect((await profiles().findOne({ _id: target.userId }))?.suspension).toBeUndefined()
      const report = await handle.db
        .collection(COLLECTIONS.reports)
        .findOne({ reportedId: target.userId })
      expect(report?.status).toBe('open')

      // Reverted stays reverted, and leaves the pending tab for its own.
      expect((await post(admin, `/admin/mod-actions/${row.id}/approve`)).json()).toEqual({
        approved: false,
      })
      expect((await post(admin, `/admin/mod-actions/${row.id}/revert`)).json()).toEqual({
        reverted: false,
      })
      const tab = (
        await get(admin, `/admin/mod-actions?status=reverted&moderatorId=${mod.userId}`)
      ).json<{ items: unknown[] }>()
      expect(tab.items).toHaveLength(1)

      const summary = (await get(admin, '/admin/moderators')).json<{
        items: { userId: string; total: number; reverted: number; rewarded: number }[]
      }>()
      expect(summary.items.find((item) => item.userId === mod.userId)).toMatchObject({
        total: 1,
        reverted: 1,
        rewarded: BOUNTY_MIN,
      })
    })

    it('does not lift a suspension somebody has decided again since', async () => {
      const mod = await newModerator()
      const { target, id } = await newReport()
      await post(mod, `/mod/reports/${id}/decision`, { action: 'suspend', days: 3, note: NOTE })
      const row = await modActions().findOne({ moderatorId: mod.userId })

      // An operator suspends them over something else, for good.
      await post(admin, `/admin/users/${target.userId}/suspend`, { reason: 'scam', days: 30 })

      await post(admin, `/admin/mod-actions/${row!._id.toHexString()}/revert`)
      expect((await profiles().findOne({ _id: target.userId }))?.suspension?.by).toBe(admin.userId)
    })
  })
})
