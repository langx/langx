import type { Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { ensureOfficialAccounts } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import { LoggingPushSender, type PushSender } from '../push/devices'
import { notifyLifetimeGift } from './lifetimeGiftNotice'

/**
 * The numbers `@gerard` actually holds on production, which is the case worth
 * pinning: the v1 total, what a hundredth of it converted to, and a balance
 * that has already moved past the conversion because the welcome-back and
 * sign-up bonuses landed beside it. Read the balance off `tokensCredited` and
 * all three tests below still pass while the letter tells somebody their
 * wallet holds five hundred tokens less than it does.
 */
const V1_BALANCE = 11_579
const CARRIED = 115
const WALLET = 615

describe('telling somebody the v1 lifetime gift landed', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db
  let email: CapturingEmailSender
  let push: LoggingPushSender
  const warnings: string[] = []
  const warn = (_error: unknown, message: string) => warnings.push(message)

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_lifetime_gift_test')
    db = handle.db
    await ensureIndexes(db)
    await ensureOfficialAccounts(db, 'http://localhost:4000')
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.devices,
      COLLECTIONS.legacyProfiles,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.messages,
      COLLECTIONS.conversations,
    ]) {
      await db.collection(name).deleteMany({})
    }
    // The official accounts live in `profiles` too, so they go with it.
    await ensureOfficialAccounts(db, 'http://localhost:4000')
    warnings.length = 0
    email = new CapturingEmailSender()
    push = new LoggingPushSender()
  })

  async function returner(
    opts: { verified?: boolean; legacy?: boolean; locale?: string } = {},
  ): Promise<string> {
    const userId = '6a99d375c220ad84a6bbdfbb'
    await db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: 'gerard',
      displayName: 'Gerard',
      nativeLanguages: [{ code: opts.locale ?? 'en' }],
      learning: [{ code: 'pt', level: 'beginner', priority: 1 }],
      settings: { discoverable: true },
      restoredFromV1: {
        at: new Date(),
        tokensCredited: CARRIED,
        frozenStreak: 5,
        conversationsImported: 0,
        lifetimeGranted: 'pro',
      },
    } as unknown as Profile)
    await db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: 'gerard@example.com',
      emailVerified: opts.verified ?? true,
    })
    await db.collection(COLLECTIONS.devices).insertOne({
      userId,
      pushToken: 'ExponentPushToken[gerard]',
      platform: 'android',
      locale: opts.locale ?? 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    if (opts.legacy !== false) {
      await db.collection(COLLECTIONS.legacyProfiles).insertOne({
        _id: '698762c0001985bfebbf',
        legacyTokenBalance: V1_BALANCE,
        restoredBy: userId,
      } as never)
    }
    await db.collection(COLLECTIONS.tokenAggregates).insertOne({
      _id: `${userId}:all:all`,
      userId,
      periodType: 'all',
      periodKey: 'all',
      tokens: WALLET,
      updatedAt: new Date(),
    } as never)
    return userId
  }

  const senders = () => ({ email, push })

  it('writes the message, knocks on the phone and posts the letter', async () => {
    const userId = await returner()
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)

    const message = await db.collection(COLLECTIONS.messages).findOne({
      clientId: `lifetime:${userId}`,
    })
    expect(message).not.toBeNull()
    expect(email.messages).toHaveLength(1)
    expect(push.sent).toHaveLength(1)
    expect(warnings).toEqual([])

    // The push is the knock, not the news: it opens the thread the news is in.
    expect(push.sent[0]?.data.kind).toBe('message')
    expect(push.sent[0]?.data.conversationId).toBe(String(message?.conversationId))
  })

  /**
   * All three numbers, in all three places, and each one from its own source —
   * the staged v1 record, the restore, and the wallet.
   */
  it('quotes the v1 total, what carried over and the balance now', async () => {
    const userId = await returner()
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)

    const body = String((await db.collection(COLLECTIONS.messages).findOne({}))?.body)
    for (const text of [body, String(email.messages[0]?.html), String(email.messages[0]?.text)]) {
      expect(text).toContain('11,579')
      expect(text).toContain('115')
      expect(text).toContain('615')
      expect(text).toContain('Fluent')
    }
    expect(push.sent[0]?.body).toContain('11,579')
    expect(email.messages[0]?.subject).toContain('Fluent')
  })

  it('says it once, however many times it is asked', async () => {
    const userId = await returner()
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)

    expect(await db.collection(COLLECTIONS.messages).countDocuments({})).toBe(1)
    expect(email.messages).toHaveLength(1)
    expect(push.sent).toHaveLength(1)
  })

  /** No switch behind it, so no unsubscribe link and no List-Unsubscribe header. */
  it('offers no way to turn it off, because there is none', async () => {
    const userId = await returner()
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)

    expect(email.messages[0]?.headers).toBeUndefined()
    expect(email.messages[0]?.html).not.toContain('unsubscribe')
    expect(email.messages[0]?.text).not.toContain('unsubscribe')
  })

  it('never writes to an address nobody proved, and still tells the phone', async () => {
    const userId = await returner({ verified: false })
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)

    expect(email.messages).toHaveLength(0)
    expect(push.sent).toHaveLength(1)
    expect(await db.collection(COLLECTIONS.messages).countDocuments({})).toBe(1)
  })

  /**
   * Every sentence in this letter is about a number. With no v1 record there
   * are no numbers, and congratulating somebody on nothing is worse than
   * saying nothing at all.
   */
  it('says nothing when the v1 record behind the gift is gone', async () => {
    const userId = await returner({ legacy: false })
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)

    expect(email.messages).toHaveLength(0)
    expect(push.sent).toHaveLength(0)
    expect(await db.collection(COLLECTIONS.messages).countDocuments({})).toBe(0)
    expect(warnings).toEqual(['lifetime gift numbers missing'])
  })

  it('still posts the letter when the push relay is having a bad minute', async () => {
    const userId = await returner()
    const brokenPush: PushSender = { send: () => Promise.reject(new Error('expo is down')) }

    await notifyLifetimeGift(db, { email, push: brokenPush }, { userId, tier: 'pro' }, warn)

    expect(warnings).toEqual(['lifetime gift push failed'])
    expect(email.messages).toHaveLength(1)
  })

  it('writes the letter in the reader’s language', async () => {
    const userId = await returner({ locale: 'tr' })
    await notifyLifetimeGift(db, senders(), { userId, tier: 'pro' }, warn)

    expect(email.messages[0]?.subject).toBe('Fluent, ömür boyu')
    expect(String((await db.collection(COLLECTIONS.messages).findOne({}))?.body)).toContain(
      'Tebrikler',
    )
  })
})
