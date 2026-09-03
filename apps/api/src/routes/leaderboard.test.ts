import {
  COSMETICS,
  STREAK_FREEZE_SKU,
  TOKEN_RULES,
  activityScore,
  poolShare,
  shiftDayKey,
  utcDayKey,
  type BadgeSummary,
  type Leaderboard,
  type Wallet,
  type TokenSummary,
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
import type { Profile } from '../modules/profiles/profiles'
import type { DailyActivity } from '../modules/tokens/dailyActivity'
import { awardTokens, type TokenAggregate, type TokenLedgerEntry } from '../modules/tokens/ledger'
import { DAILY_POOL_JOB, runDailyPool, type JobRun } from '../modules/tokens/pool'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const YESTERDAY = shiftDayKey(utcDayKey(new Date()), -1)

describe('Faz 9 — daily pool, leaderboards and token sinks', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(overrides: Record<string, unknown> = {}): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `faz9-${seq}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `faz9user${seq}`,
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

  /** Puts a user's account age safely outside the pool ramp-up window. */
  function ageAccount(userId: string, days = 30) {
    return handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: userId }, { $set: { createdAt: new Date(Date.now() - days * 86_400_000) } })
  }

  function seedActivity(userId: string, counters: Partial<DailyActivity>, day = YESTERDAY) {
    return handle.db.collection<DailyActivity>(COLLECTIONS.dailyActivity).insertOne({
      _id: `${userId}:${day}`,
      userId,
      day,
      messages: 0,
      corrections: 0,
      mutualConversations: 0,
      partners: [],
      perPartner: {},
      updatedAt: new Date(),
      ...counters,
    })
  }

  function totalXp(): Promise<number> {
    return handle.db
      .collection<TokenAggregate>(COLLECTIONS.tokenAggregates)
      .aggregate<{ total: number }>([
        { $match: { periodType: 'all' } },
        { $group: { _id: null, total: { $sum: '$tokens' } } },
      ])
      .toArray()
      .then((rows) => rows[0]?.total ?? 0)
  }

  async function board(user: SignedUpUser, query = ''): Promise<Leaderboard> {
    const response = await app.inject({
      method: 'GET',
      url: `/leaderboard${query}`,
      headers: { cookie: user.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    return response.json<Leaderboard>()
  }

  async function wallet(user: SignedUpUser): Promise<Wallet> {
    const response = await app.inject({
      method: 'GET',
      url: '/me/wallet',
      headers: { cookie: user.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    return response.json<Wallet>()
  }

  function buy(user: SignedUpUser, sku: string) {
    return app.inject({
      method: 'POST',
      url: '/me/wallet/purchase',
      headers: { cookie: user.cookie },
      payload: { sku },
    })
  }

  /**
   * Grants every rung below `sku` directly, the way a welcome pack does.
   * Tests about the price, the earned gate or the race are not about the
   * ladder, and buying nine frames to reach the tenth would bury what each of
   * them is actually asserting.
   */
  async function ownLadderBelow(userId: string, sku: string) {
    const target = COSMETICS.find((c) => c.id === sku)!
    const ladder = COSMETICS.filter((c) => c.kind === target.kind)
    const below = ladder
      .slice(
        0,
        ladder.findIndex((c) => c.id === sku),
      )
      .map((c) => c.id)
    if (below.length === 0) return
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: userId }, { $set: { cosmetics: below } })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_faz9_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_faz9_test',
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

  describe('daily pool', () => {
    it('counts how many people are active today, and promises nothing about tonight', async () => {
      const user = await newUser()
      const today = utcDayKey(new Date())

      const readPool = () =>
        app
          .inject({ method: 'GET', url: '/me/tokens', headers: { cookie: user.cookie } })
          .then((r) => r.json<TokenSummary>())
          .then((s) => s.pool)

      // Deltas rather than absolutes: earlier tests in this file legitimately
      // leave today's activity behind, and the count reports all of it.
      const before = await readPool()
      await seedActivity('pool-live-a', { messages: 10 }, today)
      await seedActivity('pool-live-b', { messages: 5, corrections: 2 }, today)
      const after = await readPool()

      expect(after.activeToday - before.activeToday).toBe(2)
      // No projected share is exposed at all. A brand-new account is inside
      // the ramp-up and would be paid nothing tonight, so any forward-looking
      // number here would be one the payout refuses to honour.
      expect(after.lastPayout).toBeNull()
      expect(after).not.toHaveProperty('totalScore')
    })

    it('reports the share the pool actually paid, against the day it was earned for', async () => {
      const user = await newUser()
      await ageAccount(user.userId)
      const day = shiftDayKey(YESTERDAY, -7)
      await seedActivity(user.userId, { messages: 12, corrections: 3 }, day)

      const outcome = await runDailyPool(handle.db, { day })
      expect(outcome.ran).toBe(true)

      const summary = await app
        .inject({ method: 'GET', url: '/me/tokens', headers: { cookie: user.cookie } })
        .then((r) => r.json<TokenSummary>())

      expect(summary.pool.lastPayout).not.toBeNull()
      // The day it rewards, not the midnight it was written at. `awardTokens`
      // stamps a pool row's `day` from `dayCloseAt(day)`, which is already the
      // morning after — showing that date would date every share one day late.
      expect(summary.pool.lastPayout?.day).toBe(day)
      expect(summary.pool.lastPayout?.amount).toBeGreaterThan(0)

      const row = await handle.db
        .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
        .findOne({ userId: user.userId, kind: 'dailyPool', refId: day })
      expect(summary.pool.lastPayout?.amount).toBe(row?.amount)
    })

    it('splits the pool in proportion to activity, and pays nothing twice on a re-run', async () => {
      const day = shiftDayKey(YESTERDAY, -1)
      // 40 participants keeps every share under `maxShareOfPool`, so this
      // measures proportionality rather than the cap (which has its own test).
      const busyId = 'pool-busy'
      const quietIds = Array.from({ length: 39 }, (_, i) => `pool-quiet-${i}`)
      await handle.db.collection<Profile>(COLLECTIONS.profiles).insertMany(
        // `handle` is required even here: `handle_unique` counts a missing
        // field as null, so a second handle-less profile is a duplicate key.
        [busyId, ...quietIds].map(
          (_id) =>
            ({
              _id,
              handle: _id,
              displayName: _id,
              createdAt: new Date(Date.now() - 30 * 86_400_000),
            }) as unknown as Profile,
        ),
      )
      // messages weigh 1 each: 20 vs 10 is exactly a 2x activity score.
      await seedActivity(busyId, { messages: 20 }, day)
      for (const id of quietIds) await seedActivity(id, { messages: 10 }, day)

      const before = await totalXp()
      const first = await runDailyPool(handle.db, { day })
      expect(first.ran).toBe(true)
      const afterFirst = await totalXp()
      expect(afterFirst).toBeGreaterThan(before)

      const busyScore = activityScore({
        messages: 20,
        corrections: 0,
        mutualConversations: 0,
        distinctPartners: 0,
      })
      const quietScore = activityScore({
        messages: 10,
        corrections: 0,
        mutualConversations: 0,
        distinctPartners: 0,
      })
      const total = busyScore + 39 * quietScore
      expect(first.ran && first.result.totalScore).toBe(total)
      expect(first.ran && first.result.paid).toBe(40)

      const rowFor = (userId: string) =>
        handle.db
          .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
          .findOne({ userId, kind: 'dailyPool', refId: day })
      const busyRow = await rowFor(busyId)
      const quietRow = await rowFor(quietIds[0]!)
      expect(busyRow?.amount).toBe(poolShare(busyScore, total))
      // Twice the activity, twice the share — and neither is at the cap.
      expect(busyRow!.amount).toBeGreaterThan(quietRow!.amount)
      const cap = Math.floor(TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool)
      expect(busyRow!.amount).toBeLessThan(cap)
      expect(first.ran && first.result.distributed).toBeLessThanOrEqual(TOKEN_RULES.pool.total)

      // The done-criterion: running it again changes nothing at all.
      const second = await runDailyPool(handle.db, { day })
      expect(second.ran).toBe(false)
      expect(await totalXp()).toBe(afterFirst)
    })

    it('still refuses to pay twice when the job lock itself is wiped', async () => {
      const user = await newUser()
      await ageAccount(user.userId)
      const day = shiftDayKey(YESTERDAY, -2)
      await seedActivity(user.userId, { messages: 10, partners: ['x'] }, day)

      await runDailyPool(handle.db, { day })
      const afterFirst = await totalXp()

      // Simulate the lock being lost — a restored backup, a manual delete.
      await handle.db
        .collection<JobRun>(COLLECTIONS.jobRuns)
        .deleteOne({ job: DAILY_POOL_JOB, periodKey: day })

      const second = await runDailyPool(handle.db, { day })
      expect(second.ran).toBe(true) // the lock let it through...
      expect(second.ran && second.result.paid).toBe(0) // ...but the ledger did not
      expect(await totalXp()).toBe(afterFirst)
    })

    it('pays no share to an account younger than the ramp-up window', async () => {
      const fresh = await newUser() // createdAt is now, well inside the window
      const day = shiftDayKey(YESTERDAY, -3)
      await seedActivity(fresh.userId, { messages: 30, partners: ['y'] }, day)

      const outcome = await runDailyPool(handle.db, { day })
      expect(outcome.ran && outcome.result.skippedNewAccounts).toBe(1)
      expect(outcome.ran && outcome.result.paid).toBe(0)
    })

    it('pays no share to a user whose token is frozen', async () => {
      const user = await newUser()
      await ageAccount(user.userId)
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { tokenFrozenAt: new Date() } })
      const day = shiftDayKey(YESTERDAY, -4)
      await seedActivity(user.userId, { messages: 30, partners: ['z'] }, day)

      const outcome = await runDailyPool(handle.db, { day })
      expect(outcome.ran && outcome.result.skippedFrozen).toBe(1)
      expect(outcome.ran && outcome.result.paid).toBe(0)
    })

    it('distributes nothing on a day nobody was active', async () => {
      const day = shiftDayKey(YESTERDAY, -5)
      const before = await totalXp()
      const outcome = await runDailyPool(handle.db, { day })
      expect(outcome.ran && outcome.result.distributed).toBe(0)
      expect(await totalXp()).toBe(before)
    })

    it('caps one user share of the pool however lopsided the day was', async () => {
      const whale = await newUser()
      await ageAccount(whale.userId)
      const day = shiftDayKey(YESTERDAY, -6)
      await seedActivity(whale.userId, { messages: 999, corrections: 999, partners: ['1'] }, day)

      await runDailyPool(handle.db, { day })
      const row = await handle.db
        .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
        .findOne({ userId: whale.userId, kind: 'dailyPool', refId: day })
      // Sole participant, so an uncapped share would be the whole pool.
      expect(row?.amount).toBe(Math.floor(TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool))
      expect(row?.amount).toBeLessThan(TOKEN_RULES.pool.total)
    })
  })

  describe('leaderboards', () => {
    it('ranks by token and marks the viewer', async () => {
      const first = await newUser()
      const second = await newUser()
      await awardTokens(handle.db, {
        userId: first.userId,
        kind: 'adjustment',
        amount: 900,
        refId: 'lb-1',
      })
      await awardTokens(handle.db, {
        userId: second.userId,
        kind: 'adjustment',
        amount: 400,
        refId: 'lb-2',
      })

      const result = await board(first, '?period=all')
      const mine = result.entries.find((e) => e.userId === first.userId)
      const theirs = result.entries.find((e) => e.userId === second.userId)
      expect(mine?.isViewer).toBe(true)
      expect(theirs?.isViewer).toBe(false)
      expect(mine!.rank).toBeLessThan(theirs!.rank)
      expect(mine?.handle).toBeTruthy()
      expect(result.viewer.inPage).toBe(true)
      expect(result.viewer.rank).toBe(mine?.rank)
    })

    it('gives tied scores the same rank, and agrees with the count-based rank', async () => {
      const a = await newUser()
      const b = await newUser()
      const tie = 777
      await awardTokens(handle.db, {
        userId: a.userId,
        kind: 'adjustment',
        amount: tie,
        refId: 'tie-a',
      })
      await awardTokens(handle.db, {
        userId: b.userId,
        kind: 'adjustment',
        amount: tie,
        refId: 'tie-b',
      })

      const result = await board(a, '?period=all')
      const rankA = result.entries.find((e) => e.userId === a.userId)?.rank
      const rankB = result.entries.find((e) => e.userId === b.userId)?.rank
      expect(rankA).toBe(rankB)
      // The viewer's own rank comes from a different query (count of everyone
      // strictly above); the two must not disagree.
      expect(result.viewer.rank).toBe(rankA)
    })

    /**
     * `rankOf` counts from the page's own index, so page two would restart at
     * 1 — and a tie spanning the boundary would be told two different
     * positions depending on which page it landed on. The page's starting
     * rank is asked for with the same count the viewer rank uses, so this
     * holds by construction.
     */
    it('keeps ranks continuous across pages, including a tie on the boundary', async () => {
      const users = []
      for (let i = 0; i < 4; i++) users.push(await newUser())
      // 900, 900, 800, 700 — the tie sits across a limit=2 boundary.
      const amounts = [900, 900, 800, 700]
      for (const [i, user] of users.entries()) {
        await awardTokens(handle.db, {
          userId: user.userId,
          kind: 'adjustment',
          amount: amounts[i]!,
          refId: `page-tie-${i}`,
        })
      }

      const viewer = users[0]!
      const ourIds = new Set(users.map((u) => u.userId))

      async function walk(limit: number) {
        const found = new Map<string, { rank: number; tokens: number }>()
        let cursor: string | null = null
        do {
          const suffix: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
          const page = await board(viewer, `?period=all&limit=${limit}${suffix}`)
          for (const entry of page.entries) {
            if (ourIds.has(entry.userId)) {
              found.set(entry.userId, { rank: entry.rank, tokens: entry.tokens })
            }
          }
          cursor = page.nextCursor
        } while (cursor)
        return found
      }

      // Two different page sizes put the boundaries in different places. With
      // the page's start index conflated with its first row's rank, a tie
      // straddling a boundary makes these disagree — which is the bug.
      const small = await walk(2)
      const large = await walk(7)

      expect(small.size).toBe(4)
      expect(large.size).toBe(4)
      for (const [userId, entry] of small) {
        expect(large.get(userId)?.rank, `rank for ${userId}`).toBe(entry.rank)
      }

      // The two equal scores share a rank wherever the boundaries fall.
      const byScore = [...small.values()].sort((x, y) => y.tokens - x.tokens)
      const tied = byScore.filter((e) => e.tokens === byScore[0]!.tokens)
      expect(tied).toHaveLength(2)
      expect(tied[0]!.rank).toBe(tied[1]!.rank)

      // And the count-based rank the viewer gets from outside any page still
      // agrees with the one they got inside one.
      const own = small.get(viewer.userId)!
      const board2 = await board(viewer, '?period=all&limit=1')
      expect(board2.viewer.rank).toBe(own.rank)
    })

    it('stops handing out cursors on the last page', async () => {
      const user = await newUser()
      const result = await board(user, '?period=all&limit=100')
      expect(result.nextCursor).toBeNull()
    })

    it('reports a rank for someone outside the requested page', async () => {
      const loner = await newUser()
      await awardTokens(handle.db, {
        userId: loner.userId,
        kind: 'adjustment',
        amount: 1,
        refId: 'low',
      })

      const result = await board(loner, '?period=all&limit=1')
      expect(result.entries).toHaveLength(1)
      expect(result.viewer.inPage).toBe(false)
      expect(result.viewer.rank).toBeGreaterThan(1)
      expect(result.viewer.tokens).toBe(TOKEN_RULES.signupBonus + 1)
    })

    it('serves the four periods and defaults to the current week', async () => {
      const user = await newUser()
      for (const period of ['all', 'year', 'month', 'week'] as const) {
        const result = await board(user, `?period=${period}`)
        expect(result.period).toBe(period)
        expect(result.periodKey).toBeTruthy()
      }
      expect((await board(user)).period).toBe('week')
    })

    it('hides a soft-deleted account without shifting everyone else down', async () => {
      const ghost = await newUser()
      await awardTokens(handle.db, {
        userId: ghost.userId,
        kind: 'adjustment',
        amount: 50_000,
        refId: 'ghost',
      })
      const viewer = await newUser()

      const withGhost = await board(viewer, '?period=all')
      expect(withGhost.entries[0]?.userId).toBe(ghost.userId)

      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: ghost.userId }, { $set: { deletedAt: new Date() } })

      const withoutGhost = await board(viewer, '?period=all')
      expect(withoutGhost.entries.some((e) => e.userId === ghost.userId)).toBe(false)
      // Rank 1 is now vacant rather than reassigned — nobody gets promoted by
      // someone else deleting their account.
      expect(withoutGhost.entries[0]?.rank).toBe(2)
    })
  })

  describe('cosmetics', () => {
    async function buy(user: SignedUpUser, sku: string) {
      return app.inject({
        method: 'POST',
        url: '/me/wallet/purchase',
        headers: { cookie: user.cookie },
        payload: { sku },
      })
    }

    /**
     * The gate, and the reason it is checked at all: `frame.aurora` is the one
     * item money alone cannot reach. A balance far past its price must still
     * be refused.
     */
    it('refuses a gated cosmetic to somebody who has only the token for it', async () => {
      const user = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 200_000,
        refId: 'gate-test-rich',
      })

      const response = await buy(user, 'frame.aurora')
      expect(response.statusCode, response.body).toBe(400)
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(profile?.cosmetics ?? []).not.toContain('frame.aurora')
      // Refused, not charged.
      expect(profile?.tokenSpent ?? 0).toBe(0)
    })

    it('sells it once both halves of the gate are met', async () => {
      const user = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 200_000,
        refId: 'gate-test-earned',
      })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { 'streak.longest': 400 } })
      // The correction half, counted from real rows rather than a field.
      await handle.db.collection(COLLECTIONS.postCorrections).insertMany(
        Array.from({ length: 5000 }, (_, i) => ({
          postId: `post-${i}`,
          authorId: user.userId,
          corrected: 'x',
          createdAt: new Date(),
        })),
      )
      // Aurora sits at the top of the frame ladder as well as behind the
      // earned gate; this test is about the gate.
      await ownLadderBelow(user.userId, 'frame.aurora')

      const response = await buy(user, 'frame.aurora')
      expect(response.statusCode, response.body).toBe(200)
    })

    it('refuses a half-met gate — every condition, not any of them', async () => {
      const user = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 200_000,
        refId: 'gate-test-half',
      })
      // A year-long streak, but nothing taught.
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { 'streak.longest': 400 } })

      expect((await buy(user, 'frame.aurora')).statusCode).toBe(400)
    })

    it('wears only what is owned', async () => {
      const user = await newUser()
      const refuse = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: { equipped: { frame: 'frame.gold' } },
      })
      expect(refuse.statusCode, refuse.body).toBe(400)

      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 5000,
        refId: 'equip-test',
      })
      expect((await buy(user, 'frame.slate')).statusCode).toBe(200)

      const accept = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: { equipped: { frame: 'frame.slate' } },
      })
      expect(accept.statusCode, accept.body).toBe(200)
    })

    /**
     * The two slots are written independently, so a frame change must not
     * clear a title — which a `$set` of the whole object would do.
     */
    it('changes one slot without clearing the other', async () => {
      const user = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 30_000,
        refId: 'equip-slots',
      })
      await buy(user, 'frame.slate')
      await buy(user, 'title.beginner')

      const patch = (equipped: Record<string, string | null>) =>
        app.inject({
          method: 'PATCH',
          url: '/profiles/me',
          headers: { cookie: user.cookie },
          payload: { equipped },
        })

      await patch({ title: 'title.beginner' })
      await patch({ frame: 'frame.slate' })

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(profile?.equipped).toEqual({ title: 'title.beginner', frame: 'frame.slate' })

      // `null` clears a slot and leaves the other alone.
      await patch({ frame: null })
      const cleared = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(cleared?.equipped).toEqual({ title: 'title.beginner' })
    })
  })

  describe('badges', () => {
    async function badgesOf(user: SignedUpUser) {
      const response = await app.inject({
        method: 'GET',
        url: '/me/badges',
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      return response.json<BadgeSummary>()
    }

    /**
     * The trap this file exists to catch. `progressOf` used to take a `string`
     * and fall through to the corrections count for anything that was not a
     * streak, so a kind added to `BADGE_KINDS` measured the wrong number with
     * no type error and no failing test.
     */
    it('measures each kind against its own number', async () => {
      const user = await newUser()
      await ageAccount(user.userId, 400)
      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: user.userId },
        // A long streak and plenty of messages, but nothing else.
        { $set: { 'streak.longest': 200, 'stats.messagesSent': 1200 } },
      )

      const summary = await badgesOf(user)
      const earned = new Set(summary.badges.filter((b) => b.earned).map((b) => b.id))

      expect(earned.has('streak.180')).toBe(true)
      expect(earned.has('streak.365')).toBe(false)
      expect(earned.has('messages.1000')).toBe(true)
      expect(earned.has('messages.10000')).toBe(false)
      expect(earned.has('veteran.365')).toBe(true)
      expect(earned.has('veteran.730')).toBe(false)
      // Never wrote a correction, never earned a token.
      expect(earned.has('correction.1')).toBe(false)
      expect(earned.has('tokens.10000')).toBe(false)
    })

    it('counts token earned, not the balance left after spending', async () => {
      const user = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 12_000,
        refId: 'badge-test',
      })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { tokenSpent: 11_000 } })

      const summary = await badgesOf(user)
      // Balance is 1,000; earned is 12,000, and the badge is for earning.
      expect(summary.badges.find((b) => b.id === 'tokens.10000')?.earned).toBe(true)
    })

    /**
     * `next` used to be the first unearned entry in `BADGES`, which put every
     * streak badge ahead of every other kind. With five kinds that offers a
     * three-year streak to somebody one correction short of a badge they could
     * earn this afternoon.
     */
    it('offers the badge you are closest to, not the first in the list', async () => {
      const user = await newUser()
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { 'stats.messagesSent': 99 } })

      const summary = await badgesOf(user)
      expect(summary.next?.id).toBe('messages.100')
      expect(summary.next?.current).toBe(99)
      // Only the streak milestones pay.
      expect(summary.next?.reward).toBe(0)
    })

    it('dates a veteran badge exactly, and leaves the counting kinds undated', async () => {
      const user = await newUser()
      await ageAccount(user.userId, 400)
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { 'stats.messagesSent': 500 } })

      const summary = await badgesOf(user)
      const veteran = summary.badges.find((b) => b.id === 'veteran.365')
      expect(veteran?.earned).toBe(true)
      expect(veteran?.earnedAt).not.toBeNull()

      const messages = summary.badges.find((b) => b.id === 'messages.100')
      expect(messages?.earned).toBe(true)
      // Nothing records which message was the hundredth.
      expect(messages?.earnedAt).toBeNull()
    })

    /**
     * `streakMilestoneDates` maps a ledger row's amount back to the milestone
     * that paid it, because the row records the day and the amount but never
     * which milestone it was for. `badges.test.ts` in shared holds the payouts
     * distinct; this checks the mapping actually reads them.
     */
    it('dates a streak badge from the ledger row that paid it', async () => {
      const user = await newUser()
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { 'streak.longest': 400 } })
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'streak',
        amount: TOKEN_RULES.streakMilestones[365]!,
        refId: YESTERDAY,
      })

      const summary = await badgesOf(user)
      const at365 = summary.badges.find((b) => b.id === 'streak.365')
      const at180 = summary.badges.find((b) => b.id === 'streak.180')
      expect(at365?.earnedAt).not.toBeNull()
      // Earned by `longest`, but never paid, so there is no row to date it by.
      expect(at180?.earned).toBe(true)
      expect(at180?.earnedAt).toBeNull()
    })
  })

  describe('token sinks', () => {
    it('buys a cosmetic, deducts the balance and leaves the leaderboard untouched', async () => {
      const user = await newUser()
      const frame = COSMETICS.find((c) => c.kind === 'frame')!
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: frame.price + 100,
        refId: 'sink-1',
      })

      const rankBefore = (await board(user, '?period=all')).viewer
      const response = await buy(user, frame.id)
      expect(response.statusCode, response.body).toBe(200)

      const after = await wallet(user)
      expect(after.spent).toBe(frame.price)
      expect(after.balance).toBe(TOKEN_RULES.signupBonus + 100)
      expect(after.owned).toContain(frame.id)
      // Earned token — and therefore the standing — is unchanged by spending.
      expect(after.earned).toBe(TOKEN_RULES.signupBonus + frame.price + 100)
      const rankAfter = (await board(user, '?period=all')).viewer
      expect(rankAfter.tokens).toBe(rankBefore.tokens)
      expect(rankAfter.rank).toBe(rankBefore.rank)
    })

    it('refuses a purchase the balance cannot cover', async () => {
      const user = await newUser()
      const priciest = COSMETICS.reduce((a, b) => (a.price > b.price ? a : b))
      // Everything below it granted, so the balance is the only thing left in
      // the way — otherwise this would pass on the ladder's message instead.
      await ownLadderBelow(user.userId, priciest.id)
      const response = await buy(user, priciest.id)
      expect(response.statusCode).toBe(400)
      expect(response.json<{ message: string }>().message).toContain('Not enough token')
    })

    it('lets exactly one of several concurrent buys of the same item through', async () => {
      const user = await newUser()
      const frame = COSMETICS.find((c) => c.id === 'frame.silver')!
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: frame.price * 5,
        refId: 'sink-race',
      })

      await ownLadderBelow(user.userId, frame.id)

      const responses = await Promise.all(Array.from({ length: 5 }, () => buy(user, frame.id)))
      expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1)
      expect((await wallet(user)).spent).toBe(frame.price)
    })

    /**
     * The ladder. The catalogue's order is the rule now — each item needs the
     * one below it in the same kind — so the prestige rows cannot be reached
     * by saving up and skipping the middle. The total sink is unchanged; what
     * changed is that you cannot buy the top of it first.
     */
    describe('the ladder', () => {
      async function rich(sku: string) {
        const user = await newUser()
        await awardTokens(handle.db, {
          userId: user.userId,
          kind: 'adjustment',
          amount: 500_000,
          refId: `ladder-${sku}-${user.userId}`,
        })
        return user
      }

      it('sells the first rung of a ladder to anybody who can pay', async () => {
        const user = await rich('frame.slate')
        expect((await buy(user, 'frame.slate')).statusCode).toBe(200)
      })

      it('refuses a rung whose predecessor is missing, and charges nothing', async () => {
        const user = await rich('frame.gold')

        const response = await buy(user, 'frame.gold')
        expect(response.statusCode, response.body).toBe(400)
        expect(response.json<{ message: string }>().message).toContain('frame.ember')

        const profile = await handle.db
          .collection<Profile>(COLLECTIONS.profiles)
          .findOne({ _id: user.userId })
        expect(profile?.cosmetics ?? []).not.toContain('frame.gold')
        expect(profile?.tokenSpent ?? 0).toBe(0)
      })

      it('sells it the moment the rung below is owned', async () => {
        const user = await rich('frame.gold')
        await ownLadderBelow(user.userId, 'frame.gold')
        expect((await buy(user, 'frame.gold')).statusCode).toBe(200)
      })

      it('keeps frames and titles as two ladders, not one queue', async () => {
        const user = await rich('title.beginner')
        // No frames owned at all, and the first title is still buyable.
        expect((await buy(user, 'title.beginner')).statusCode).toBe(200)
      })

      /**
       * The reason the condition is in the update's filter and not only in the
       * read before it.
       *
       * What is asserted is the *outcome*, not which of the two requests won.
       * Fired together they may genuinely serialise — slate commits, bronze's
       * filter then sees it, and bronze lands legitimately, because buying the
       * two in order is exactly what the ladder allows. An earlier version of
       * this test demanded that bronze be refused, which held locally and
       * failed on CI for no reason other than timing.
       *
       * The invariant that does hold under every interleaving: what ends up
       * owned is a **prefix** of the ladder. Never bronze without slate, which
       * is the thing the filter exists to make impossible.
       */
      it('never lands a rung above one that is not owned, however they interleave', async () => {
        const user = await rich('frame.bronze')

        const [slate, bronze] = await Promise.all([
          buy(user, 'frame.slate'),
          buy(user, 'frame.bronze'),
        ])
        // Slate has no predecessor, so it is always allowed.
        expect(slate.statusCode, slate.body).toBe(200)
        expect([200, 400]).toContain(bronze.statusCode)

        const profile = await handle.db
          .collection<Profile>(COLLECTIONS.profiles)
          .findOne({ _id: user.userId })
        const owned = profile?.cosmetics ?? []
        const ladder = COSMETICS.filter((c) => c.kind === 'frame').map((c) => c.id)
        expect(owned.length).toBeGreaterThan(0)
        expect([...owned].sort()).toEqual(ladder.slice(0, owned.length).sort())

        // And the charge matches what was actually granted, either way.
        const spent = owned.reduce((sum, id) => sum + COSMETICS.find((c) => c.id === id)!.price, 0)
        expect(profile?.tokenSpent ?? 0).toBe(spent)
      })
    })

    it('rejects an unknown sku', async () => {
      const user = await newUser()
      expect((await buy(user, 'frame.diamond')).statusCode).toBe(404)
    })

    it('banks a streak freeze and spends it to bridge one missed day', async () => {
      const user = await newUser()
      const other = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: TOKEN_RULES.sinks.streakFreeze * 3,
        refId: 'freeze-funds',
      })
      expect((await buy(user, STREAK_FREEZE_SKU)).statusCode).toBe(200)
      expect((await wallet(user)).streakFreezes).toBe(1)

      // A streak of 5 that last qualified two days ago: one day was missed.
      const today = utcDayKey(new Date())
      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: user.userId },
        {
          $set: {
            'streak.current': 5,
            'streak.longest': 5,
            'streak.lastQualifiedDay': shiftDayKey(today, -2),
          },
        },
      )

      const started = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { cookie: user.cookie },
        payload: { toUserId: other.userId, body: 'bridging the gap' },
      })
      expect(started.statusCode, started.body).toBe(201)

      const summary = await app
        .inject({ method: 'GET', url: '/me/tokens', headers: { cookie: user.cookie } })
        .then((r) => r.json<TokenSummary>())
      expect(summary.streak.current).toBe(6) // continued, not reset to 1
      expect(summary.wallet.streakFreezes).toBe(0) // and the freeze was consumed
    })

    it('will not bank more freezes than the cap allows', async () => {
      const user = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: TOKEN_RULES.sinks.streakFreeze * 10,
        refId: 'freeze-cap',
      })
      for (let i = 0; i < TOKEN_RULES.sinks.maxBankedStreakFreezes; i++) {
        expect((await buy(user, STREAK_FREEZE_SKU)).statusCode).toBe(200)
      }
      const overflow = await buy(user, STREAK_FREEZE_SKU)
      expect(overflow.statusCode).toBe(400)
      expect((await wallet(user)).streakFreezes).toBe(TOKEN_RULES.sinks.maxBankedStreakFreezes)
    })

    it('does not let a freeze paper over a two-day gap', async () => {
      const user = await newUser()
      const other = await newUser()
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: TOKEN_RULES.sinks.streakFreeze,
        refId: 'freeze-widegap',
      })
      await buy(user, STREAK_FREEZE_SKU)

      const today = utcDayKey(new Date())
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne(
          { _id: user.userId },
          { $set: { 'streak.current': 9, 'streak.lastQualifiedDay': shiftDayKey(today, -3) } },
        )
      await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { cookie: user.cookie },
        payload: { toUserId: other.userId, body: 'three days later' },
      })

      const summary = await app
        .inject({ method: 'GET', url: '/me/tokens', headers: { cookie: user.cookie } })
        .then((r) => r.json<TokenSummary>())
      expect(summary.streak.current).toBe(1) // reset
      expect(summary.wallet.streakFreezes).toBe(1) // and the freeze was not touched
    })
  })
})
