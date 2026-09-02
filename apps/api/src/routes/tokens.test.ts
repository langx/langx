import {
  TOKEN_GRANT_KINDS,
  TOKEN_RULES,
  localDayKey,
  periodKeys,
  shiftDayKey,
  utcDayKey,
  type TokenHistory,
  type TokenSummary,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { grantSignupBonus } from '../modules/tokens/signupBonus'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import { awardTokens, type TokenLedgerEntry } from '../modules/tokens/ledger'
import type { StreakDay } from '../modules/tokens/streakDays'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

describe('Faz 8 — streak, token ledger and direct awards', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, profileOverrides: Record<string, unknown> = {}) {
    const user = await signUpAndSignIn(app, emailSender, {
      email,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(profileOverrides),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  async function startConversation(from: SignedUpUser, toUserId: string, body = 'hi') {
    const response = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: from.cookie },
      payload: { toUserId, body },
    })
    if (response.statusCode !== 201) {
      throw new Error(`start conversation failed (${response.statusCode}): ${response.body}`)
    }
    return response.json<{ _id: string }>()._id
  }

  /**
   * There is no REST endpoint for replying — Faz 5 put that on the socket —
   * so the reply path is driven through the module the socket handler calls,
   * which is the same function and therefore the same award path.
   */
  async function reply(senderId: string, conversationId: string, body = 'reply') {
    const { sendTextMessage } = await import('../modules/chat/messages')
    return sendTextMessage(handle.db, senderId, { conversationId, body })
  }

  async function correct(senderId: string, conversationId: string, targetMessageId: string) {
    const { sendCorrection } = await import('../modules/chat/messages')
    return sendCorrection(handle.db, senderId, {
      conversationId,
      targetMessageId,
      corrected: 'I have an apple',
    })
  }

  async function summary(user: SignedUpUser): Promise<TokenSummary> {
    const response = await app.inject({
      method: 'GET',
      url: '/me/tokens',
      headers: { cookie: user.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    return response.json<TokenSummary>()
  }

  /**
   * Everything this user *earned*. Grants are filtered out because every
   * account now starts with a signup bonus, and no test here is about it —
   * counting it would turn "one award for one message" into "two rows".
   */
  function earnedLedgerOf(userId: string) {
    return handle.db
      .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
      .find({ userId, kind: { $nin: [...TOKEN_GRANT_KINDS] } })
      .sort({ createdAt: 1 })
      .toArray()
  }

  async function checkIn(user: SignedUpUser) {
    const response = await app.inject({
      method: 'POST',
      url: '/me/check-in',
      headers: { cookie: user.cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    return response.json<{ current: number; advanced: boolean; freezeUsed: boolean }>()
  }

  function streakDayRow(userId: string, day: string) {
    return handle.db
      .collection<StreakDay>(COLLECTIONS.streakDays)
      .findOne({ _id: `${userId}:${day}` })
  }

  /**
   * Rewinds the streak to a past day, as if nothing had happened since.
   *
   * Both fields, not just `lastQualifiedDay`. They came apart when check-ins
   * arrived — one is "the streak is credited for this day", the other is "real
   * work happened on this day" — and leaving the second at today would make a
   * rewound user unable to earn today's milestone, which is a fact about this
   * helper rather than about the code under test.
   */
  function setStreak(userId: string, current: number, lastQualifiedDay: string | null) {
    return handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      { _id: userId },
      {
        $set: {
          'streak.current': current,
          'streak.lastQualifiedDay': lastQualifiedDay,
          'streak.lastActionDay': lastQualifiedDay,
        },
      },
    )
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_xp_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_xp_test',
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

    // Absorbs the known @better-auth/mongo-adapter first-write transaction bug
    // on a fresh database — see the Faz 1 note in the plan and auth/warmUp.ts.
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

  describe('the ledger is the idempotency gate', () => {
    it('awards a first message once and reflects it in all four period buckets', async () => {
      const sender = await newUser('xp-first-sender@example.com')
      const recipient = await newUser('xp-first-recipient@example.com')

      await startConversation(sender, recipient.userId, 'merhaba')

      const body = await summary(sender)
      // All-time carries the signup grant as well, because that is where a
      // spendable balance is read from. The three ranked periods carry only
      // what was earned — see `TOKEN_GRANT_KINDS`.
      expect(body.tokens.all).toBe(TOKEN_RULES.signupBonus + TOKEN_RULES.award.message)
      expect(body.tokens.year).toBe(TOKEN_RULES.award.message)
      expect(body.tokens.month).toBe(TOKEN_RULES.award.message)
      expect(body.tokens.week).toBe(TOKEN_RULES.award.message)
      expect(body.today.messages).toBe(1)
      expect(body.today.distinctPartners).toBe(1)
      expect(await earnedLedgerOf(sender.userId)).toHaveLength(1)
    })

    /**
     * The reason grants are kept out of the ranked periods: without this, a
     * brand-new account would sit on the weekly leaderboard with 250 tokens it
     * did nothing for, above everyone who actually talked to someone.
     */
    it('keeps the signup grant out of every ranked period', async () => {
      const user = await newUser('grant-periods@example.com')

      const body = await summary(user)
      expect(body.tokens.all).toBe(TOKEN_RULES.signupBonus)
      expect(body.tokens.year).toBe(0)
      expect(body.tokens.month).toBe(0)
      expect(body.tokens.week).toBe(0)
    })

    it('grants the starting balance exactly once, however the profile was made', async () => {
      const user = await newUser('grant-once@example.com')

      // A replay of the grant — what a retried onboarding, or a restore
      // running after the form, would do.
      const again = await grantSignupBonus(handle.db, user.userId)
      expect(again).toBe(0)
      expect((await summary(user)).tokens.all).toBe(TOKEN_RULES.signupBonus)
    })

    it('never pays the same message twice, however many times it is replayed', async () => {
      const sender = await newUser('xp-replay-sender@example.com')
      const recipient = await newUser('xp-replay-recipient@example.com')
      const conversationId = await startConversation(sender, recipient.userId, 'ilk mesaj')
      const { message } = await reply(recipient.userId, conversationId, 'cevap')

      const before = await summary(recipient)

      // Ten concurrent replays of the exact award the send already made —
      // the REST-and-socket double-delivery case, amplified.
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          awardTokens(handle.db, {
            userId: recipient.userId,
            kind: 'message',
            amount: TOKEN_RULES.award.message,
            refId: message._id.toHexString(),
            at: message.createdAt,
          }),
        ),
      )

      expect(results.every((r) => !r.awarded)).toBe(true)
      const after = await summary(recipient)
      expect(after.tokens.all).toBe(before.tokens.all)
      expect(
        (await earnedLedgerOf(recipient.userId)).filter(
          (row) => row.refId === message._id.toHexString(),
        ),
      ).toHaveLength(1)
    })

    it('lets exactly one of many concurrent first-time awards through', async () => {
      const user = await newUser('xp-race@example.com')

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          awardTokens(handle.db, {
            userId: user.userId,
            kind: 'adjustment',
            amount: 42,
            refId: 'support-ticket-1',
          }),
        ),
      )

      expect(results.filter((r) => r.awarded)).toHaveLength(1)
      expect((await summary(user)).tokens.all).toBe(TOKEN_RULES.signupBonus + 42)
    })

    it('writes nothing at all for a zero award', async () => {
      const user = await newUser('xp-zero@example.com')
      const result = await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: 0,
        refId: 'nothing',
      })
      expect(result.awarded).toBe(false)
      expect(await earnedLedgerOf(user.userId)).toHaveLength(0)
    })
  })

  describe('direct awards', () => {
    it('pays a correction more than a message', async () => {
      const a = await newUser('xp-correction-a@example.com')
      const b = await newUser('xp-correction-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'I have a apple')
      const target = await handle.db
        .collection<{ _id: unknown }>(COLLECTIONS.messages)
        .findOne({ conversationId: { $exists: true } }, { sort: { createdAt: -1 } })

      const before = (await summary(b)).tokens.all
      await correct(b.userId, conversationId, String(target?._id))
      const after = await summary(b)

      // b's correction is also the first time b has spoken, so the
      // conversation becomes mutual in the same send.
      expect(after.tokens.all - before).toBe(
        TOKEN_RULES.award.correction + TOKEN_RULES.award.mutualConversation,
      )
      expect(after.today.corrections).toBe(1)
    })

    it('pays the reciprocity bonus to both sides, exactly once', async () => {
      const a = await newUser('xp-mutual-a@example.com')
      const b = await newUser('xp-mutual-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'selam')

      const aBefore = (await summary(a)).tokens.all
      await reply(b.userId, conversationId, 'selam sana da')

      const aAfter = (await summary(a)).tokens.all
      const bAfter = (await summary(b)).tokens.all
      expect(aAfter - aBefore).toBe(TOKEN_RULES.award.mutualConversation)
      expect(bAfter).toBe(
        TOKEN_RULES.signupBonus + TOKEN_RULES.award.message + TOKEN_RULES.award.mutualConversation,
      )

      // Every further message in the same thread earns the message award only.
      await reply(b.userId, conversationId, 'nasilsin')
      expect((await summary(b)).tokens.all).toBe(bAfter + TOKEN_RULES.award.message)
      expect((await summary(a)).tokens.all).toBe(aAfter)
    })

    it('stops paying message token past the per-partner daily cap', async () => {
      const a = await newUser('xp-cap-a@example.com')
      const b = await newUser('xp-cap-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'first')

      const cap = TOKEN_RULES.caps.messagesPerPartnerPerDay
      for (let i = 1; i < cap; i++) {
        await reply(a.userId, conversationId, `message ${i}`)
      }
      const atCap = (await summary(a)).tokens.all
      expect((await summary(a)).today.messages).toBe(cap)

      await reply(a.userId, conversationId, 'one over the cap')
      const overCap = await summary(a)
      expect(overCap.tokens.all).toBe(atCap)
      // The activity counter still moves — the cap withholds token, it does not
      // pretend the message never happened (the pool cron reads these).
      expect(overCap.today.messages).toBe(cap + 1)
    }, 60_000)
  })

  describe('streaks run on the user local day', () => {
    it('starts at 1 and does not advance twice in one day', async () => {
      const a = await newUser('xp-streak-a@example.com')
      const b = await newUser('xp-streak-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'day one')

      const first = await summary(a)
      expect(first.streak.current).toBe(1)
      expect(first.streak.longest).toBe(1)
      expect(first.streak.qualifiedToday).toBe(true)

      await reply(a.userId, conversationId, 'still day one')
      expect((await summary(a)).streak.current).toBe(1)
    })

    it('advances on a consecutive day and resets after a gap', async () => {
      const a = await newUser('xp-streak-advance-a@example.com')
      const b = await newUser('xp-streak-advance-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'hello')

      const today = utcDayKey(new Date())
      await setStreak(a.userId, 4, shiftDayKey(today, -1))
      await reply(a.userId, conversationId, 'next day')
      expect((await summary(a)).streak.current).toBe(5)

      await setStreak(a.userId, 5, shiftDayKey(today, -3))
      await reply(a.userId, conversationId, 'after a gap')
      const afterGap = await summary(a)
      expect(afterGap.streak.current).toBe(1)
      expect(afterGap.streak.longest).toBe(5) // longest is never walked back
    })

    it('uses the profile timezone, not UTC, to decide what day it is', async () => {
      // UTC+14: it is already tomorrow there for most of the UTC day.
      const zone = 'Pacific/Kiritimati'
      const a = await newUser('xp-streak-tz-a@example.com', { timezone: zone })
      const b = await newUser('xp-streak-tz-b@example.com')
      await startConversation(a, b.userId, 'kia orana')

      const now = new Date()
      const summaryBody = await summary(a)
      expect(summaryBody.streak.lastQualifiedDay).toBe(localDayKey(now, zone))
      // Only meaningful while the two clocks actually disagree, which for
      // UTC+14 is most of the day — assert the relationship, not a fixed date.
      expect(summaryBody.today.day).toBe(utcDayKey(now))
    })

    it('pays a milestone bonus once, on the day the streak reaches it', async () => {
      const a = await newUser('xp-milestone-a@example.com')
      const b = await newUser('xp-milestone-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'day six')

      const before = (await summary(a)).tokens.all
      const milestone = TOKEN_RULES.streakMilestones[7] ?? 0
      const streakDay = localDayKey(new Date(), 'UTC')
      await setStreak(a.userId, 6, shiftDayKey(streakDay, -1))
      await reply(a.userId, conversationId, 'day seven')

      const after = await summary(a)
      expect(after.streak.current).toBe(7)
      expect(after.tokens.all - before).toBe(TOKEN_RULES.award.message + milestone)

      // Replaying the same day cannot pay the bonus again.
      await setStreak(a.userId, 6, shiftDayKey(streakDay, -1))
      await reply(a.userId, conversationId, 'replayed day seven')
      expect((await summary(a)).tokens.all - before).toBe(2 * TOKEN_RULES.award.message + milestone)
    })
  })

  describe('opening the app holds the streak', () => {
    it('starts a streak without paying anything', async () => {
      const user = await newUser('checkin-start@example.com')
      const before = (await summary(user)).tokens.all

      const result = await checkIn(user)
      expect(result.current).toBe(1)
      expect(result.advanced).toBe(true)
      expect((await summary(user)).tokens.all).toBe(before)
      expect(await earnedLedgerOf(user.userId)).toHaveLength(0)
    })

    it('is idempotent within a day', async () => {
      const user = await newUser('checkin-idempotent@example.com')
      expect((await checkIn(user)).advanced).toBe(true)
      const second = await checkIn(user)
      expect(second.advanced).toBe(false)
      expect(second.current).toBe(1)
    })

    it("does not pay a milestone, and the day's first real action does", async () => {
      // The whole point of the relaxation, and its limit: the number on screen
      // keeps going up for showing up, but the token behind it is still earned.
      const a = await newUser('checkin-milestone-a@example.com')
      const b = await newUser('checkin-milestone-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'day six')

      const before = (await summary(a)).tokens.all
      const milestone = TOKEN_RULES.streakMilestones[7] ?? 0
      expect(milestone).toBeGreaterThan(0)
      const today = localDayKey(new Date(), 'UTC')
      await setStreak(a.userId, 6, shiftDayKey(today, -1))

      const held = await checkIn(a)
      expect(held.current).toBe(7)
      expect((await summary(a)).tokens.all).toBe(before)

      await reply(a.userId, conversationId, 'day seven, for real')
      const after = await summary(a)
      expect(after.streak.current).toBe(7)
      expect(after.tokens.all - before).toBe(TOKEN_RULES.award.message + milestone)
    })

    it('pays the milestone only once when the action comes first', async () => {
      const a = await newUser('checkin-after-action-a@example.com')
      const b = await newUser('checkin-after-action-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'day six')

      const before = (await summary(a)).tokens.all
      const milestone = TOKEN_RULES.streakMilestones[7] ?? 0
      const today = localDayKey(new Date(), 'UTC')
      await setStreak(a.userId, 6, shiftDayKey(today, -1))

      await reply(a.userId, conversationId, 'day seven')
      await checkIn(a)
      expect((await summary(a)).tokens.all - before).toBe(TOKEN_RULES.award.message + milestone)
    })

    it('fills the square without shading it, and a later message shades it', async () => {
      // `actions` is a count of work, so a check-in must not increment it —
      // otherwise every quiet day looks as busy as a day of teaching.
      const a = await newUser('checkin-square-a@example.com')
      const b = await newUser('checkin-square-b@example.com')
      const conversationId = await startConversation(a, b.userId, 'hello')
      const today = localDayKey(new Date(), 'UTC')

      // `startConversation` already counted as work today, so start clean.
      await handle.db.collection(COLLECTIONS.streakDays).deleteMany({ userId: a.userId })
      await checkIn(a)

      const opened = await streakDayRow(a.userId, today)
      expect(opened?.source).toBe('checkIn')
      expect(opened?.actions).toBe(0)

      await reply(a.userId, conversationId, 'something real')
      const worked = await streakDayRow(a.userId, today)
      // The source says how the day *began* and does not move; `actions` is
      // what the map reads to tell a quiet day from a busy one.
      expect(worked?.source).toBe('checkIn')
      expect(worked?.actions).toBe(1)
    })

    it('spends a banked freeze to bridge yesterday', async () => {
      // Refusing to spend it here would let a check-in silently reset a streak
      // the user had already paid to protect, with no later action able to
      // undo it — the day would already be claimed.
      const user = await newUser('checkin-freeze@example.com')
      const today = localDayKey(new Date(), 'UTC')
      await setStreak(user.userId, 9, shiftDayKey(today, -2))
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { streakFreezes: 1 } })

      const result = await checkIn(user)
      expect(result.freezeUsed).toBe(true)
      expect(result.current).toBe(10)
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(profile?.streakFreezes).toBe(0)
    })

    it('resets on a gap it cannot bridge', async () => {
      const user = await newUser('checkin-gap@example.com')
      const today = localDayKey(new Date(), 'UTC')
      await setStreak(user.userId, 40, shiftDayKey(today, -5))

      const result = await checkIn(user)
      expect(result.current).toBe(1)
      expect(result.freezeUsed).toBe(false)
    })
  })

  describe('timezone changes are rate limited', () => {
    it('rejects a second change inside the cooldown but allows a no-op write', async () => {
      const user = await newUser('xp-tz-cooldown@example.com', { timezone: 'Europe/Istanbul' })

      const same = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: { timezone: 'Europe/Istanbul' },
      })
      expect(same.statusCode, same.body).toBe(200)

      const changed = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: user.cookie },
        payload: { timezone: 'America/Los_Angeles' },
      })
      expect(changed.statusCode).toBe(429)
      expect(changed.json<{ code: string }>().code).toBe('RATE_LIMITED')
      expect(changed.json<{ retryAt?: string }>().retryAt).toBeTruthy()
    })
  })

  it('bumps stats.lastActiveAt so discovery can see the sender as online', async () => {
    const a = await newUser('xp-lastactive-a@example.com')
    const b = await newUser('xp-lastactive-b@example.com')
    const profiles = handle.db.collection<Profile>(COLLECTIONS.profiles)
    await profiles.updateOne(
      { _id: a.userId },
      { $set: { 'stats.lastActiveAt': new Date('2020-01-01T00:00:00Z') } },
    )

    await startConversation(a, b.userId, 'still here')

    const profile = await profiles.findOne({ _id: a.userId })
    expect(profile?.stats.lastActiveAt.getTime()).toBeGreaterThan(Date.now() - 60_000)
    expect(profile?.stats.messagesSent).toBe(1)
  })

  describe('the activity map and buying back a day', () => {
    /** Enough earned token to afford repairs, without going through sends. */
    async function funded(email: string, tokens: number) {
      const user = await newUser(email)
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'adjustment',
        amount: tokens,
        refId: `fund-${user.userId}`,
      })
      return user
    }

    const dayKey = (offsetDays: number) =>
      new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10)

    /**
     * `n` consecutive repairable days that all fall in one calendar month,
     * newest first.
     *
     * The cap is *per calendar month* — `repairsInMonth` counts against the
     * month the repaired day is in — so a test that simply takes the last
     * three days asserts nothing for the first days of a month, when those
     * three days straddle two months and neither reaches the cap. It passed
     * for twenty-seven days out of thirty and failed on the rest, which is the
     * worst way for a test to be wrong.
     *
     * Walking backwards always finds a run: `dayRepairMaxAgeDays` is 14 and
     * the shortest month is 28, so the fourteen days behind any date always
     * contain a same-month run of at least fourteen at one end or the other.
     */
    function sameMonthDays(n: number): string[] {
      for (let start = 1; start + n - 1 <= TOKEN_RULES.sinks.dayRepairMaxAgeDays; start++) {
        const run = Array.from({ length: n }, (_, i) => dayKey(start + i))
        if (new Set(run.map((day) => day.slice(0, 7))).size === 1) return run
      }
      throw new Error('no same-month run inside the repair window')
    }

    it('records the day a message was sent, and counts the ones after it', async () => {
      const a = await newUser('activity-sender@example.com')
      const b = await newUser('activity-partner@example.com')
      const conversationId = await startConversation(a, b.userId)
      const { sendTextMessage } = await import('../modules/chat/messages')
      await sendTextMessage(handle.db, a.userId, { conversationId, body: 'second' })

      const response = await app.inject({
        method: 'GET',
        url: `/me/activity?from=${dayKey(7)}&to=${dayKey(0)}`,
        headers: { cookie: a.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{ days: { day: string; actions: number }[] }>()
      // Two qualifying actions, one square: the count is what shades it.
      expect(body.days).toHaveLength(1)
      expect(body.days[0]?.actions).toBe(2)
    })

    it('fills a missed day, charges for it, and rejoins the streak across it', async () => {
      const user = await funded('repair-joins@example.com', 1000)
      const days = handle.db.collection<StreakDay>(COLLECTIONS.streakDays)
      // Two runs with one day missing between them.
      for (const offset of [0, 1, 3, 4]) {
        await days.insertOne({
          _id: `${user.userId}:${dayKey(offset)}`,
          userId: user.userId,
          day: dayKey(offset),
          source: 'activity',
          actions: 1,
        })
      }

      const response = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(2) },
      })
      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{
        price: number
        streak: { current: number }
        repairsLeftThisMonth: number
      }>()
      expect(body.price).toBe(TOKEN_RULES.sinks.dayRepair)
      expect(body.streak.current).toBe(5)
      expect(body.repairsLeftThisMonth).toBe(TOKEN_RULES.sinks.dayRepairPerMonth - 1)

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(profile?.tokenSpent).toBe(TOKEN_RULES.sinks.dayRepair)
      expect(profile?.streak.current).toBe(5)
    })

    /**
     * `streakDays` only starts existing when this ships, so every account that
     * predates it has a history of nothing — and a walk over that history
     * would price a long streak at zero. Found by watching the profile card
     * say 1 while the repair confirmation said 2.
     */
    it('never lowers a streak that predates the day records', async () => {
      const user = await funded('repair-legacy@example.com', 1000)
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: user.userId }, { $set: { 'streak.current': 200, 'streak.longest': 200 } })

      const response = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(1) },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json<{ streak: { current: number } }>().streak.current).toBe(200)

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId })
      expect(profile?.streak.current).toBe(200)
    })

    /**
     * The bug that made a repair worthless, and the reason it was invisible:
     * every test here asserted the streak right after the purchase, and none
     * of them sent a message afterwards.
     *
     * `repairDay` recomputed `streak.current` but never moved
     * `streak.lastQualifiedDay`, so the next qualifying action still read the
     * day *before* the gap. `nextStreak` found no adjacency to today and reset
     * the run to 1 — three hundred token for a square and nothing else.
     */
    it('keeps the repaired streak when the next message lands', async () => {
      const user = await funded('repair-then-send@example.com', 1000)
      const partner = await newUser('repair-then-send-partner@example.com')
      const days = handle.db.collection<StreakDay>(COLLECTIONS.streakDays)
      const profiles = handle.db.collection<Profile>(COLLECTIONS.profiles)

      // A run of two ending the day before yesterday, then a gap at yesterday.
      for (const offset of [3, 2]) {
        await days.insertOne({
          _id: `${user.userId}:${dayKey(offset)}`,
          userId: user.userId,
          day: dayKey(offset),
          source: 'activity',
          actions: 1,
        })
      }
      await profiles.updateOne(
        { _id: user.userId },
        {
          $set: {
            'streak.current': 2,
            'streak.longest': 2,
            'streak.lastQualifiedDay': dayKey(2),
          },
        },
      )

      const repair = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(1) },
      })
      expect(repair.statusCode, repair.body).toBe(200)
      expect(repair.json<{ streak: { current: number } }>().streak.current).toBe(3)

      // The whole point: the bought day is now the last one that qualified,
      // so today is adjacent to it.
      const repaired = await profiles.findOne({ _id: user.userId })
      expect(repaired?.streak.lastQualifiedDay).toBe(dayKey(1))

      await startConversation(user, partner.userId)

      const after = await profiles.findOne({ _id: user.userId })
      expect(after?.streak.current).toBe(4)
      expect(after?.streak.lastQualifiedDay).toBe(dayKey(0))
    })

    /**
     * The same stale read cost a second thing. `missedExactlyOne` is
     * `lastQualifiedDay + 2 === today`, which a day-before-the-gap value
     * satisfies exactly — so a user holding a freeze spent it bridging the day
     * they had just paid to repair. Two charges for one gap.
     */
    it('does not spend a banked freeze on a day that was just bought', async () => {
      const user = await funded('repair-then-freeze@example.com', 1000)
      const partner = await newUser('repair-then-freeze-partner@example.com')
      const days = handle.db.collection<StreakDay>(COLLECTIONS.streakDays)
      const profiles = handle.db.collection<Profile>(COLLECTIONS.profiles)

      await days.insertOne({
        _id: `${user.userId}:${dayKey(2)}`,
        userId: user.userId,
        day: dayKey(2),
        source: 'activity',
        actions: 1,
      })
      await profiles.updateOne(
        { _id: user.userId },
        {
          $set: {
            'streak.current': 1,
            'streak.longest': 1,
            'streak.lastQualifiedDay': dayKey(2),
            streakFreezes: 1,
          },
        },
      )

      const repair = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(1) },
      })
      expect(repair.statusCode, repair.body).toBe(200)

      await startConversation(user, partner.userId)

      const after = await profiles.findOne({ _id: user.userId })
      expect(after?.streakFreezes).toBe(1)
      expect(after?.streak.current).toBe(3)
    })

    /** The leaderboard ranks token earned. Spending must not move anyone. */
    it('does not touch the leaderboard aggregates', async () => {
      const user = await funded('repair-rank@example.com', 1000)
      const before = await handle.db
        .collection<{ _id: string; tokens: number }>(COLLECTIONS.tokenAggregates)
        .findOne({ _id: `${user.userId}:all:all` })

      await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(1) },
      })

      const after = await handle.db
        .collection<{ _id: string; tokens: number }>(COLLECTIONS.tokenAggregates)
        .findOne({ _id: `${user.userId}:all:all` })
      expect(after?.tokens).toBe(before?.tokens)
    })

    it('refuses today, a day outside the window, and one already filled', async () => {
      const user = await funded('repair-window@example.com', 5000)

      const today = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(0) },
      })
      expect(today.statusCode).toBe(400)

      const tooOld = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(TOKEN_RULES.sinks.dayRepairMaxAgeDays + 1) },
      })
      expect(tooOld.statusCode).toBe(400)

      await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(1) },
      })
      const again = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(1) },
      })
      expect(again.statusCode).toBe(400)
    })

    /** The cap, not the price, is what stops a balance buying a streak. */
    it('allows only two repairs a month however much token is held', async () => {
      const user = await funded('repair-cap@example.com', 100_000)
      const cap = TOKEN_RULES.sinks.dayRepairPerMonth
      const days = sameMonthDays(cap + 1)

      const codes: number[] = []
      for (const day of days) {
        const response = await app.inject({
          method: 'POST',
          url: '/me/activity/repair',
          headers: { cookie: user.cookie },
          payload: { day },
        })
        codes.push(response.statusCode)
      }
      expect(codes.slice(0, cap)).toEqual(Array.from({ length: cap }, () => 200))
      expect(codes[cap]).toBe(400)
    })

    /**
     * Two writes in two collections, so the order matters: the day goes in
     * first and has to come back out when the charge fails, or the map would
     * show a square nobody paid for.
     */
    it('hands the day back when there is not enough token', async () => {
      const user = await funded('repair-broke@example.com', 10)

      const response = await app.inject({
        method: 'POST',
        url: '/me/activity/repair',
        headers: { cookie: user.cookie },
        payload: { day: dayKey(1) },
      })
      expect(response.statusCode).toBe(400)

      const day = await handle.db
        .collection<StreakDay>(COLLECTIONS.streakDays)
        .findOne({ _id: `${user.userId}:${dayKey(1)}` })
      expect(day).toBeNull()
    })

    it('shows someone else the shape of the map but never the counts', async () => {
      const owner = await newUser('map-owner@example.com', { handle: 'mapowner' })
      const viewer = await newUser('map-viewer@example.com')
      await handle.db.collection<StreakDay>(COLLECTIONS.streakDays).insertOne({
        _id: `${owner.userId}:${dayKey(1)}`,
        userId: owner.userId,
        day: dayKey(1),
        source: 'purchase',
        actions: 42,
      })

      const response = await app.inject({
        method: 'GET',
        url: `/profiles/mapowner/activity?from=${dayKey(7)}&to=${dayKey(0)}`,
        headers: { cookie: viewer.cookie },
      })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.body).not.toContain('42')
      // Nor whether a square was bought.
      expect(response.body).not.toContain('purchase')
      const body = response.json<{ visible: boolean; days: { intensity: number }[] }>()
      expect(body.visible).toBe(true)
      expect(body.days).toHaveLength(1)
    })

    it('hides the map when its owner has turned it off', async () => {
      const owner = await newUser('map-private@example.com', { handle: 'mapprivate' })
      const viewer = await newUser('map-private-viewer@example.com')
      await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: owner.cookie },
        payload: { privacy: { activityMapVisible: false } },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/profiles/mapprivate/activity?from=${dayKey(7)}&to=${dayKey(0)}`,
        headers: { cookie: viewer.cookie },
      })
      expect(response.json<{ visible: boolean; days: unknown[] }>()).toEqual({
        visible: false,
        days: [],
      })
    })
  })

  describe('somebody else’s numbers', () => {
    it('answers with the streak, the corrections and the tokens', async () => {
      const owner = await newUser('stats-owner@example.com', { handle: 'statsowner' })
      const viewer = await newUser('stats-viewer@example.com')

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/statsowner/summary',
        headers: { cookie: viewer.cookie },
      })

      expect(response.statusCode, response.body).toBe(200)
      const body = response.json<{
        visible: boolean
        streak: { current: number }
        corrections: number
        tokens: number
        week: unknown[]
      }>()
      expect(body.visible).toBe(true)
      expect(body.streak.current).toBe(0)
      expect(body.corrections).toBe(0)
      // The sign-up bonus is already on the ledger, so this is a real number
      // rather than a zero that would pass whatever the query did.
      expect(body.tokens).toBeGreaterThan(0)
      expect(body.week).toHaveLength(7)
      void owner
    })

    /**
     * Off means the fields are absent, not blanked: a client that decided to
     * draw them anyway would have nothing to draw.
     */
    it('sends nothing at all when its owner has turned the numbers off', async () => {
      const owner = await newUser('stats-private@example.com', { handle: 'statsprivate' })
      const viewer = await newUser('stats-private-viewer@example.com')
      await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { cookie: owner.cookie },
        payload: { privacy: { statsVisible: false } },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/profiles/statsprivate/summary',
        headers: { cookie: viewer.cookie },
      })
      expect(response.json()).toEqual({ visible: false })
    })
  })
  describe('the token history', () => {
    it('groups a day by kind, files a pool share under the day it rewards, and pages', async () => {
      const user = await newUser('history@example.com')
      const day = '2026-05-10'
      const older = '2026-05-09'
      const at = (d: string) => new Date(`${d}T09:00:00.000Z`)

      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'message',
        amount: 2,
        refId: 'm1',
        at: at(day),
      })
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'message',
        amount: 2,
        refId: 'm2',
        at: at(day),
      })
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'correction',
        amount: 10,
        refId: 'c1',
        at: at(day),
      })
      /*
       * Inserted directly, the way `recordSpend` does it: `awardTokens`
       * returns early on a non-positive amount, so a spend can never be
       * written through it.
       */
      await handle.db.collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger).insertOne({
        _id: new ObjectId(),
        userId: user.userId,
        kind: 'spend',
        amount: -200,
        refId: `streakFreeze:${at(day).toISOString()}`,
        day,
        ...periodKeys(at(day)),
        createdAt: at(day),
      })
      /*
       * The pool award as `runDailyPool` writes it: `refId` is the day it
       * rewards and `at` is that day's close, which is already the *next*
       * morning. The history has to undo that, or every share is dated a day
       * late.
       */
      await awardTokens(handle.db, {
        userId: user.userId,
        kind: 'dailyPool',
        amount: 137,
        refId: older,
        at: new Date(`${day}T00:00:00.000Z`),
      })

      const read = (query = '') =>
        app
          .inject({
            method: 'GET',
            url: `/me/tokens/history${query}`,
            headers: { cookie: user.cookie },
          })
          .then((r) => {
            expect(r.statusCode, r.body).toBe(200)
            return r.json<TokenHistory>()
          })

      const history = await read()
      const dayRow = history.days.find((d) => d.day === day)
      expect(dayRow).toBeDefined()
      expect(dayRow?.earned).toBe(14)
      // Positive, though the ledger stores the row as -200.
      expect(dayRow?.spent).toBe(200)
      expect(dayRow?.breakdown).toEqual(
        expect.arrayContaining([
          { kind: 'message', amount: 4 },
          { kind: 'correction', amount: 10 },
          { kind: 'spend', amount: -200 },
        ]),
      )
      // The share landed on `day` but belongs to `older`.
      expect(dayRow?.breakdown.find((b) => b.kind === 'dailyPool')).toBeUndefined()
      const olderRow = history.days.find((d) => d.day === older)
      expect(olderRow?.breakdown).toEqual([{ kind: 'dailyPool', amount: 137 }])
      expect(olderRow?.earned).toBe(137)

      // Newest first, and the cursor excludes the day it names.
      expect(history.days[0]?.day).toBe(
        [...history.days].sort((a, b) => (a.day < b.day ? 1 : -1))[0]?.day,
      )
      const page = await read(`?before=${day}`)
      expect(page.days.some((d) => d.day === day)).toBe(false)
      expect(page.days.some((d) => d.day === older)).toBe(true)
    })

    it('refuses a cursor that is not a day key', async () => {
      const user = await newUser('history-bad-cursor@example.com')
      const response = await app.inject({
        method: 'GET',
        url: '/me/tokens/history?before=last-tuesday',
        headers: { cookie: user.cookie },
      })
      expect(response.statusCode).toBe(400)
    })
  })
})
