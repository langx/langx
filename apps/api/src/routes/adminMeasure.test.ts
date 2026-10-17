import {
  ACTIVATION_RULES,
  ADMIN_MONEY_TIMELINE_ROWS,
  ERROR_CODES,
  FIRST_MESSAGE_RULES,
  RETURN_RECORDED_FROM,
  quotaLimit,
  shiftDayKey,
  utcDayKey,
  weekStartKey,
  type AdminMeasure,
  type AdminMoneyTimeline,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { consumeQuota, QUOTA_REFUSAL_WINDOW_MS } from '../lib/quota'
import { forgetAdminMeasure } from '../modules/admin/measure'
import type { SubscriptionRecord } from '../modules/billing/webhook'
import type { ProGift } from '../modules/billing/proGifts'
import { pairKeyFor, type Conversation, type Message } from '../modules/chat/conversations'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { ensureOfficialAccounts } from '../modules/official/accounts'
import type { Profile } from '../modules/profiles/profiles'
import type { StreakDay } from '../modules/tokens/streakDays'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * The operator panel's measurement: cohorts, first messages, refusals and a
 * person's money timeline.
 *
 * Its own file rather than another block in `admin.test.ts`, which is long
 * enough already; the setup is that file's, unchanged. Every figure here is a
 * fixture built for the test — nothing in this file is, or resembles, a
 * reading of the real app.
 */
describe('the measurement endpoints', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `measure-${seq}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `measureuser${seq}`,
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
  const conversations = () => handle.db.collection<Conversation>(COLLECTIONS.conversations)
  const messages = () => handle.db.collection<Message>(COLLECTIONS.messages)
  const streakDays = () => handle.db.collection<StreakDay>(COLLECTIONS.streakDays)

  async function newAdmin(): Promise<SignedUpUser> {
    const admin = await newUser()
    await profiles().updateOne({ _id: admin.userId }, { $set: { admin: true } })
    return admin
  }

  const get = (user: SignedUpUser | null, url: string) =>
    app.inject({
      method: 'GET',
      url,
      ...(user ? { headers: { cookie: user.cookie } } : {}),
    })

  /** Takes everybody who is not part of the scenario out of every window. */
  async function isolate(keep: readonly string[]): Promise<void> {
    await profiles().updateMany(
      { _id: { $nin: [...keep] } },
      { $set: { createdAt: new Date('2020-01-01T00:00:00Z') } },
    )
    await conversations().deleteMany({})
    await messages().deleteMany({})
    await streakDays().deleteMany({})
  }

  /** Someone who joined `daysAgo` days ago, on a UTC calendar so the days are readable. */
  async function joined(daysAgo: number): Promise<{ id: string; createdAt: Date }> {
    const user = await newUser()
    const createdAt = new Date(Date.now() - daysAgo * DAY)
    await profiles().updateOne({ _id: user.userId }, { $set: { createdAt, timezone: 'UTC' } })
    return { id: user.userId, createdAt }
  }

  /** A conversation as `recordMessage` leaves one, with the messages it implies. */
  async function thread(
    opener: string,
    other: string,
    openedAt: Date,
    replyAt: Date | null,
    options: { callAt?: Date } = {},
  ): Promise<void> {
    const _id = new ObjectId()
    await conversations().insertOne({
      _id,
      pairKey: pairKeyFor(opener, other),
      participants: [opener, other],
      lastMessage: { body: 'hi', senderId: opener, createdAt: replyAt ?? openedAt },
      unread: {},
      firstMessageBy: opener,
      firstMessageAt: openedAt,
      bothSpoke: replyAt !== null,
      createdAt: openedAt,
      updatedAt: openedAt,
    })
    const rows = [{ senderId: opener, type: 'text', createdAt: openedAt }]
    if (options.callAt) rows.push({ senderId: other, type: 'call', createdAt: options.callAt })
    if (replyAt) rows.push({ senderId: other, type: 'text', createdAt: replyAt })
    await messages().insertMany(
      rows.map(
        (row) => ({ _id: new ObjectId(), conversationId: _id, body: 'x', ...row }) as Message,
      ),
    )
  }

  const after = (base: Date, hours: number) => new Date(base.getTime() + hours * HOUR)

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_admin_measure_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_admin_measure_test',
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
    emailSender.messages.length = 0
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  // The measurement is remembered for five minutes, which is right in
  // production and wrong inside a test that has just written what it reads.
  beforeEach(() => {
    forgetAdminMeasure()
  })

  describe('the guard', () => {
    it('refuses both endpoints to anyone but an operator', async () => {
      const member = await newUser()
      const admin = await newAdmin()
      const money = `/admin/users/${member.userId}/money`

      for (const url of ['/admin/measure', money]) {
        expect((await get(null, url)).statusCode).toBe(401)
        const refused = await get(member, url)
        expect(refused.statusCode).toBe(403)
        expect(refused.json<{ code: string }>().code).toBe(ERROR_CODES.ADMIN_REQUIRED)
        expect((await get(admin, url)).statusCode).toBe(200)
      }
    })

    it('answers an unknown account with 404 rather than an empty timeline', async () => {
      const admin = await newAdmin()
      const response = await get(admin, `/admin/users/${new ObjectId().toHexString()}/money`)
      expect(response.statusCode).toBe(404)
    })

    it('refuses a number of weeks the read was not built for', async () => {
      const admin = await newAdmin()
      expect((await get(admin, '/admin/measure?weeks=0')).statusCode).toBe(400)
      expect((await get(admin, '/admin/measure?weeks=99')).statusCode).toBe(400)
      expect((await get(admin, '/admin/measure?weeks=abc')).statusCode).toBe(400)
      expect((await get(admin, '/admin/measure?weeks=4')).statusCode).toBe(200)
    })
  })

  describe('cohorts, activation and first messages', () => {
    /**
     * Three people who joined ten days ago, and the partners they talked to.
     *
     * - `a`: back on Day 1 and Day 7, and two conversations answered inside
     *   three days — one of them after a call row that must not count as a reply.
     * - `b`: no visits at all, one answered conversation and one nobody answered.
     * - `c`: a bought day instead of a visit, and replies that came after the window.
     */
    async function buildWorld() {
      const a = await joined(10)
      const b = await joined(10)
      const c = await joined(10)
      const p1 = await joined(200)
      const p2 = await joined(200)
      const p3 = await joined(200)
      const p4 = await joined(200)
      const admin = await newAdmin()
      const langx = await profiles().findOne({ handle: 'langx' })
      if (!langx) throw new Error('the official account was not created')

      await isolate([a.id, b.id, c.id, p1.id, p2.id, p3.id, p4.id, langx._id])

      const opened = (who: { createdAt: Date }) => after(who.createdAt, 1)
      await thread(a.id, p1.id, opened(a), after(a.createdAt, 5), { callAt: after(a.createdAt, 2) })
      await thread(a.id, p2.id, opened(a), after(a.createdAt, 30))
      await thread(b.id, p1.id, opened(b), after(b.createdAt, 3))
      await thread(b.id, p3.id, opened(b), null)
      await thread(c.id, p2.id, opened(c), after(c.createdAt, 100))
      await thread(c.id, p4.id, opened(c), after(c.createdAt, 101))
      // Not people: a note from @langx is not a first message anyone ignored.
      await thread(langx._id, b.id, opened(b), null)
      // And a conversation from long before the window.
      await thread(p3.id, p4.id, new Date('2024-01-01T00:00:00Z'), null)

      const day = (who: { createdAt: Date }, n: number) => shiftDayKey(utcDayKey(who.createdAt), n)
      const visit = (
        who: { id: string; createdAt: Date },
        n: number,
        source: StreakDay['source'],
      ) => ({
        _id: `${who.id}:${day(who, n)}`,
        userId: who.id,
        day: day(who, n),
        source,
        actions: 0,
      })
      await streakDays().insertMany([
        visit(a, 1, 'checkIn'),
        visit(a, 7, 'activity'),
        visit(c, 1, 'purchase'),
      ])

      return { a, b, c, admin }
    }

    // Built once: a sign-up costs more than any assertion made about it, and
    // every test below only reads. The ones that add somebody add somebody the
    // cohort must ignore.
    let world: Awaited<ReturnType<typeof buildWorld>>
    beforeAll(async () => {
      world = await buildWorld()
    }, 120_000)

    it('counts who came back, who activated and how first messages fared', async () => {
      const { a, admin } = world
      const body = (await get(admin, '/admin/measure')).json<AdminMeasure>()

      const cohort = body.cohorts.find((row) => row.weekStart === weekStartKey(a.createdAt))
      expect(cohort?.signedUp).toBe(3)
      // Only `a` was back on the first day; `c`'s bought day is not a visit.
      expect(cohort?.returned.d1).toEqual({ count: 1, of: 3 })
      expect(cohort?.returned.d7).toEqual({ count: 1, of: 3 })
      expect(cohort?.returned.d30).toEqual({ count: 0, of: 0 })
      // Only `a` had two conversations answered inside the window.
      expect(cohort?.activated).toEqual({ count: 1, of: 3 })
      expect(body.cohortTotals.signedUp).toBe(3)
      expect(body.cohortTotals.activated).toEqual({ count: 1, of: 3 })

      const week = body.firstMessages.find((row) => row.weekStart === weekStartKey(a.createdAt))
      // Six conversations between people. @langx's note and the old one are out.
      expect(week).toMatchObject({ started: 6, settled: 6, unanswered: 4, neverAnswered: 1 })
      // Waits of 4h, 29h, 2h, 99h and 100h: the middle one is 29h.
      expect(week?.medianReplyMinutes).toBe(29 * 60)
      expect(body.firstMessageTotals).toMatchObject({ started: 6, unanswered: 4, neverAnswered: 1 })
      expect(body.truncated).toBe(false)
    })

    it('says which definitions it used', async () => {
      const { admin } = world
      const body = (await get(admin, '/admin/measure')).json<AdminMeasure>()
      expect(body.rules).toEqual({
        activationConversations: ACTIVATION_RULES.conversations,
        activationWindowHours: ACTIVATION_RULES.windowHours,
        unansweredAfterHours: FIRST_MESSAGE_RULES.unansweredAfterHours,
        returnRecordedFrom: RETURN_RECORDED_FROM,
      })
    })

    it('leaves guests and deleted accounts out of the cohort', async () => {
      const { a, admin } = world
      const guest = await joined(10)
      const gone = await joined(10)
      await profiles().updateOne({ _id: guest.id }, { $set: { guest: true } })
      await profiles().updateOne({ _id: gone.id }, { $set: { deletedAt: new Date() } })
      forgetAdminMeasure()

      const body = (await get(admin, '/admin/measure')).json<AdminMeasure>()
      const cohort = body.cohorts.find((row) => row.weekStart === weekStartKey(a.createdAt))
      expect(cohort?.signedUp).toBe(3)
    })

    it('keeps every week of the window, empty ones too, newest first', async () => {
      const { admin } = world
      const body = (await get(admin, '/admin/measure?weeks=4')).json<AdminMeasure>()
      expect(body.weeks).toBe(4)
      expect(body.cohorts).toHaveLength(4)
      expect(body.firstMessages).toHaveLength(4)
      const keys = body.cohorts.map((row) => row.weekStart)
      expect(keys).toEqual([...keys].sort().reverse())
      expect(keys[0]).toBe(weekStartKey(new Date()))
    })

    it('does not count a member who joined before the weeks asked for', async () => {
      // Ten days ago is before the start of the current week.
      const { admin } = world
      const body = (await get(admin, '/admin/measure?weeks=1')).json<AdminMeasure>()
      expect(body.cohorts).toHaveLength(1)
      expect(body.cohortTotals.signedUp).toBe(0)
    })

    it('remembers the answer for a few minutes', async () => {
      const { admin } = world
      const first = (await get(admin, '/admin/measure')).json<AdminMeasure>()
      const second = (await get(admin, '/admin/measure')).json<AdminMeasure>()
      expect(second.generatedAt).toBe(first.generatedAt)
      forgetAdminMeasure()
      await new Promise((resolve) => setTimeout(resolve, 5))
      const third = (await get(admin, '/admin/measure')).json<AdminMeasure>()
      expect(third.generatedAt).not.toBe(first.generatedAt)
    })
  })

  describe('refusals per limit', () => {
    it('counts what is inside the window, and calls a refusal with no kind unknown', async () => {
      const admin = await newAdmin()
      const r1 = await newUser()
      const r2 = await newUser()
      const r3 = await newUser()
      const r4 = await newUser()
      const r5 = await newUser()
      const now = Date.now()
      const ago = (ms: number) => new Date(now - ms)
      const old = ago(QUOTA_REFUSAL_WINDOW_MS + HOUR)

      // Two of three have a kind; the third was recorded before kinds were kept.
      await profiles().updateOne(
        { _id: r1.userId },
        {
          $set: {
            quotaRefusals: [ago(HOUR), ago(2 * HOUR), ago(3 * HOUR)],
            quotaRefusalKinds: [
              { at: ago(HOUR), kind: 'initiations' },
              { at: ago(2 * HOUR), kind: 'translations' },
            ],
          },
        },
      )
      await profiles().updateOne(
        { _id: r2.userId },
        {
          $set: {
            quotaRefusals: [ago(HOUR)],
            quotaRefusalKinds: [{ at: ago(HOUR), kind: 'initiations' }],
          },
        },
      )
      // Everything they were refused is outside the window.
      await profiles().updateOne({ _id: r3.userId }, { $set: { quotaRefusals: [old] } })
      // One inside, one outside: only the inside one counts.
      await profiles().updateOne(
        { _id: r4.userId },
        {
          $set: {
            quotaRefusals: [ago(HOUR), old],
            quotaRefusalKinds: [
              { at: ago(HOUR), kind: 'media' },
              { at: old, kind: 'media' },
            ],
          },
        },
      )
      // And one produced the way production produces them.
      const limit = quotaLimit('free', 'initiations') ?? 0
      for (let index = 0; index <= limit; index++) {
        await consumeQuota(handle.db, r5.userId, 'free', 'initiations')
      }
      forgetAdminMeasure()

      const body = (await get(admin, '/admin/measure')).json<AdminMeasure>()
      expect(body.refusals.windowDays).toBe(Math.round(QUOTA_REFUSAL_WINDOW_MS / DAY))
      expect(body.refusals.kinds).toEqual([
        { kind: 'initiations', refusals: 3, people: 3 },
        { kind: 'media', refusals: 1, people: 1 },
        { kind: 'translations', refusals: 1, people: 1 },
        { kind: 'unknown', refusals: 1, people: 1 },
      ])
    })

    it('finds the refused through the index and not by reading every profile', async () => {
      const plan = await profiles()
        .find({ quotaRefusals: { $gte: new Date() } })
        .explain('queryPlanner')
      const { winningPlan } = (plan as { queryPlanner: { winningPlan: unknown } }).queryPlanner
      const text = JSON.stringify(winningPlan)
      expect(text).toContain('IXSCAN')
      expect(text).toContain('quota_refusals')
    })
  })

  describe("one person's money timeline", () => {
    async function buildFixture() {
      const admin = await newAdmin()
      const person = await newUser()
      // One clock for the whole fixture, so two lines "twelve days ago" are
      // the same instant and the order the test expects does not depend on
      // which statement ran first.
      const base = Date.now()
      const at = (daysAgo: number) => new Date(base - daysAgo * DAY)
      await profiles().updateOne(
        { _id: person.userId },
        {
          $set: {
            createdAt: at(20),
            // Written when the expiry is applied, so a moment after it.
            churnedFrom: { tier: 'pro', at: new Date(at(12).getTime() + 1000) },
            entitlement: { tier: 'free', willRenew: false, updatedAt: at(12) },
          },
        },
      )

      const event = (
        id: string,
        type: string,
        daysAgo: number,
        expiresInDays: number | null,
        environment = 'PRODUCTION',
      ): SubscriptionRecord => ({
        eventId: id,
        userId: person.userId,
        type,
        store: 'APP_STORE',
        productId: 'pro_monthly',
        expiresAt:
          expiresInDays === null ? null : new Date(at(daysAgo).getTime() + expiresInDays * DAY),
        environment,
        createdAt: at(daysAgo),
      })
      await handle.db
        .collection<SubscriptionRecord>(COLLECTIONS.subscriptions)
        .insertMany([
          event('e1', 'INITIAL_PURCHASE', 19, 7),
          event('e2', 'CANCELLATION', 18, 1),
          event('e3', 'EXPIRATION', 12, -1),
          event('e4', 'INITIAL_PURCHASE', 5, 7, 'SANDBOX'),
        ])
      await handle.db.collection<ProGift>(COLLECTIONS.proGifts).insertOne({
        _id: `streak:7:${person.userId}`,
        userId: person.userId,
        months: 0,
        weeks: 1,
        source: 'streak',
        status: 'granted',
        endsAt: at(8),
        lockedUntil: at(15),
        attempts: 1,
        createdAt: at(15),
        grantedAt: at(15),
      })
      return { admin, person }
    }

    let fixture: Awaited<ReturnType<typeof buildFixture>>
    beforeAll(async () => {
      fixture = await buildFixture()
    }, 60_000)

    it('lists gifts, store events and the fall to free, newest first', async () => {
      const { admin, person } = fixture
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()

      expect(body.userId).toBe(person.userId)
      expect(body.truncated).toBe(false)
      expect(body.items.map((item) => (item.kind === 'store' ? item.event : item.kind))).toEqual([
        'INITIAL_PURCHASE', // the sandbox one, 5 days ago
        'churn',
        'EXPIRATION',
        'gift',
        'CANCELLATION',
        'INITIAL_PURCHASE',
      ])
      const times = body.items.map((item) => item.at)
      expect(times).toEqual([...times].sort().reverse())
    })

    it('dates each line by how long after joining it happened', async () => {
      const { admin, person } = fixture
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()
      const first = body.items.find(
        (item) => item.kind === 'store' && item.event === 'INITIAL_PURCHASE' && !item.sandbox,
      )
      // Joined 20 days ago, first event 19 days ago.
      expect(first?.daysAfterJoin).toBe(1)
      const gift = body.items.find((item) => item.kind === 'gift')
      expect(gift?.daysAfterJoin).toBe(5)
    })

    it('says how long the period a start opened was, and nothing for an expiry', async () => {
      const { admin, person } = fixture
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()
      const stores = body.items.flatMap((item) => (item.kind === 'store' ? [item] : []))
      expect(
        stores.find((item) => item.event === 'INITIAL_PURCHASE' && !item.sandbox)?.periodDays,
      ).toBe(7)
      expect(stores.find((item) => item.event === 'EXPIRATION')?.periodDays).toBeNull()
    })

    it('marks a sandbox event so it is not read as money', async () => {
      const { admin, person } = fixture
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()
      const stores = body.items.flatMap((item) => (item.kind === 'store' ? [item] : []))
      expect(stores.filter((item) => item.sandbox)).toHaveLength(1)
    })

    it('carries the gift as it is recorded', async () => {
      const { admin, person } = fixture
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()
      expect(body.items.find((item) => item.kind === 'gift')).toMatchObject({
        source: 'streak',
        months: 0,
        weeks: 1,
        status: 'granted',
      })
    })

    it('reports the entitlement as it stands, as free once it has lapsed', async () => {
      const { admin, person } = fixture
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()
      expect(body.now.tier).toBe('free')
      expect(body.now.willRenew).toBe(false)
    })

    it('is empty, not an error, for someone with no money history', async () => {
      const admin = await newAdmin()
      const person = await newUser()
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()
      expect(body.items).toEqual([])
      expect(body.truncated).toBe(false)
    })

    it('says when it stopped reading', async () => {
      const admin = await newAdmin()
      const person = await newUser()
      const rows = Array.from({ length: ADMIN_MONEY_TIMELINE_ROWS + 1 }, (_, index) => ({
        eventId: `bulk-${person.userId}-${index}`,
        userId: person.userId,
        type: 'RENEWAL',
        store: 'APP_STORE',
        productId: 'pro_monthly',
        expiresAt: null,
        environment: 'PRODUCTION',
        createdAt: new Date(Date.now() - index * HOUR),
      }))
      await handle.db.collection<SubscriptionRecord>(COLLECTIONS.subscriptions).insertMany(rows)
      const body = (
        await get(admin, `/admin/users/${person.userId}/money`)
      ).json<AdminMoneyTimeline>()
      expect(body.items).toHaveLength(ADMIN_MONEY_TIMELINE_ROWS)
      expect(body.truncated).toBe(true)
    })
  })
})
