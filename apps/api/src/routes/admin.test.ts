import { BOUNTY_MIN, ERROR_CODES, REPORTS_TO_FREEZE_XP, SUSPENSION_FOREVER } from '@langx/shared'
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
import { verifyBountyToken } from '../email/bountyToken'
import { signReviewToken } from '../email/reviewToken'
import { forgetAdminStats, type AdminStats } from '../modules/admin/stats'
import type { Profile } from '../modules/profiles/profiles'
import { ensureOfficialAccounts } from '../modules/official/accounts'
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

  // Always a payload, even an empty one: a conditional spread makes `inject`
  // resolve to a union of its overloads, and `.json<T>()` on that union is an
  // error type rather than a response. The routes with no body schema ignore it.
  const post = (user: SignedUpUser, url: string, payload: unknown = {}) =>
    app.inject({
      method: 'POST',
      url,
      headers: { cookie: user.cookie },
      payload: payload as Record<string, unknown>,
    })

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
    // `index.ts` does this at boot; `buildApp` does not, and the panel can
    // send from @langx.
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

  describe('reports', () => {
    it('is the same decision through the panel as through the emailed link', async () => {
      const admin = await newUser()
      await makeAdmin(admin)

      // Two reports, two targets, so the two decisions cannot interfere.
      const viaPanel = await newUser()
      const viaLink = await newUser()
      const reporter = await newUser()
      for (const target of [viaPanel, viaLink]) {
        expect(
          (await post(reporter, '/reports', { userId: target.userId, reason: 'spam' })).statusCode,
        ).toBe(201)
      }

      const queue = (await get(admin, '/admin/reports?status=open')).json<{
        items: { id: string; reported: { userId: string } }[]
      }>()
      expect(queue.items).toHaveLength(2)
      const reportFor = (user: SignedUpUser) =>
        queue.items.find((item) => item.reported.userId === user.userId)!.id

      // The panel.
      const decided = await post(admin, `/admin/reports/${reportFor(viaPanel)}/decision`, {
        action: 'suspend',
        days: 3,
      })
      expect(decided.statusCode).toBe(200)

      // The emailed form, which posts urlencoded and carries a signed token.
      const token = signReviewToken('a'.repeat(32), {
        kind: 'report',
        userId: viaLink.userId,
        reportId: reportFor(viaLink),
        expiresAt: Date.now() + 60_000,
      })
      const page = await app.inject({
        method: 'POST',
        url: `/moderation/review?token=${encodeURIComponent(token)}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'action=suspend&days=3',
      })
      expect(page.statusCode).toBe(200)

      const [a, b] = await Promise.all([
        profiles().findOne({ _id: viaPanel.userId }),
        profiles().findOne({ _id: viaLink.userId }),
      ])
      // Identical but for `by`, which only the panel can know: the mailbox
      // authorises whoever holds the link and can name nobody.
      expect(a?.suspension?.by).toBe(admin.userId)
      expect(b?.suspension?.by).toBeUndefined()
      expect(a?.suspension?.permanent).toBe(b?.suspension?.permanent)
      expect(a?.suspension?.reason).toBe(b?.suspension?.reason)
      expect(a?.suspension?.reportId).toBeDefined()
      expect(b?.suspension?.reportId).toBeDefined()

      // Both reports are closed, and both people were told the same thing.
      const closed = (await get(admin, '/admin/reports?status=actioned')).json<{
        items: unknown[]
      }>()
      expect(closed.items).toHaveLength(2)
    })

    it('writes what it did, and shows it on the account it did it to', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const target = await newUser()
      const reporter = await newUser()
      await post(reporter, '/reports', { userId: target.userId, reason: 'harassment' })

      const queue = (await get(admin, '/admin/reports?status=open')).json<{
        items: { id: string }[]
      }>()
      await post(admin, `/admin/reports/${queue.items[0]!.id}/decision`, { action: 'dismiss' })

      const detail = (await get(admin, `/admin/users/${target.userId}`)).json<{
        user: { actions: { action: string; adminId: string }[] }
      }>()
      expect(detail.user.actions[0]).toMatchObject({
        action: 'report.decide',
        adminId: admin.userId,
      })
    })
  })

  describe('appeals', () => {
    it('leaves the queue when it is answered, however it is answered', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const target = await newUser()

      await post(admin, `/admin/users/${target.userId}/suspend`, { reason: 'spam', days: 7 })
      expect(
        (
          await post(target, '/me/suspension/appeal', {
            text: 'It was not me, and I would like this looked at again.',
          })
        ).statusCode,
      ).toBe(202)

      const waiting = () =>
        get(admin, '/admin/appeals').then((response) =>
          response.json<{ items: { userId: string }[] }>(),
        )
      expect((await waiting()).items.map((item) => item.userId)).toContain(target.userId)

      // `keep` is the one that used to leave it behind: `lift` removes the
      // whole sub-document and always looked answered.
      const kept = await post(admin, `/admin/appeals/${target.userId}/decision`, { action: 'keep' })
      expect(kept.statusCode).toBe(200)
      expect((await waiting()).items.map((item) => item.userId)).not.toContain(target.userId)

      const profile = await profiles().findOne({ _id: target.userId })
      expect(profile?.suspension?.appeal?.decidedBy).toBe(admin.userId)
      // Still suspended — answering an appeal is not lifting one.
      expect(profile?.suspension?.until).toBeDefined()
    })
  })

  describe('the two things a report was the only way to reach', () => {
    it('thaws an account whose earning three reports froze', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const target = await newUser()

      for (let i = 0; i < REPORTS_TO_FREEZE_XP; i++) {
        const reporter = await newUser()
        await post(reporter, '/reports', { userId: target.userId, reason: 'spam' })
      }
      expect((await profiles().findOne({ _id: target.userId }))?.tokenFrozenAt).toBeDefined()

      const thawed = await post(admin, `/admin/users/${target.userId}/unfreeze-tokens`)
      expect(thawed.json<{ thawed: boolean }>().thawed).toBe(true)
      expect((await profiles().findOne({ _id: target.userId }))?.tokenFrozenAt).toBeUndefined()
    })

    it('hides a post nobody reported, and can put it back', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const author = await newUser()
      const created = await post(author, '/posts', {
        body: 'something worth hiding',
        language: 'en',
      })
      expect(created.statusCode).toBe(201)
      const postId = created.json<{ _id: string }>()._id

      const hidden = await post(admin, `/admin/posts/${postId}/hide`)
      expect(hidden.json<{ hidden: boolean; changed: boolean }>()).toEqual({
        hidden: true,
        changed: true,
      })
      // Hiding it twice changes nothing and says so.
      expect(
        (await post(admin, `/admin/posts/${postId}/hide`)).json<{ changed: boolean }>().changed,
      ).toBe(false)
      expect(
        (await post(admin, `/admin/posts/${postId}/unhide`)).json<{ hidden: boolean }>().hidden,
      ).toBe(false)
    })
  })

  describe('the support questions', () => {
    it("says which filter empties this person's Discover", async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const lonely = await newUser()

      const { discovery } = (await get(admin, `/admin/users/${lonely.userId}`)).json<{
        discovery: { matches: number; steps: { filter: string; remaining: number }[] }
      }>()

      // Cumulative and in order, so the step where it collapses is the answer.
      expect(discovery.steps.map((step) => step.filter)).toEqual([
        'everybody',
        'discoverable',
        'not suspended',
        'not blocked either way',
        'language fit',
      ])
      expect(discovery.steps.at(-1)!.remaining).toBe(discovery.matches)
      for (let i = 1; i < discovery.steps.length; i++) {
        expect(discovery.steps[i]!.remaining).toBeLessThanOrEqual(discovery.steps[i - 1]!.remaining)
      }
    })

    it('resolves the notification switches rather than printing what is stored', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const target = await newUser()

      // The oldest of the three stored shapes: one boolean for everything.
      await profiles().updateOne(
        { _id: target.userId },
        { $set: { 'settings.notifications': false } },
      )

      const { push } = (await get(admin, `/admin/users/${target.userId}`)).json<{
        push: { prefs: { type: string; push: boolean; email: boolean }[] }
      }>()
      expect(push.prefs.length).toBeGreaterThan(0)
      expect(push.prefs.every((pref) => !pref.push && !pref.email)).toBe(true)
    })

    it('finds somebody by the address a support thread came from', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const target = await newUser()

      const found = await get(admin, `/admin/users?q=${encodeURIComponent(target.email)}`)
      expect(found.statusCode).toBe(200)
      expect(found.json<{ user: { userId: string; email: string } }>().user.userId).toBe(
        target.userId,
      )
    })
  })

  describe('bug reports', () => {
    it('is the same object as the link in the mail, and pays once across both', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const finder = await newUser()

      const sent = await post(finder, '/feedback', {
        kind: 'bug',
        body: 'The compose button does nothing on a cold start.',
      })
      expect(sent.statusCode).toBe(202)

      const queue = (await get(admin, '/admin/feedback?status=open')).json<{
        items: { _id: string; kind: string; sender: { userId: string } }[]
      }>()
      expect(queue.items).toHaveLength(1)
      const row = queue.items[0]!
      expect(row.kind).toBe('bug')
      expect(row.sender.userId).toBe(finder.userId)

      /*
       * The row's id is the id the emailed bounty link carries. This is the
       * assertion the whole design rests on: if these two ever differ, paying
       * from the panel and paying from the mail become two payments.
       */
      const mail = emailSender.messages.find((message) =>
        message.subject.startsWith('Bug report from'),
      )
      expect(mail).toBeDefined()
      const token = decodeURIComponent(
        /\/feedback\/award\?token=([^"'&\s]+)/.exec(mail?.html ?? '')?.[1] ?? '',
      )
      expect(verifyBountyToken('a'.repeat(32), token)?.reportId).toBe(row._id)

      const paid = await post(admin, `/admin/feedback/${row._id}/award`, { amount: BOUNTY_MIN })
      expect(paid.json<{ awarded: boolean; amount: number }>()).toEqual({
        awarded: true,
        amount: BOUNTY_MIN,
      })

      // Paying again — from either door — pays nothing and says so.
      const again = await post(admin, `/admin/feedback/${row._id}/award`, { amount: BOUNTY_MIN })
      expect(again.json<{ awarded: boolean }>().awarded).toBe(false)

      const ledger = await handle.db
        .collection(COLLECTIONS.tokenLedger)
        .countDocuments({ userId: finder.userId, kind: 'bounty', refId: row._id })
      expect(ledger).toBe(1)

      // Paying moves it to `triaged`, not `closed`: it says the report was
      // real, not that the fix shipped.
      const triaged = (await get(admin, '/admin/feedback?status=triaged')).json<{
        items: { _id: string; bounty: { amount: number } | null }[]
      }>()
      expect(triaged.items[0]?._id).toBe(row._id)
      expect(triaged.items[0]?.bounty?.amount).toBe(BOUNTY_MIN)
    })

    it('shows the oldest open report first, because it is a queue and not a feed', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const sender = await newUser()

      for (const body of ['The first thing that went wrong.', 'The second thing.']) {
        await post(sender, '/feedback', { kind: 'bug', body })
      }

      const queue = (await get(admin, '/admin/feedback?status=open')).json<{
        items: { body: string }[]
      }>()
      expect(queue.items[0]?.body).toBe('The first thing that went wrong.')
    })
  })

  describe('speaking as @langx', () => {
    it('delivers one message, which the person cannot reply to', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const recipient = await newUser()

      const sent = await post(admin, `/admin/users/${recipient.userId}/message`, {
        body: 'Your report was received. Replies go to hi@langx.io.',
      })
      expect(sent.statusCode).toBe(201)
      const conversationId = sent.json<{ conversationId: string }>().conversationId

      /*
       * It lands in the thread the welcome is already in — one conversation per
       * pair, forever, which is what `pairKey` is for. So this looks through
       * the thread rather than at the top of it.
       */
      const thread = await get(recipient, `/conversations/${conversationId}/messages`)
      expect(thread.statusCode).toBe(200)
      const bodies = thread.json<{ items: { body: string }[] }>().items.map((item) => item.body)
      expect(bodies.some((body) => body.includes('Your report was received'))).toBe(true)

      /*
       * And it is one way. `OFFICIAL_WRITABLE.langx` is false, so
       * `recordMessage` refuses anything addressed back — a deliberate product
       * decision, asserted here so that turning @langx into a support inbox
       * becomes a choice somebody makes rather than something that happens.
       *
       * Against the repository rather than a route because text messages are
       * sent over the socket, and the guard is below both.
       */
      const { sendTextMessage } = await import('../modules/chat/messages')
      await expect(
        sendTextMessage(handle.db, recipient.userId, {
          conversationId,
          body: 'thanks!',
          clientId: 'reply-attempt',
        }),
      ).rejects.toThrow(/does not take messages/i)
    })
  })

  describe('broadcasts', () => {
    it('is a draft first, and the slug cannot be used twice', async () => {
      const admin = await newUser()
      await makeAdmin(admin)

      const created = await post(admin, '/admin/broadcasts', {
        id: 'autumn-news',
        bodies: { en: 'Something new is here.' },
      })
      expect(created.statusCode).toBe(201)
      expect(created.json<{ status: string; total: number }>().status).toBe('draft')
      expect(created.json<{ total: number }>().total).toBeGreaterThan(0)

      // Sent to the operator alone, before anybody else can see it.
      const tested = await post(admin, '/admin/broadcasts/autumn-news/test')
      expect(tested.json<{ delivered: boolean }>().delivered).toBe(true)

      const armed = await post(admin, '/admin/broadcasts/autumn-news/start')
      expect(armed.json<{ status: string }>().status).toBe('queued')

      // Starting it again is refused rather than silently ignored.
      expect((await post(admin, '/admin/broadcasts/autumn-news/start')).statusCode).toBe(400)

      const again = await post(admin, '/admin/broadcasts', {
        id: 'autumn-news',
        bodies: { en: 'A different message under the same name.' },
      })
      expect(again.statusCode).toBe(400)
    })

    it('refuses a broadcast with no English body, because English is the fallback', async () => {
      const admin = await newUser()
      await makeAdmin(admin)
      const created = await post(admin, '/admin/broadcasts', {
        id: 'turkish-only',
        bodies: { tr: 'Sadece Türkçe' },
      })
      expect(created.statusCode).toBe(400)
    })
  })
})
