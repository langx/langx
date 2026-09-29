import { GIFT_CODE_RULES } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { translator } from '../../i18n'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import type { Message } from '../chat/conversations'
import { ensureOfficialAccounts } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import { createFakeRevenueCat } from './fakeRevenueCat'
import {
  createGiftCode,
  listGiftCodeRedemptions,
  redeemGiftCode,
  setGiftCodeActive,
  type GiftCode,
} from './giftCodes'
import { grantProGiftNow, type ProGift, type ProGiftDeps } from './proGifts'

const HOUR = 60 * 60 * 1000

/**
 * Gift codes against a real database: the door into `proGifts`, and the
 * three things it has to hold under pressure — once per person, never past
 * the cap, and slow to guess.
 */
describe('gift codes', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db
  let operator: string

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_gift_codes_test')
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
      COLLECTIONS.proGifts,
      COLLECTIONS.giftCodes,
      COLLECTIONS.giftCodeRedemptions,
      COLLECTIONS.giftCodeAttempts,
      COLLECTIONS.messages,
      COLLECTIONS.conversations,
    ]) {
      await db.collection(name).deleteMany({})
    }
    await ensureOfficialAccounts(db, 'http://localhost:4000')
    operator = await person()
  })

  async function person(
    opts: { entitlement?: Partial<Profile['entitlement']>; official?: boolean } = {},
  ): Promise<string> {
    const _id = new ObjectId()
    const userId = _id.toHexString()
    const now = new Date()
    await db
      .collection(COLLECTIONS.user)
      .insertOne({ _id, email: `${userId}@example.com`, emailVerified: true })
    await db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `u${userId.slice(-8)}`,
      displayName: 'Sofia',
      birthDate: '1995-06-15',
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      interests: [],
      settings: { discoverable: true, notifications: true },
      privacy: { incognito: false },
      entitlement: { tier: 'free', updatedAt: now, ...opts.entitlement },
      quota: { initiations: [], translations: [], media: [] },
      streak: { current: 0, longest: 0, lastQualifiedDay: null },
      stats: { lastActiveAt: now, messagesSent: 0 },
      ...(opts.official ? { official: true as const } : {}),
      createdAt: now,
      updatedAt: now,
    })
    return userId
  }

  async function code(
    input: Partial<{
      code: string
      months: number
      maxRedemptions: number | null
      expiresAt: string | null
    }> = {},
  ): Promise<GiftCode> {
    const created = await createGiftCode(db, { code: 'UBER', months: 2, ...input }, operator)
    if (!created) throw new Error('code already exists')
    return created
  }

  const stored = (id: string) => db.collection<GiftCode>(COLLECTIONS.giftCodes).findOne({ _id: id })

  it('redeems a code into a pending gift of its months, whatever case it was typed in', async () => {
    const uber = await code({ months: 3 })
    const userId = await person()

    const outcome = await redeemGiftCode(db, { userId, code: '  uBeR ' })
    expect(outcome.kind).toBe('redeemed')
    if (outcome.kind !== 'redeemed') return
    expect(outcome.gift).toMatchObject({
      _id: `code:${uber._id}:${userId}`,
      userId,
      months: 3,
      source: 'code',
      code: 'UBER',
      status: 'pending',
    })
    expect((await stored(uber._id))?.redemptions).toBe(1)

    const who = await listGiftCodeRedemptions(db, uber._id)
    expect(who).toMatchObject([{ userId, displayName: 'Sofia', giftStatus: 'pending' }])
  })

  it('grants it like any gift, and the letter names the code', async () => {
    await code({ months: 1 })
    const userId = await person()
    const fanned: unknown[] = []
    const deps: ProGiftDeps = {
      revenueCat: createFakeRevenueCat(),
      email: new CapturingEmailSender(),
      fanOut: (delivery) => {
        fanned.push(delivery)
        return Promise.resolve()
      },
      warn: () => undefined,
    }

    const outcome = await redeemGiftCode(db, { userId, code: 'uber' })
    if (outcome.kind !== 'redeemed') throw new Error(`not redeemed: ${outcome.kind}`)
    const granted = await grantProGiftNow(db, deps, outcome.gift._id)
    expect(granted?.status).toBe('granted')

    const profile = await db
      .collection<Profile & { proWelcome?: { source: string; months: number } }>(
        COLLECTIONS.profiles,
      )
      .findOne({ _id: userId })
    expect(profile?.entitlement).toMatchObject({ tier: 'pro', store: 'gift' })
    expect(profile?.proWelcome).toMatchObject({ source: 'gift', months: 1 })

    const letter = await db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ clientId: `proGift:${outcome.gift._id}` })
    // In the reader's language — Sofia's is Turkish.
    expect(letter?.body).toContain(
      translator('tr')('proGift.introCode', { count: 1, code: 'UBER' }),
    )
    expect(translator('en')('proGift.introCode', { count: 1, code: 'UBER' })).toBe(
      '🎟️ Code UBER worked: 1 month of LangX Pro is yours.',
    )
    expect(fanned).toHaveLength(1)
  })

  it('is once per person, including two taps at the same moment', async () => {
    const uber = await code()
    const userId = await person()

    const [first, second] = await Promise.all([
      redeemGiftCode(db, { userId, code: 'UBER' }),
      redeemGiftCode(db, { userId, code: 'UBER' }),
    ])
    const kinds = [first, second].map((outcome) =>
      outcome.kind === 'rejected' ? outcome.reason : outcome.kind,
    )
    expect(kinds.sort()).toEqual(['redeemed', 'used'])

    const again = await redeemGiftCode(db, { userId, code: 'uber' })
    expect(again).toEqual({ kind: 'rejected', reason: 'used' })
    expect((await stored(uber._id))?.redemptions).toBe(1)
    expect(await db.collection(COLLECTIONS.proGifts).countDocuments({ userId })).toBe(1)
  })

  it('never goes past its cap, however many arrive for the last one', async () => {
    const uber = await code({ maxRedemptions: 3 })
    const people = await Promise.all(Array.from({ length: 12 }, () => person()))

    const outcomes = await Promise.all(
      people.map((userId) => redeemGiftCode(db, { userId, code: 'UBER' })),
    )
    const redeemed = outcomes.filter((outcome) => outcome.kind === 'redeemed')
    expect(redeemed).toHaveLength(3)
    expect(
      outcomes
        .filter((outcome) => outcome.kind === 'rejected')
        .every((outcome) => outcome.kind === 'rejected' && outcome.reason === 'exhausted'),
    ).toBe(true)
    expect((await stored(uber._id))?.redemptions).toBe(3)
    // A refused claim takes its own redemption row back with it.
    expect(
      await db.collection(COLLECTIONS.giftCodeRedemptions).countDocuments({ codeId: uber._id }),
    ).toBe(3)
    expect(
      await db.collection<ProGift>(COLLECTIONS.proGifts).countDocuments({ source: 'code' }),
    ).toBe(3)
  })

  it('says which of unknown, switched off or past its day a code is', async () => {
    const userId = await person()
    const off = await code({ code: 'PAUSED' })
    await setGiftCodeActive(db, off._id, false)
    await code({ code: 'OLD', expiresAt: new Date(Date.now() - HOUR).toISOString() })

    expect(await redeemGiftCode(db, { userId, code: 'NOPE' })).toEqual({
      kind: 'rejected',
      reason: 'unknown',
    })
    // Not the shape of a code at all: a wrong guess like any other.
    expect(await redeemGiftCode(db, { userId, code: '!!' })).toEqual({
      kind: 'rejected',
      reason: 'unknown',
    })
    expect(await redeemGiftCode(db, { userId, code: 'paused' })).toEqual({
      kind: 'rejected',
      reason: 'inactive',
    })
    expect(await redeemGiftCode(db, { userId, code: 'old' })).toEqual({
      kind: 'rejected',
      reason: 'expired',
    })

    // Switched back on, it works again.
    await setGiftCodeActive(db, off._id, true)
    expect((await redeemGiftCode(db, { userId, code: 'paused' })).kind).toBe('redeemed')
  })

  it('refuses somebody with Pro for life, and an official account', async () => {
    await code()
    const lifetime = await person({ entitlement: { tier: 'pro', store: 'promotional' } })
    const official = await person({ official: true })

    expect(await redeemGiftCode(db, { userId: lifetime, code: 'UBER' })).toEqual({
      kind: 'rejected',
      reason: 'lifetime',
    })
    expect(await redeemGiftCode(db, { userId: official, code: 'UBER' })).toEqual({
      kind: 'rejected',
      reason: 'official',
    })
    expect(await db.collection(COLLECTIONS.proGifts).countDocuments({})).toBe(0)
  })

  it('lets nobody try more than the hour allows, right or wrong', async () => {
    const userId = await person()
    await code()
    const start = new Date()

    for (let i = 0; i < GIFT_CODE_RULES.attemptsPerHour; i++) {
      const guess = await redeemGiftCode(
        db,
        { userId, code: `GUESS${i}` },
        new Date(start.getTime() + i * 1000),
      )
      expect(guess).toEqual({ kind: 'rejected', reason: 'unknown' })
    }

    // The right code, one attempt too many: refused without being looked at.
    const late = new Date(start.getTime() + 60_000)
    const refused = await redeemGiftCode(db, { userId, code: 'UBER' }, late)
    expect(refused).toEqual({ kind: 'throttled', retryAt: new Date(start.getTime() + HOUR) })
    expect(await db.collection(COLLECTIONS.giftCodeRedemptions).countDocuments({})).toBe(0)

    // Somebody else is not held back by it.
    const other = await person()
    expect((await redeemGiftCode(db, { userId: other, code: 'UBER' }, late)).kind).toBe('redeemed')

    // An hour on, the window has moved past the guesses.
    const later = new Date(start.getTime() + HOUR + 2 * 60_000)
    expect((await redeemGiftCode(db, { userId, code: 'UBER' }, later)).kind).toBe('redeemed')
  })

  it('keeps one spelling per code', async () => {
    await code({ code: 'uber' })
    expect(await createGiftCode(db, { code: 'UBER', months: 1 }, operator)).toBeNull()
  })
})
