import {
  COSMETICS,
  STREAK_FREEZE_SKU,
  STREAK_RESTORE_SKU,
  TOKEN_RULES,
  activityScore,
  poolShare,
  shiftDayKey,
  streakRestorePrice,
  utcDayKey,
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
        birthYear: 1995,
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

  describe('token sinks', () => {
    /**
     * `legacyRestore.ts` promised this in a comment from the day it was
     * written — "`frozenStreak` is what they can buy back" — and there was no
     * way to buy it, so the welcome-back screen could name a streak and offer
     * nothing to do about it.
     */
    describe('restoring a v1 streak', () => {
      async function stageReturningUser(frozenStreak: number, tokens: number) {
        const user = await newUser()
        await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
          { _id: user.userId },
          {
            $set: {
              restoredFromV1: {
                at: new Date(),
                tokensCredited: 0,
                frozenStreak,
                conversationsImported: 0,
              },
            },
          },
        )
        if (tokens > 0) {
          await awardTokens(handle.db, {
            userId: user.userId,
            kind: 'adjustment',
            amount: tokens,
            refId: `streak-restore-${user.userId}`,
          })
        }
        return user
      }

      it('brings the streak back and charges for it by length', async () => {
        const user = await stageReturningUser(12, 1000)
        const price = streakRestorePrice(12)

        const response = await buy(user, STREAK_RESTORE_SKU)
        expect(response.statusCode, response.body).toBe(200)
        expect(response.json()).toMatchObject({ sku: STREAK_RESTORE_SKU, price })

        const profile = await handle.db
          .collection<Profile>(COLLECTIONS.profiles)
          .findOne({ _id: user.userId })
        expect(profile?.streak.current).toBe(12)
        expect(profile?.streak.longest).toBeGreaterThanOrEqual(12)
        // Alive today — they bought it, so it does not break the moment they
        // close the app; keeping it going from tomorrow is on them.
        expect(profile?.streak.lastQualifiedDay).toBeTruthy()
        expect((await wallet(user)).spent).toBe(price)
      })

      it('is a latch — a second attempt is refused, not charged', async () => {
        const user = await stageReturningUser(10, 2000)

        expect((await buy(user, STREAK_RESTORE_SKU)).statusCode).toBe(200)
        const spentAfterFirst = (await wallet(user)).spent

        const second = await buy(user, STREAK_RESTORE_SKU)
        expect(second.statusCode).toBe(400)
        expect((await wallet(user)).spent).toBe(spentAfterFirst)
      })

      it('lets exactly one of several simultaneous taps through', async () => {
        const user = await stageReturningUser(10, 5000)

        const results = await Promise.all(
          Array.from({ length: 5 }, () => buy(user, STREAK_RESTORE_SKU)),
        )
        expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1)
        expect((await wallet(user)).spent).toBe(streakRestorePrice(10))
      })

      it('refuses when the balance will not cover it, and changes nothing', async () => {
        const user = await stageReturningUser(100, 50)

        const response = await buy(user, STREAK_RESTORE_SKU)
        expect(response.statusCode).toBe(400)

        const profile = await handle.db
          .collection<Profile>(COLLECTIONS.profiles)
          .findOne({ _id: user.userId })
        expect(profile?.streak.current).toBe(0)
        expect((await wallet(user)).spent).toBe(0)
      })

      it('has nothing to sell someone who never came back from v1', async () => {
        const user = await newUser()
        await awardTokens(handle.db, {
          userId: user.userId,
          kind: 'adjustment',
          amount: 5000,
          refId: `no-v1-${user.userId}`,
        })
        expect((await buy(user, STREAK_RESTORE_SKU)).statusCode).toBe(404)
      })
    })

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

      const responses = await Promise.all(Array.from({ length: 5 }, () => buy(user, frame.id)))
      expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1)
      expect((await wallet(user)).spent).toBe(frame.price)
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
