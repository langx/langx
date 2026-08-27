import { TOKEN_RULES, localDayKey, shiftDayKey, utcDayKey, type TokenSummary } from '@langx/shared'
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
import { awardTokens, type TokenLedgerEntry } from '../modules/tokens/ledger'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthYear: 1995,
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'B1', priority: 1 }],
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

  function ledgerOf(userId: string) {
    return handle.db
      .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray()
  }

  function setStreak(userId: string, current: number, lastQualifiedDay: string | null) {
    return handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne(
        { _id: userId },
        { $set: { 'streak.current': current, 'streak.lastQualifiedDay': lastQualifiedDay } },
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
      expect(body.tokens.all).toBe(TOKEN_RULES.award.message)
      expect(body.tokens.year).toBe(TOKEN_RULES.award.message)
      expect(body.tokens.month).toBe(TOKEN_RULES.award.message)
      expect(body.tokens.week).toBe(TOKEN_RULES.award.message)
      expect(body.today.messages).toBe(1)
      expect(body.today.distinctPartners).toBe(1)
      expect(await ledgerOf(sender.userId)).toHaveLength(1)
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
        (await ledgerOf(recipient.userId)).filter((row) => row.refId === message._id.toHexString()),
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
      expect((await summary(user)).tokens.all).toBe(42)
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
      expect(await ledgerOf(user.userId)).toHaveLength(0)
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
      expect(bAfter).toBe(TOKEN_RULES.award.message + TOKEN_RULES.award.mutualConversation)

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
})
