import { TOKEN_GRANT_KINDS, TOKEN_RULES } from '@langx/shared'
import type { ReferralStatus, TokenKind } from '@langx/shared'
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
import type { Referral } from '../modules/referrals/referrals'
import { isPaidPurchase } from '../modules/referrals/settle'
import { readAggregates, type TokenLedgerEntry } from '../modules/tokens/ledger'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const WEBHOOK_SECRET = 'referral-webhook-secret'
const RULES = TOKEN_RULES.referral

describe('referrals', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  function onboardingBody(overrides: Record<string, unknown> = {}) {
    return {
      handle: `ref${(seq += 1).toString().padStart(4, '0')}`,
      displayName: 'Test User',
      birthDate: '1995-06-15',
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      ...overrides,
    }
  }

  /** Signs up, verifies and onboards. `referredByHandle` goes through the
   *  real `POST /profiles`, which is the only way a referral is ever attached. */
  async function newUser(
    overrides: Record<string, unknown> = {},
  ): Promise<SignedUpUser & { handle: string }> {
    const email = `ref-${seq}-${Math.random().toString(36).slice(2, 8)}@example.com`
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const body = onboardingBody(overrides)
    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: body,
    })
    if (created.statusCode !== 201)
      throw new Error(`onboard ${created.statusCode}: ${created.body}`)
    return { ...user, handle: body.handle }
  }

  /** Somebody for invitees to talk to who did not invite any of them. */
  let stranger: SignedUpUser & { handle: string }
  const threads = new Map<string, string>()

  /** Opens a conversation through the module the route calls, so the award path is the real one. */
  async function start(fromId: string, toUserId: string): Promise<string> {
    const { startConversation } = await import('../modules/chat/conversations')
    const { conversation } = await startConversation(handle.db, fromId, { toUserId, body: 'hi' })
    return conversation._id.toHexString()
  }

  /** Replies over the module the socket handler calls — there is no REST reply. */
  async function say(senderId: string, conversationId: string) {
    const { sendTextMessage } = await import('../modules/chat/messages')
    await sendTextMessage(handle.db, senderId, { conversationId, body: 'hello again' })
  }

  /**
   * The invitee does the thing that activates a referral: a conversation that
   * goes both ways, with somebody other than the referrer. The first call
   * opens one with `stranger` and has them answer; later calls are the
   * invitee writing in it again.
   */
  async function earn(userId: string) {
    const existing = threads.get(userId)
    if (existing) return say(userId, existing)
    const conversationId = await start(userId, stranger.userId)
    threads.set(userId, conversationId)
    await say(stranger.userId, conversationId)
  }

  const rowOf = (inviteeId: string) =>
    handle.db.collection<Referral>(COLLECTIONS.referrals).findOne({ _id: inviteeId })

  const ledgerOf = (userId: string, kind: TokenKind) =>
    handle.db.collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger).find({ userId, kind }).toArray()

  function webhook(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/webhooks/revenuecat',
      headers: { authorization: WEBHOOK_SECRET },
      payload: { event: payload },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_referrals_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_referrals_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      REVENUECAT_WEBHOOK_AUTH_HEADER: WEBHOOK_SECRET,
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
      email: emailSender,
    })
    await app.ready()

    for (let attempt = 1; attempt <= 5; attempt++) {
      const warm = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warm-${attempt}@example.com`, password: PASSWORD, name: 'W' },
      })
      if (warm.statusCode === 200) break
      await new Promise((r) => setTimeout(r, 200))
    }
    emailSender.messages.length = 0
    stranger = await newUser()
  }, 180_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  describe('attaching', () => {
    it('records who invited them, and pays nothing yet', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })

      const row = await rowOf(b.userId)
      expect(row).toMatchObject({ _id: b.userId, referrerId: a.userId, referrerHandle: a.handle })
      expect(row?.activatedAt).toBeUndefined()

      // The pointer the message path gates on, without which nothing fires.
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: b.userId })
      expect(profile?.referredBy).toBe(a.userId)

      // Signing up is not an achievement. Only the signup bonus so far.
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
    })

    /**
     * The client says where the code came from; the server cannot infer it.
     * Without this the column is always `manual`, including for the links —
     * and the question it exists to answer (should an unmarked profile link
     * count as an invitation?) has no data behind it.
     */
    it('records whether the code came from a link or was typed', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle, referredBySource: 'link' })
      expect((await rowOf(b.userId))?.source).toBe('link')

      const c = await newUser()
      const d = await newUser({ referredByHandle: c.handle })
      // Absent from an older client, and "typed" is the claim that asserts less.
      expect((await rowOf(d.userId))?.source).toBe('manual')
    })

    it('ignores an unknown code rather than failing the sign-up', async () => {
      const b = await newUser({ referredByHandle: 'nobodyhere' })
      expect(await rowOf(b.userId)).toBeNull()
    })

    /**
     * `.catch(undefined)` on the schema. Somebody who mistyped a friend's
     * username must still be able to finish onboarding — failing the sign-up
     * punishes the wrong person for the wrong mistake.
     */
    it('ignores a malformed code rather than answering 400', async () => {
      const b = await newUser({ referredByHandle: 'not a handle!!' })
      expect(await rowOf(b.userId)).toBeNull()
    })

    it('refuses a self-referral', async () => {
      const a = await newUser()
      const { attachReferral } = await import('../modules/referrals/referrals')
      expect(await attachReferral(handle.db, a.userId, a.handle, 'manual')).toBeNull()
      expect(await rowOf(a.userId)).toBeNull()
    })

    it('refuses a deleted referrer', async () => {
      const a = await newUser()
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: a.userId }, { $set: { deletedAt: new Date() } })
      const b = await newUser({ referredByHandle: a.handle })
      expect(await rowOf(b.userId)).toBeNull()
    })

    /** First writer wins: the referrer whose link caused the sign-up. */
    it('never lets a second referrer overwrite the first', async () => {
      const a = await newUser()
      const c = await newUser()
      const b = await newUser({ referredByHandle: a.handle })

      const { attachReferral } = await import('../modules/referrals/referrals')
      expect(await attachReferral(handle.db, b.userId, c.handle, 'manual')).toBeNull()
      expect((await rowOf(b.userId))?.referrerId).toBe(a.userId)
    })
  })

  describe('activation', () => {
    it('pays once when the invitee first earns, and never again', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })

      await earn(b.userId)
      expect((await readAggregates(handle.db, a.userId)).all).toBe(
        TOKEN_RULES.signupBonus + RULES.activation,
      )
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(1)
      expect(await rowOf(b.userId)).toMatchObject({
        activationAward: RULES.activation,
        inviteeAward: RULES.inviteeActivation,
      })

      for (let i = 0; i < 5; i++) await earn(b.userId)
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(1)
      expect(await ledgerOf(b.userId, 'referralWelcome')).toHaveLength(1)
    })

    /** The invitee's welcome lands with the referrer's award, once, all-time only. */
    it('welcomes the invitee at the same moment, once', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })
      const before = await readAggregates(handle.db, b.userId)

      await earn(b.userId)
      const rows = await ledgerOf(b.userId, 'referralWelcome')
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ amount: RULES.inviteeActivation, refId: b.userId })
      const after = await readAggregates(handle.db, b.userId)
      expect(after.all - before.all).toBeGreaterThanOrEqual(RULES.inviteeActivation)
      expect(after.week - before.week).toBeLessThan(RULES.inviteeActivation)

      await earn(b.userId)
      expect(await ledgerOf(b.userId, 'referralWelcome')).toHaveLength(1)
    })

    /**
     * Talking only with the person who sent the invite is not activation,
     * however much of it there is: the rule asks for somebody else.
     */
    it('does not activate on a conversation with the referrer alone', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })

      const conversationId = await start(b.userId, a.userId)
      await say(a.userId, conversationId)
      await say(b.userId, conversationId)

      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
      expect(await ledgerOf(b.userId, 'referralWelcome')).toHaveLength(0)
      expect((await rowOf(b.userId))?.activatedAt).toBeUndefined()
    })

    /**
     * A first message nobody has answered is not a conversation yet. The
     * answer is what activates, and it does so on the *partner's* send — the
     * invitee does not have to write again for it to land.
     */
    it('activates when somebody other than the referrer answers', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })

      const conversationId = await start(b.userId, stranger.userId)
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)

      await say(stranger.userId, conversationId)
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(1)
      expect(await rowOf(b.userId)).toMatchObject({
        activationAward: RULES.activation,
        inviteeAward: RULES.inviteeActivation,
      })
      expect((await rowOf(b.userId))?.unpaidReason).toBeUndefined()
    })

    describe('the monthly limit', () => {
      /** Activations already on the record for this referrer, as rows. */
      async function priorActivations(referrerId: string, count: number, at: Date) {
        await handle.db.collection<Referral>(COLLECTIONS.referrals).insertMany(
          Array.from({ length: count }, (_, i) => ({
            _id: `prior-${referrerId}-${at.getTime()}-${i}`,
            referrerId,
            referrerHandle: 'prior',
            source: 'link' as const,
            createdAt: at,
            activatedAt: at,
            activationAward: RULES.activation,
          })),
        )
      }

      it('pays the referrer nothing past it, and still welcomes the invitee', async () => {
        const a = await newUser()
        await priorActivations(a.userId, RULES.maxActivationsPerMonth, new Date())
        const b = await newUser({ referredByHandle: a.handle })

        await earn(b.userId)
        expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
        expect(await ledgerOf(b.userId, 'referralWelcome')).toHaveLength(1)
        expect(await rowOf(b.userId)).toMatchObject({
          activationAward: 0,
          inviteeAward: RULES.inviteeActivation,
          unpaidReason: 'monthlyLimit',
        })
      })

      it('counts only the current calendar month', async () => {
        const a = await newUser()
        const now = new Date()
        const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15))
        await priorActivations(a.userId, RULES.maxActivationsPerMonth, lastMonth)
        const b = await newUser({ referredByHandle: a.handle })

        await earn(b.userId)
        expect(await ledgerOf(a.userId, 'referral')).toHaveLength(1)
        expect((await rowOf(b.userId))?.unpaidReason).toBeUndefined()
      })
    })

    describe('a shared network or installation', () => {
      it('pays neither side when both accounts signed in from one address', async () => {
        const a = await newUser()
        const b = await newUser({ referredByHandle: a.handle })
        const { authId } = await import('../lib/authId')
        await handle.db
          .collection(COLLECTIONS.session)
          .updateMany(
            { userId: { $in: [authId(a.userId), authId(b.userId)] } },
            { $set: { ipAddress: '203.0.113.7' } },
          )

        await earn(b.userId)
        expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
        expect(await ledgerOf(b.userId, 'referralWelcome')).toHaveLength(0)
        expect(await rowOf(b.userId)).toMatchObject({
          activationAward: 0,
          inviteeAward: 0,
          unpaidReason: 'sharedNetwork',
        })
      })

      it('pays neither side, top-up included, when both registered one installation', async () => {
        const a = await newUser()
        const b = await newUser({ referredByHandle: a.handle })
        const now = new Date()
        await handle.db.collection(COLLECTIONS.devices).insertMany(
          [a, b].map((user) => ({
            userId: user.userId,
            pushToken: `ExponentPushToken[${user.userId}]`,
            platform: 'ios',
            deviceId: `install-${a.userId}`,
            createdAt: now,
            updatedAt: now,
          })),
        )

        await earn(b.userId)
        await webhook({
          id: `evt-shared-${b.userId}`,
          type: 'INITIAL_PURCHASE',
          app_user_id: b.userId,
          store: 'APP_STORE',
          period_type: 'NORMAL',
        })
        expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
        expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(0)
        expect(await ledgerOf(b.userId, 'referralWelcome')).toHaveLength(0)
        expect(await rowOf(b.userId)).toMatchObject({
          activationAward: 0,
          inviteeAward: 0,
          subscriptionAward: 0,
          unpaidReason: 'sharedDevice',
        })
      })
    })

    /**
     * Invisible without an explicit assertion, and it is the leaderboard
     * invariant: inviting is not practising, so the weekly table must not move.
     */
    it('credits all-time only, never the week or the month', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })
      const before = await readAggregates(handle.db, a.userId)
      await earn(b.userId)
      const after = await readAggregates(handle.db, a.userId)

      expect(after.all - before.all).toBe(RULES.activation)
      expect(after.week).toBe(before.week)
      expect(after.month).toBe(before.month)
      expect(after.year).toBe(before.year)
      expect(TOKEN_GRANT_KINDS as readonly string[]).toContain('referral')
    })

    /**
     * `settleReferral` awards first and latches second, so that a crash between
     * the two under-records the audit row rather than marking a referral paid
     * that never was. The doc comment promises the next call heals it. It is
     * the ordinary case rather than an exotic one: settling runs on every
     * message, so two of the invitee's messages landing together have both read
     * `activatedAt` as absent before either has written it.
     */
    it('restores the recorded award when a settle re-runs over an already-paid one', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })

      await earn(b.userId)
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(1)

      // The crash: the awards are on the ledger, the latch never landed.
      await handle.db
        .collection<Referral>(COLLECTIONS.referrals)
        .updateOne(
          { _id: b.userId },
          { $unset: { activatedAt: '', activationAward: '', inviteeAward: '' } },
        )

      await earn(b.userId)

      // Still paid exactly once...
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(1)
      expect(await ledgerOf(b.userId, 'referralWelcome')).toHaveLength(1)
      // ...and the row says so, rather than reporting a payment of nothing.
      expect(await rowOf(b.userId)).toMatchObject({
        activationAward: RULES.activation,
        inviteeAward: RULES.inviteeActivation,
      })
    })

    it('pays a frozen referrer nothing, and records that it withheld it', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: a.userId }, { $set: { tokenFrozenAt: new Date() } })

      await earn(b.userId)
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
      expect(await rowOf(b.userId)).toMatchObject({ activationAward: 0 })

      // The latch is written, so unfreezing does not retroactively pay. An
      // `adjustment` row is the instrument for that, deliberately.
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: a.userId }, { $unset: { tokenFrozenAt: '' } })
      await earn(b.userId)
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
    })

    it('pays nothing for an invitee who has not verified an email', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })
      const { authId } = await import('../lib/authId')
      await handle.db
        .collection(COLLECTIONS.user)
        .updateOne({ _id: authId(b.userId) }, { $set: { emailVerified: false } })

      await earn(b.userId)
      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
      expect((await rowOf(b.userId))?.activatedAt).toBeUndefined()
    })
  })

  describe('the subscription top-up', () => {
    async function pair() {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })
      return { a, b }
    }

    /** What a paid purchase looks like: a real store, past any free week. */
    const PAID = { store: 'APP_STORE', period_type: 'NORMAL' } as const

    it('pays on a paid initial purchase, once the invitee is activated', async () => {
      const { a, b } = await pair()
      await earn(b.userId)

      const response = await webhook({
        id: `evt-${b.userId}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: b.userId,
        ...PAID,
        expiration_at_ms: Date.now() + 1_000_000,
      })
      expect(response.statusCode, response.body).toBe(200)

      expect((await readAggregates(handle.db, a.userId)).all).toBe(
        TOKEN_RULES.signupBonus + RULES.maxPerInvitee,
      )
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(1)
    })

    /**
     * A trial starts with `INITIAL_PURCHASE` too, and used to pay in full —
     * four thousand tokens for a free week cancelled on day six. It pays when
     * the week turns into a charged month, which arrives as a `RENEWAL`.
     */
    it('pays nothing for a free week, and pays when it turns into a paid month', async () => {
      const { a, b } = await pair()
      await earn(b.userId)
      await webhook({
        id: `evt-trial-${b.userId}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: b.userId,
        store: 'APP_STORE',
        period_type: 'TRIAL',
        expiration_at_ms: Date.now() + 1_000_000,
      })
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(0)
      expect((await rowOf(b.userId))?.subscribedAt).toBeUndefined()

      await webhook({
        id: `evt-converted-${b.userId}`,
        type: 'RENEWAL',
        app_user_id: b.userId,
        ...PAID,
        expiration_at_ms: Date.now() + 2_000_000,
      })
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(1)
    })

    it('pays nothing for a grant nobody paid for', async () => {
      const { a, b } = await pair()
      await earn(b.userId)
      await webhook({
        id: `evt-promo-${b.userId}`,
        type: 'NON_RENEWING_PURCHASE',
        app_user_id: b.userId,
        store: 'PROMOTIONAL',
        period_type: 'NORMAL',
      })
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(0)
    })

    /** Nothing said which period it was in; absence is not "paying". */
    it('pays nothing when the event does not say it is paid', async () => {
      const { a, b } = await pair()
      await earn(b.userId)
      await webhook({ id: `evt-bare-${b.userId}`, type: 'INITIAL_PURCHASE', app_user_id: b.userId })
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(0)
    })

    it('pays once across renewals', async () => {
      const { a, b } = await pair()
      await earn(b.userId)
      await webhook({
        id: `evt-init-${b.userId}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: b.userId,
        ...PAID,
      })
      const afterInitial = (await readAggregates(handle.db, a.userId)).all

      await webhook({
        id: `evt-renew-${b.userId}`,
        type: 'RENEWAL',
        app_user_id: b.userId,
        ...PAID,
      })
      expect((await readAggregates(handle.db, a.userId)).all).toBe(afterInitial)
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(1)
    })

    /** Two different guards, so both are asserted. */
    it('pays nothing for a redelivered event, or a second event of the same type', async () => {
      const { a, b } = await pair()
      await earn(b.userId)
      await webhook({
        id: `evt-dup-${b.userId}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: b.userId,
        ...PAID,
      })
      const once = (await readAggregates(handle.db, a.userId)).all

      // Same event id: refused by `subscriptions.event_id_unique`.
      const replay = await webhook({
        id: `evt-dup-${b.userId}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: b.userId,
        ...PAID,
      })
      expect(replay.json()).toMatchObject({ processed: false })

      // Distinct event id: refused by the ledger's refId.
      await webhook({
        id: `evt-dup2-${b.userId}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: b.userId,
        ...PAID,
      })
      expect((await readAggregates(handle.db, a.userId)).all).toBe(once)
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(1)
    })

    /**
     * The ordering the whole design hinges on. Money must not be able to buy
     * the award on its own — a stolen card on a throwaway account would
     * otherwise be worth the top-up for no human effort.
     */
    it('pays nothing when the invitee subscribes before earning, then pays both at once', async () => {
      const { a, b } = await pair()
      await webhook({
        id: `evt-early-${b.userId}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: b.userId,
        ...PAID,
      })

      expect(await ledgerOf(a.userId, 'referral')).toHaveLength(0)
      expect(await ledgerOf(a.userId, 'referralSubscription')).toHaveLength(0)
      expect((await rowOf(b.userId))?.subscribedAt).toBeInstanceOf(Date)

      await earn(b.userId)
      expect((await readAggregates(handle.db, a.userId)).all).toBe(
        TOKEN_RULES.signupBonus + RULES.maxPerInvitee,
      )
    })
  })

  describe('isPaidPurchase', () => {
    const future = new Date(Date.now() + 1_000_000)

    it('is a paid tier in a real store, past its free week', () => {
      expect(isPaidPurchase({ tier: 'pro', store: 'play_store', periodType: 'normal' })).toBe(true)
      expect(isPaidPurchase({ tier: 'pro_plus', store: 'APP_STORE', periodType: 'normal' })).toBe(
        true,
      )
    })

    it('is not a trial, a grant, an unknown period or free', () => {
      expect(isPaidPurchase({ tier: 'pro', store: 'app_store', periodType: 'trial' })).toBe(false)
      expect(isPaidPurchase({ tier: 'pro', store: 'promotional', periodType: 'normal' })).toBe(
        false,
      )
      expect(isPaidPurchase({ tier: 'pro', store: 'gift', expiresAt: future })).toBe(false)
      expect(isPaidPurchase({ tier: 'pro', store: 'app_store' })).toBe(false)
      expect(isPaidPurchase({ tier: 'free', store: 'app_store', periodType: 'normal' })).toBe(false)
      expect(isPaidPurchase(null)).toBe(false)
    })

    it('is not a subscription that has run out', () => {
      const past = new Date(Date.now() - 1_000)
      expect(
        isPaidPurchase({ tier: 'pro', store: 'app_store', periodType: 'normal', expiresAt: past }),
      ).toBe(false)
    })
  })

  describe('GET /me/referrals', () => {
    it('refuses an unauthenticated reader', async () => {
      expect((await app.inject({ method: 'GET', url: '/me/referrals' })).statusCode).toBe(401)
    })

    it('shows the referrer their invitees, and the invitee who invited them', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })
      await earn(b.userId)

      const mine = await app.inject({
        method: 'GET',
        url: '/me/referrals',
        headers: { cookie: a.cookie },
      })
      const status = mine.json<ReferralStatus>()
      expect(status.totals).toMatchObject({ invited: 1, activated: 1, subscribed: 0 })
      expect(status.totals.tokensEarned).toBe(RULES.activation)
      expect(status.invitees[0]).toMatchObject({ handle: b.handle, status: 'activated' })
      expect(status.referredBy).toBeNull()

      const theirs = await app.inject({
        method: 'GET',
        url: '/me/referrals',
        headers: { cookie: b.cookie },
      })
      expect(theirs.json<ReferralStatus>().referredBy).toMatchObject({ handle: a.handle })
      expect(theirs.json<ReferralStatus>().invitees).toHaveLength(0)
    })

    it('answers zeroes for somebody who has invited nobody', async () => {
      const c = await newUser()
      const status = (
        await app.inject({ method: 'GET', url: '/me/referrals', headers: { cookie: c.cookie } })
      ).json<ReferralStatus>()
      expect(status.totals).toEqual({ invited: 0, activated: 0, subscribed: 0, tokensEarned: 0 })
      expect(status.referredBy).toBeNull()
    })

    /** An invitee agreed to join, not to be reported on. */
    it('leaks no email and no ledger detail', async () => {
      const a = await newUser()
      const b = await newUser({ referredByHandle: a.handle })
      await earn(b.userId)
      const body = (
        await app.inject({ method: 'GET', url: '/me/referrals', headers: { cookie: a.cookie } })
      ).body
      expect(body).not.toContain('@example.com')
      expect(body).not.toContain('tokenLedger')
    })
  })
})
